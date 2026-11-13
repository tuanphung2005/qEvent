/**
 * Fault experiment: "Event already held the seats, but the response was lost."
 *
 * It pauses the event-service container while a burst of orders is in flight, so
 * some reservations may commit without the Admission Service ever seeing the
 * response. After unpausing, the reconciler must replay the same operationId and
 * issue each ticket at most once.
 *
 *   bun scripts/lost-response-experiment.ts
 */
const BASE = process.env.GATEWAY_URL ?? "http://localhost:8000";
const ORDERS = Number(process.env.ORDER_COUNT ?? 8);
const RECOVERY_TIMEOUT_MS = Number(process.env.RECOVERY_TIMEOUT_MS ?? 60_000);
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
      const body = (await (await fetch(`${BASE}/health`)).json()) as Json;
      if (body?.downstream?.event === "ok") {
        return Math.round(performance.now() - startedAt);
      }
    } catch {
      // retry
    }
    await Bun.sleep(500);
  }
  throw new Error("event-service did not become healthy");
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return (
    Math.round(sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] * 10) /
    10
  );
}

async function main() {
  const registration = await req("/api/auth/register", {
    method: "POST",
    body: {
      email: `lost-response-${crypto.randomUUID()}@qevent.test`,
      password: "password123",
      fullName: "Lost Response Attendee",
    },
  });
  if (registration.status !== 201) throw new Error("register failed");
  const token = registration.data.token as string;

  const events = await req("/api/events");
  const event = events.data.events[0];
  const ticketType = event.ticketTypes[0];
  const baseline = { reservedCount: event.reservedCount, soldCount: ticketType.soldCount };

  // Freeze Event first. The kernel still accepts connections, so the orders
  // below time out in Admission while their bytes sit in Event's socket buffer.
  // On unpause Event processes and commits them, but the client already gave up:
  // exactly the "committed but response lost" case.
  docker("pause", "event-service");

  const placements = await Promise.all(
    Array.from({ length: ORDERS }, async (_, index) => {
      const response = await req("/api/orders", {
        method: "POST",
        token,
        headers: { "idempotency-key": crypto.randomUUID() },
        body: { eventId: event.id, ticketTypeId: ticketType.id, quantity: 1 },
      });
      return { index, ...response };
    })
  );

  docker("unpause", "event-service");
  await Bun.sleep(1_000);

  const recoveryStartedAt = performance.now();
  const eventHealthyAfterMs = await waitForEventService();

  const resolved: Array<{
    orderId: string;
    status: string;
    tickets: number;
    ticketIds: string[];
    recoveryMs: number;
  }> = [];

  for (const placement of placements) {
    const orderId = placement.data?.order?.id;
    if (!orderId) {
      resolved.push({
        orderId: "",
        status: "MISSING",
        tickets: 0,
        ticketIds: [],
        recoveryMs: 0,
      });
      continue;
    }

    const deadline = Date.now() + RECOVERY_TIMEOUT_MS;
    let last: Json = null;
    while (Date.now() < deadline) {
      const order = await req(`/api/orders/${orderId}`, { token });
      last = order.data?.order;
      if (last?.status === "CONFIRMED" || last?.status === "FAILED") break;
      await Bun.sleep(1_000);
    }

    resolved.push({
      orderId,
      status: last?.status ?? "UNKNOWN",
      tickets: last?.tickets?.length ?? 0,
      ticketIds: (last?.tickets ?? []).map((t: Json) => t.id),
      recoveryMs: Math.round(performance.now() - (recoveryStartedAt + eventHealthyAfterMs)),
    });
  }

  const after = await req(`/api/events/${event.id}`);
  const afterEvent = after.data.event;
  const afterTicketType = afterEvent.ticketTypes.find((t: Json) => t.id === ticketType.id);
  const ticketIds = resolved.flatMap((order) => order.ticketIds);

  console.log(
    JSON.stringify(
      {
        measuredAt: new Date().toISOString(),
        scenario:
          "event-service paused before the order burst: requests time out, then Event commits on unpause (response lost)",
        ordersRequested: ORDERS,
        placements: placements.map((p) => ({
          status: p.status,
          orderStatus: p.data?.order?.status ?? null,
          latencyMs: p.ms,
        })),
        placementSummary: {
          confirmed201: placements.filter((p) => p.status === 201).length,
          pending202: placements.filter((p) => p.status === 202).length,
          otherStatuses: [...new Set(placements.map((p) => p.status))],
          p50LatencyMs: percentile(placements.map((p) => p.ms), 50),
          p95LatencyMs: percentile(placements.map((p) => p.ms), 95),
        },
        recovery: {
          eventHealthyAfterMs,
          confirmed: resolved.filter((r) => r.status === "CONFIRMED").length,
          p50RecoveryMs: percentile(resolved.map((r) => r.recoveryMs), 50),
          p95RecoveryMs: percentile(resolved.map((r) => r.recoveryMs), 95),
          orders: resolved,
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
          duplicateTickets: ticketIds.length !== new Set(ticketIds).size,
        },
      },
      null,
      2
    )
  );
}

await main();
