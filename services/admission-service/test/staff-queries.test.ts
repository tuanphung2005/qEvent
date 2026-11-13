import crypto from "node:crypto";
import { describe, expect, it } from "bun:test";
import {
  FakeEventClient,
  buyTicket,
  call,
  makeTestApp,
  registerAttendee,
  registerOrganizer,
  registerStaff,
} from "./helpers";

function eventId() {
  return `event-${crypto.randomUUID()}`;
}

async function issueTickets(app: ReturnType<typeof makeTestApp>["app"], token: string, id: string, quantity = 1) {
  return buyTicket(app, token, { eventId: id, ticketTypeId: `type-${id}`, quantity });
}

describe("staff read endpoints", () => {
  it("returns the authenticated user and rejects anonymous requests", async () => {
    const { app } = makeTestApp({ eventClient: new FakeEventClient() });
    const attendee = await registerAttendee(app);

    const me = await call(app, "/api/auth/me", { token: attendee.token });
    expect(me.status).toBe(200);
    expect(me.data.user.id).toBe(attendee.userId);
    expect(me.data.user.role).toBe("ATTENDEE");

    const anonymous = await call(app, "/api/auth/me");
    expect(anonymous.status).toBe(401);
    expect(anonymous.data.code).toBe("UNAUTHORIZED");
  });

  it("lists orders for an event with filters, search and cursor pagination", async () => {
    const { app } = makeTestApp({ eventClient: new FakeEventClient() });
    const attendee = await registerAttendee(app);
    const staff = await registerStaff(app);
    const id = eventId();

    const first = await issueTickets(app, attendee.token, id, 1);
    const second = await issueTickets(app, attendee.token, id, 2);

    const list = await call(app, `/api/orders?eventId=${id}`, { token: staff.token });
    expect(list.status).toBe(200);
    expect(list.data.orders).toHaveLength(2);
    expect(list.data.nextCursor).toBeNull();
    expect(list.data.orders[0].attendee.email).toContain("@test.local");
    expect(list.data.orders[0].ticketsCount).toBeGreaterThanOrEqual(1);

    const filtered = await call(app, `/api/orders?eventId=${id}&status=CONFIRMED`, {
      token: staff.token,
    });
    expect(filtered.data.orders).toHaveLength(2);

    const searched = await call(
      app,
      `/api/orders?eventId=${id}&q=${encodeURIComponent("Test User")}`,
      { token: staff.token }
    );
    expect(searched.data.orders).toHaveLength(2);

    const page = await call(app, `/api/orders?eventId=${id}&limit=1`, { token: staff.token });
    expect(page.data.orders).toHaveLength(1);
    expect(page.data.nextCursor).toBeString();

    const next = await call(
      app,
      `/api/orders?eventId=${id}&limit=1&cursor=${page.data.nextCursor}`,
      { token: staff.token }
    );
    expect(next.data.orders).toHaveLength(1);
    expect(next.data.orders[0].id).not.toBe(page.data.orders[0].id);

    const attendeeDenied = await call(app, `/api/orders?eventId=${id}`, {
      token: attendee.token,
    });
    expect(attendeeDenied.status).toBe(403);

    const organizer = await registerOrganizer(app);
    const organizerList = await call(app, `/api/orders?eventId=${id}`, {
      token: organizer.token,
    });
    expect(organizerList.status).toBe(200);
    expect(organizerList.data.orders.map((order: any) => order.id).sort()).toEqual(
      [first.id, second.id].sort()
    );
  });

  it("lists and searches tickets, then returns ticket detail without qrSecret", async () => {
    const { app } = makeTestApp({ eventClient: new FakeEventClient() });
    const attendee = await registerAttendee(app);
    const staff = await registerStaff(app);
    const id = eventId();
    const order = await issueTickets(app, attendee.token, id, 2);
    const ticketId = order.tickets[0].id;

    const list = await call(app, `/api/tickets?eventId=${id}`, { token: staff.token });
    expect(list.status).toBe(200);
    expect(list.data.tickets).toHaveLength(2);
    expect(list.data.tickets[0].attendee.email).toContain("@test.local");

    const search = await call(
      app,
      `/api/tickets?eventId=${id}&q=${encodeURIComponent("Test User")}`,
      { token: staff.token }
    );
    expect(search.data.tickets).toHaveLength(2);

    const detail = await call(app, `/api/tickets/${ticketId}`, { token: staff.token });
    expect(detail.status).toBe(200);
    expect(detail.data.ticket.id).toBe(ticketId);
    expect(detail.data.ticket.qrSecret).toBeUndefined();
    expect(detail.data.order.id).toBe(order.id);
    expect(detail.data.checkinLogs).toEqual([]);

    const missing = await call(app, `/api/tickets/${crypto.randomUUID()}`, {
      token: staff.token,
    });
    expect(missing.status).toBe(404);

    const denied = await call(app, `/api/tickets?eventId=${id}`, { token: attendee.token });
    expect(denied.status).toBe(403);
  });

  it("returns the check-in feed and dashboard counters", async () => {
    const { app } = makeTestApp({ eventClient: new FakeEventClient() });
    const attendee = await registerAttendee(app);
    const staff = await registerStaff(app);
    const id = eventId();
    const order = await issueTickets(app, attendee.token, id, 2);
    const ticketId = order.tickets[0].id;

    const qr = await call(app, `/api/tickets/${ticketId}/qr-token`, { token: attendee.token });
    const checkin = await call(app, "/api/checkins", {
      method: "POST",
      token: staff.token,
      body: { qrToken: qr.data.qrToken, deviceId: "gate-test" },
    });
    expect(checkin.status).toBe(201);

    const stats = await call(app, `/api/checkins/stats?eventId=${id}`, { token: staff.token });
    expect(stats.status).toBe(200);
    expect(stats.data.tickets).toEqual({ total: 2, checkedIn: 1, remaining: 1 });
    expect(stats.data.orders.confirmed).toBe(1);
    expect(stats.data.orders.soldTickets).toBe(2);
    expect(stats.data.byGate).toEqual([{ gate: "gate-test", count: 1 }]);
    expect(stats.data.lastCheckinAt).toBeString();

    const feed = await call(app, `/api/checkins?eventId=${id}`, { token: staff.token });
    expect(feed.status).toBe(200);
    expect(feed.data.checkins).toHaveLength(1);
    expect(feed.data.checkins[0].ticketId).toBe(ticketId);
    expect(feed.data.checkins[0].deviceId).toBe("gate-test");
    expect(feed.data.checkins[0].attendee.email).toContain("@test.local");

    const future = new Date(Date.now() + 60_000).toISOString();
    const empty = await call(app, `/api/checkins?eventId=${id}&since=${future}`, {
      token: staff.token,
    });
    expect(empty.data.checkins).toHaveLength(0);

    const otherGate = await call(app, `/api/checkins?eventId=${id}&gate=gate-other`, {
      token: staff.token,
    });
    expect(otherGate.data.checkins).toHaveLength(0);

    const invalidSince = await call(app, `/api/checkins?eventId=${id}&since=not-a-date`, {
      token: staff.token,
    });
    expect(invalidSince.status).toBe(422);
    expect(invalidSince.data.code).toBe("INVALID_SINCE");

    const denied = await call(app, `/api/checkins/stats?eventId=${id}`, {
      token: attendee.token,
    });
    expect(denied.status).toBe(403);
  });
});
