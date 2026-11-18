/**
 * Creates demo orders, tickets and check-ins through the public API so every
 * counter stays consistent (event-service reserved/sold counts included).
 * Safe to rerun: fixed Idempotency-Key values make order creation replay
 * instead of duplicating.
 *
 *   bun scripts/seed-demo-activity.ts
 */
const BASE = process.env.GATEWAY_URL ?? "http://localhost:8000";

type Json = any;

async function req(
  path: string,
  options: { method?: string; token?: string; body?: unknown; headers?: Record<string, string> } = {}
): Promise<{ status: number; data: Json }> {
  const headers: Record<string, string> = { ...(options.headers ?? {}) };
  if (options.body !== undefined) headers["content-type"] = "application/json";
  if (options.token) headers.authorization = `Bearer ${options.token}`;
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
  return { status: res.status, data };
}

async function login(email: string): Promise<string> {
  const result = await req("/api/auth/login", {
    method: "POST",
    body: { email, password: "password123" },
  });
  if (result.status !== 200) throw new Error(`login ${email} failed: ${result.status}`);
  return result.data.token;
}

async function waitForConfirmed(token: string, orderId: string) {
  const deadline = Date.now() + 30_000;
  let last: Json = null;
  while (Date.now() < deadline) {
    const result = await req(`/api/orders/${orderId}`, { token });
    last = result.data?.order;
    if (last?.status === "CONFIRMED" || last?.status === "FAILED") return last;
    await Bun.sleep(1_000);
  }
  return last;
}

// Ids owned by services/event-service/prisma/seed.ts.
const EVENTS = {
  tech: "11111111-1111-4111-8111-111111111111",
  indie: "11111111-1111-4111-8111-111111111112",
  devops: "11111111-1111-4111-8111-111111111113",
  ai: "11111111-1111-4111-8111-111111111114",
} as const;

type Plan = {
  key: string;
  event: keyof typeof EVENTS;
  attendee: string;
  ticketType: number;
  quantity: number;
};

// Spread across four events and several attendees so lists have names, dates and
// money values instead of six copies of the same row.
const PLANS: Plan[] = [
  { key: "demo-tech-1", event: "tech", attendee: "attendee@qevent.com", ticketType: 0, quantity: 2 },
  { key: "demo-tech-2", event: "tech", attendee: "attendee2@qevent.com", ticketType: 1, quantity: 1 },
  { key: "demo-tech-3", event: "tech", attendee: "attendee3@qevent.com", ticketType: 2, quantity: 1 },
  { key: "demo-indie-1", event: "indie", attendee: "attendee4@qevent.com", ticketType: 0, quantity: 2 },
  { key: "demo-indie-2", event: "indie", attendee: "attendee5@qevent.com", ticketType: 1, quantity: 1 },
  { key: "demo-indie-3", event: "indie", attendee: "attendee6@qevent.com", ticketType: 0, quantity: 2 },
  { key: "demo-devops-1", event: "devops", attendee: "attendee7@qevent.com", ticketType: 0, quantity: 2 },
  { key: "demo-devops-2", event: "devops", attendee: "attendee8@qevent.com", ticketType: 1, quantity: 1 },
  { key: "demo-ai-1", event: "ai", attendee: "attendee9@qevent.com", ticketType: 0, quantity: 2 },
  { key: "demo-ai-2", event: "ai", attendee: "attendee10@qevent.com", ticketType: 1, quantity: 1 },
];

const GATES = ["gate-1", "gate-2", "gate-3"];

async function main() {
  const organizer = await login("organizer@qevent.com");
  const staff = await login("staff1@qevent.com");
  const attendeeTokens = new Map<string, string>();
  for (const email of new Set(PLANS.map((plan) => plan.attendee))) {
    attendeeTokens.set(email, await login(email));
  }

  const events = await req("/api/events", { token: organizer });
  const byId = new Map<string, Json>(
    (events.data?.events ?? []).map((event: Json) => [event.id, event] as const)
  );
  for (const id of Object.values(EVENTS)) {
    if (!byId.has(id)) throw new Error(`missing seeded event ${id}; run bun run seed:event first`);
  }

  const tickets: Array<{ ticketId: string; token: string }> = [];

  for (const plan of PLANS) {
    const event = byId.get(EVENTS[plan.event]);
    const ticketType = event?.ticketTypes?.[plan.ticketType] ?? event?.ticketTypes?.[0];
    if (!ticketType) {
      console.warn(`skip ${plan.key}: no ticket type`);
      continue;
    }
    const token = attendeeTokens.get(plan.attendee)!;

    const created = await req("/api/orders", {
      method: "POST",
      token,
      headers: { "idempotency-key": plan.key },
      body: {
        eventId: EVENTS[plan.event],
        ticketTypeId: ticketType.id,
        quantity: plan.quantity,
      },
    });

    let order = created.data?.order;
    if (created.status === 202 && order?.id) {
      order = await waitForConfirmed(token, order.id);
    }
    if (!order || order.status !== "CONFIRMED") {
      console.warn(
        `order ${plan.key}: ${created.status} ${order?.status ?? "missing"} (skipping tickets)`
      );
      continue;
    }

    for (const ticket of order.tickets ?? []) {
      if (ticket.status === "PAID") tickets.push({ ticketId: ticket.id, token });
    }
    console.log(`order ${plan.key}: ${order.status} (${order.tickets.length} tickets)`);
  }

  // Check in most tickets so the dashboard, gate split and feed have volume.
  let checkedIn = 0;
  for (const [index, ticket] of tickets.entries()) {
    if (index % 4 === 3) continue;
    const qr = await req(`/api/tickets/${ticket.ticketId}/qr-token`, { token: ticket.token });
    if (qr.status !== 200) continue;

    const gate = GATES[index % GATES.length];
    const result = await req("/api/checkins", {
      method: "POST",
      token: staff,
      body: { qrToken: qr.data.qrToken, deviceId: gate, gate },
    });
    if (result.status === 201 || result.status === 409) checkedIn++;
  }

  for (const [name, id] of Object.entries(EVENTS)) {
    const stats = await req(`/api/checkins/stats?eventId=${id}`, { token: staff });
    const data = stats.data ?? {};
    console.log(
      `${name}: ${data.tickets?.checkedIn ?? 0}/${data.tickets?.total ?? 0} vé đã soát, ` +
        `${data.orders?.total ?? 0} đơn (${data.orders?.confirmed ?? 0} confirmed)`
    );
  }

  console.log(`demo ready: ${tickets.length} tickets, ${checkedIn} check-in attempts`);
}

await main();
