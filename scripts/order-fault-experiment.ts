/**
 * Fault experiment required by the microservices brief:
 * "Turn Event Service off while placing orders, then observe pending orders and
 * recovery once Event is back."
 *
 * It stops/starts only the event-service container; PostgreSQL keeps its data.
 * Run from the repo root with the stack already up:
 *
 *   bun scripts/order-fault-experiment.ts
 *
 * Output is JSON. Redirect it to docs/evidence/ if you want to keep the run:
 *   bun scripts/order-fault-experiment.ts > docs/evidence/order-fault.json
 */
const BASE = process.env.GATEWAY_URL ?? "http://localhost:8000";
const ORDERS = Number(process.env.ORDER_COUNT ?? 5);
const RECOVERY_TIMEOUT_MS = Number(process.env.RECOVERY_TIMEOUT_MS ?? 45_000);
const repoRoot = decodeURIComponent(
  new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")
);

type Json = any;

async function req(
  path: string,
  options: { method?: string; token?: string; body?: unknown; headers?: Record<string, string> } = {}
): Promise<{ status: number; data: Json; ms: number }> {
  const headers: Record<string, string> = { ...(options.headers ?? {}) };
  if (options.body !== undefined) headers["content-type"] = "application/json";
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  const started = performance.now();
  const res = await fetch(BASE + path, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await res.text();
  let data: Json = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data, ms: Math.round((performance.now() - started) * 10) / 10 };
}

function docker(...args: string[]) {
  const result = Bun.spawnSync({
    cmd: ["docker", "compose", ...args],
    cwd: repoRoot,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) {
    throw new Error(`docker compose ${args.join(" ")} failed: ${result.stderr.toString()}`);
  }
}

async function waitForEventService(timeoutMs = 30_000): Promise<number> {
  const startedAt = performance.now();
  while (performance.now() - startedAt < timeoutMs) {
    try {
      const health = await fetch(`${BASE}/health`);
      const body = (await health.json()) as Json;
      if (body?.downstream?.event === "ok") {
        return Math.round(performance.now() - startedAt);
      }
    } catch {
      // gateway may still be starting
    }
    await Bun.sleep(500);
  }
  throw new Error("event-service did not become healthy in time");
}

async function main() {
  const suffix = crypto.randomUUID();
  const registration = await req("/api/auth/register", {
    method: "POST",
    body: {
      email: `order-fault-${suffix}@qevent.test`,
      password: "password123",
      fullName: "Order Fault Attendee",
    },
  });
  if (registration.status !== 201) {
    throw new Error(`register failed: ${registration.status} ${JSON.stringify(registration.data)}`);
  }
  const token = registration.data.token as string;

  const events = await req("/api/events");
  const event = events.data.events[0];
  if (!event) throw new Error("no seeded event");
  const ticketType = event.ticketTypes[0];
  if (!ticketType) throw new Error("no ticket type");

  const baseline = {
    reservedCount: event.reservedCount,
    soldCount: ticketType.soldCount,
  };

  // Stop only Event Service. Admission keeps accepting orders and records PENDING.
  docker("stop", "event-service");
  await Bun.sleep(2_000);

  const placements: Array<{
    orderId: string;
    status: number;
    orderStatus: string;
    latencyMs: number;
    key: string;
  }> = [];

  for (let i = 0; i < ORDERS; i++) {
    const key = crypto.randomUUID();
    const placement = await req("/api/orders", {
      method: "POST",
      token,
      headers: { "idempotency-key": key },
      body: {
        eventId: event.id,
        ticketTypeId: ticketType.id,
        quantity: 1,
      },
    });
    placements.push({
      orderId: placement.data?.order?.id ?? "",
      status: placement.status,
      orderStatus: placement.data?.order?.status ?? "",
      latencyMs: placement.ms,
      key,
    });
  }

  const recoveryStartedAt = performance.now();
  docker("start", "event-service");
  const eventHealthyAfterMs = await waitForEventService();

  const resolved: Array<{
    orderId: string;
    status: string;
    recoveryMs: number;
    tickets: number;
    ticketIds: string[];
  }> = [];
  let confirmed = 0;
  for (const placement of placements) {
    const deadline = Date.now() + RECOVERY_TIMEOUT_MS;
    let last: Json = null;
    while (Date.now() < deadline) {
      const order = await req(`/api/orders/${placement.orderId}`, { token });
      last = order.data?.order;
      if (last?.status === "CONFIRMED" || last?.status === "FAILED") break;
      await Bun.sleep(1_000);
    }
    if (!last) throw new Error(`order ${placement.orderId} disappeared`);
    if (last.status === "CONFIRMED") confirmed++;
    resolved.push({
      orderId: placement.orderId,
      status: last.status,
      recoveryMs: Math.round(performance.now() - (recoveryStartedAt + eventHealthyAfterMs)),
      tickets: last.tickets.length,
      ticketIds: last.tickets.map((t: Json) => t.id),
    });
  }

  const after = await req(`/api/events/${event.id}`);
  const afterEvent = after.data.event;
  const afterTicketType = afterEvent.ticketTypes.find((t: Json) => t.id === ticketType.id);

  const ticketIds = resolved.flatMap((order) => order.ticketIds);
  const duplicateTickets = ticketIds.length !== new Set(ticketIds).size;

  const result = {
    measuredAt: new Date().toISOString(),
    scenario: "event-service down during order placement",
    ordersRequested: ORDERS,
    placements,
    placementSummary: {
      acknowledged202: placements.filter((p) => p.status === 202).length,
      otherStatuses: [...new Set(placements.map((p) => p.status))],
      p50LatencyMs: percentile(placements.map((p) => p.latencyMs), 50),
      p95LatencyMs: percentile(placements.map((p) => p.latencyMs), 95),
    },
    recovery: {
      eventHealthyAfterMs,
      confirmed,
      orders: resolved,
      p50RecoveryMs: percentile(resolved.map((r) => r.recoveryMs), 50),
      p95RecoveryMs: percentile(resolved.map((r) => r.recoveryMs), 95),
    },
    integrity: {
      reservedCountBefore: baseline.reservedCount,
      reservedCountAfter: afterEvent.reservedCount,
      reservedDelta: afterEvent.reservedCount - baseline.reservedCount,
      soldCountBefore: baseline.soldCount,
      soldCountAfter: afterTicketType.soldCount,
      soldDelta: afterTicketType.soldCount - baseline.soldCount,
      expectedDelta: ORDERS,
      noCapacityDrift: afterEvent.reservedCount - baseline.reservedCount === ORDERS,
      everyOrderHasOneTicket: resolved.every((r) => r.tickets === 1),
      duplicateTickets,
    },
  };

  console.log(JSON.stringify(result, null, 2));
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] * 10) / 10;
}

await main();
