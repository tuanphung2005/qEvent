/**
 * Creates demo orders, tickets and check-ins through the public API so every
 * counter stays consistent. Safe to rerun: fixed Idempotency-Key values make
 * order creation replay instead of duplicating.
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

async function main() {
  const organizer = await login("organizer@qevent.com");
  const staff = await login("staff1@qevent.com");
  const attendees = [
    { label: "attendee", token: await login("attendee@qevent.com") },
    { label: "attendee2", token: await login("attendee2@qevent.com") },
  ];

  const events = await req("/api/events");
  const seedEventId = "11111111-1111-4111-8111-111111111111";
  const event =
    events.data?.events?.find((candidate: Json) => candidate.id === seedEventId) ??
    events.data?.events?.[0];
  if (!event) throw new Error("no seeded event; run the event-service seed first");
  const session = event.sessions?.[0];
  const ticketType = event.ticketTypes?.[0];
  if (!session || !ticketType) throw new Error("seeded event has no session or ticket type");

  // Make the session interactable for the staff web demo.
  const live = await req(`/api/events/${event.id}/sessions/${session.id}`, {
    method: "PATCH",
    token: organizer,
    body: { isLive: true },
  });
  console.log(`session live: ${live.status === 200 ? "yes" : `HTTP ${live.status}`}`);

  const plans = [
    { attendee: attendees[0], key: "demo-seed-attendee-1", quantity: 2 },
    { attendee: attendees[0], key: "demo-seed-attendee-2", quantity: 1 },
    { attendee: attendees[1], key: "demo-seed-attendee2-1", quantity: 1 },
  ];

  const tickets: Array<{ orderId: string; ticketId: string; token: string }> = [];

  for (const plan of plans) {
    const created = await req("/api/orders", {
      method: "POST",
      token: plan.attendee.token,
      headers: { "idempotency-key": plan.key },
      body: {
        eventId: event.id,
        ticketTypeId: ticketType.id,
        quantity: plan.quantity,
      },
    });

    let order = created.data?.order;
    if (created.status === 202 && order?.id) {
      order = await waitForConfirmed(plan.attendee.token, order.id);
    }
    if (!order || order.status !== "CONFIRMED") {
      console.warn(
        `order ${plan.key}: ${created.status} ${order?.status ?? "missing"} (skipping tickets)`
      );
      continue;
    }

    for (const ticket of order.tickets ?? []) {
      tickets.push({ orderId: order.id, ticketId: ticket.id, token: plan.attendee.token });
    }
    console.log(`order ${plan.key}: ${order.status} (${order.tickets.length} tickets)`);
  }

  // Check in two tickets so the dashboard and feed are not empty.
  let checkedIn = 0;
  for (const ticket of tickets.slice(0, 2)) {
    const qr = await req(`/api/tickets/${ticket.ticketId}/qr-token`, { token: ticket.token });
    if (qr.status !== 200) continue;

    const result = await req("/api/checkins", {
      method: "POST",
      token: staff,
      body: { qrToken: qr.data.qrToken, deviceId: "gate-1", gate: "gate-1" },
    });
    if (result.status === 201 || result.status === 409) checkedIn++;
    console.log(
      `check-in ${ticket.ticketId}: ${result.status} ${result.data?.code ?? result.data?.status ?? ""}`
    );
  }

  const stats = await req(`/api/checkins/stats?eventId=${event.id}`, { token: staff });
  console.log(
    `demo ready: ${tickets.length} tickets, ${checkedIn} check-in attempts, stats HTTP ${stats.status}`
  );
  if (stats.status === 200) {
    console.log(JSON.stringify(stats.data, null, 2));
  }
}

await main();
