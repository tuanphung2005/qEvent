import crypto from "node:crypto";
import { describe, expect, it } from "bun:test";
import { generateTotp, signQrToken } from "../src/lib/qr";
import {
  FakeEventClient,
  buyTicket,
  call,
  makeTestApp,
  prisma,
  qrFor,
  registerAttendee,
  registerStaff,
} from "./helpers";

const fake = new FakeEventClient();
const { app, deps } = makeTestApp({ eventClient: fake });

async function issueTicket(token: string, quantity = 1) {
  const order = await buyTicket(app, token, { quantity });
  const tickets = await prisma.ticket.findMany({
    where: { orderId: order.id },
    orderBy: { createdAt: "asc" },
  });
  return { order, tickets, ticket: tickets[0] };
}

async function getQrToken(token: string, ticketId: string) {
  const result = await call(app, `/api/tickets/${ticketId}/qr-token`, { token });
  return result;
}

function scan(token: string | undefined, qrToken: string, deviceId = "gate-1") {
  return call(app, "/api/checkins", {
    method: "POST",
    token,
    body: { qrToken, deviceId },
  });
}

describe("online check-in", () => {
  it("accepts a valid dynamic QR and records a check-in log", async () => {
    const buyer = await registerAttendee(app);
    const staff = await registerStaff(app);
    const { ticket } = await issueTicket(buyer.token);

    const qr = await getQrToken(buyer.token, ticket.id);
    expect(qr.status).toBe(200);
    expect(qr.data.qrToken).toBeString();
    expect(qr.data.expiresIn).toBeGreaterThan(0);

    const result = await scan(staff.token, qr.data.qrToken);
    expect(result.status).toBe(201);
    expect(result.data.code).toBe("CHECKIN_SUCCESS");

    const updated = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(updated.status).toBe("CHECKED_IN");
    expect(updated.checkedInAt).not.toBeNull();

    const logs = await prisma.checkinLog.findMany({ where: { ticketId: ticket.id } });
    expect(logs).toHaveLength(1);
    expect(logs[0].scannedBy).toBe(staff.userId);
    expect(logs[0].syncStatus).toBe("SYNCED");
  });

  it("rejects a second scan with 409 ALREADY_CHECKED_IN", async () => {
    const buyer = await registerAttendee(app);
    const staff = await registerStaff(app);
    const { ticket } = await issueTicket(buyer.token);
    const qr = await getQrToken(buyer.token, ticket.id);

    expect((await scan(staff.token, qr.data.qrToken)).status).toBe(201);
    const second = await scan(staff.token, qr.data.qrToken);
    expect(second.status).toBe(409);
    expect(second.data.code).toBe("ALREADY_CHECKED_IN");
  });

  it("accepts exactly one of two concurrent scans", async () => {
    const buyer = await registerAttendee(app);
    const staff = await registerStaff(app);
    const { ticket } = await issueTicket(buyer.token);
    const qr = await getQrToken(buyer.token, ticket.id);

    const results = await Promise.all([
      scan(staff.token, qr.data.qrToken),
      scan(staff.token, qr.data.qrToken),
    ]);
    const statuses = results.map((result) => result.status).sort();
    expect(statuses).toEqual([201, 409]);
  });

  it("rejects tampered, expired and wrong-TOTP tokens", async () => {
    const buyer = await registerAttendee(app);
    const staff = await registerStaff(app);
    const { ticket } = await issueTicket(buyer.token);
    const qr = await getQrToken(buyer.token, ticket.id);

    const [, signature] = qr.data.qrToken.split(".");
    const tampered = Buffer.from(
      JSON.stringify({ tid: ticket.id, eid: "other-event", code: "123456", iat: Date.now() / 1000 })
    ).toString("base64url");
    const tamperedResult = await scan(staff.token, `${tampered}.${signature}`);
    expect(tamperedResult.status).toBe(400);
    expect(tamperedResult.data.code).toBe("INVALID_QR_TOKEN");

    const expired = qrFor(deps, ticket, Date.now() - 31_000);
    const expiredResult = await scan(staff.token, expired);
    expect(expiredResult.status).toBe(400);
    expect(expiredResult.data.code).toBe("INVALID_QR_TOKEN");

    const now = Date.now();
    const realCode = generateTotp(ticket.qrSecret, now);
    const wrongCode = realCode === "000000" ? "111111" : "000000";
    const wrongTotp = signQrToken(
      { tid: ticket.id, eid: ticket.eventId, code: wrongCode, iat: Math.floor(now / 1000) },
      deps.keys.privateKey
    );
    const wrongResult = await scan(staff.token, wrongTotp);
    expect(wrongResult.status).toBe(400);
    expect(wrongResult.data.code).toBe("INVALID_QR_TOKEN");
  });

  it("requires a staff or organizer role", async () => {
    const buyer = await registerAttendee(app);
    const { ticket } = await issueTicket(buyer.token);
    const qr = await getQrToken(buyer.token, ticket.id);

    const result = await scan(buyer.token, qr.data.qrToken);
    expect(result.status).toBe(403);
    expect(result.data.code).toBe("FORBIDDEN");
  });
});

describe("ticket access", () => {
  it("lists only the caller's tickets without leaking QR secrets", async () => {
    const buyer = await registerAttendee(app);
    const other = await registerAttendee(app);
    const { ticket } = await issueTicket(buyer.token);
    await issueTicket(other.token);

    const mine = await call(app, "/api/tickets/my", { token: buyer.token });
    expect(mine.status).toBe(200);
    expect(mine.data.tickets).toHaveLength(1);
    expect(mine.data.tickets[0].id).toBe(ticket.id);
    expect(mine.data.tickets[0].qrSecret).toBeUndefined();

    const alias = await call(app, "/api/tickets", { token: buyer.token });
    expect(alias.status).toBe(200);
    expect(alias.data.tickets).toHaveLength(1);
  });

  it("only lets the owner or staff read a QR token", async () => {
    const buyer = await registerAttendee(app);
    const other = await registerAttendee(app);
    const staff = await registerStaff(app);
    const { ticket } = await issueTicket(buyer.token);

    expect((await getQrToken(buyer.token, ticket.id)).status).toBe(200);
    expect((await getQrToken(other.token, ticket.id)).status).toBe(403);
    expect((await getQrToken(staff.token, ticket.id)).status).toBe(200);
  });

  it("refuses QR tokens for cancelled tickets", async () => {
    const buyer = await registerAttendee(app);
    const { ticket } = await issueTicket(buyer.token);
    await prisma.ticket.update({ where: { id: ticket.id }, data: { status: "CANCELLED" } });

    const result = await getQrToken(buyer.token, ticket.id);
    expect(result.status).toBe(409);
    expect(result.data.code).toBe("TICKET_CANCELLED");
  });
});

describe("offline check-in sync", () => {
  it("applies scans chronologically and reports the later scan as a conflict", async () => {
    const buyer = await registerAttendee(app);
    const staff = await registerStaff(app);
    const { ticket } = await issueTicket(buyer.token);

    const base = Date.now();
    const logs = [
      { ticketId: ticket.id, scannedAt: new Date(base + 5_000).toISOString(), deviceId: "gate-b" },
      { ticketId: ticket.id, scannedAt: new Date(base).toISOString(), deviceId: "gate-a" },
    ];

    const first = await call(app, "/api/checkins/sync-offline", {
      method: "POST",
      token: staff.token,
      body: { logs },
    });
    expect(first.status).toBe(200);
    expect(first.data.processed).toBe(2);
    expect(first.data.synced).toBe(1);
    expect(first.data.conflicts).toBe(1);
    expect(first.data.results.find((item: any) => item.status === "SYNCED").logId).toBeString();

    const replay = await call(app, "/api/checkins/sync-offline", {
      method: "POST",
      token: staff.token,
      body: { logs },
    });
    expect(replay.status).toBe(200);
    expect(replay.data.duplicates).toBe(2);
    expect(replay.data.synced).toBe(0);
  });

  it("reports unknown tickets and rejects non-staff callers", async () => {
    const staff = await registerStaff(app);
    const attendee = await registerAttendee(app);

    const unknown = await call(app, "/api/checkins/sync-offline", {
      method: "POST",
      token: staff.token,
      body: {
        logs: [{ ticketId: crypto.randomUUID(), scannedAt: new Date().toISOString() }],
      },
    });
    expect(unknown.status).toBe(200);
    expect(unknown.data.results[0].status).toBe("ERROR");
    expect(unknown.data.results[0].reason).toBe("TICKET_NOT_FOUND");

    const forbidden = await call(app, "/api/checkins/sync-offline", {
      method: "POST",
      token: attendee.token,
      body: {
        logs: [{ ticketId: crypto.randomUUID(), scannedAt: new Date().toISOString() }],
      },
    });
    expect(forbidden.status).toBe(403);
  });
});

describe("internal access verification", () => {
  function verifyAccess(userId: string, eventId: string, token = deps.internalToken) {
    return call(
      app,
      `/internal/tickets/verify-access?userId=${encodeURIComponent(userId)}&eventId=${encodeURIComponent(eventId)}`,
      { headers: { "x-service-token": token } }
    );
  }

  it("reports access only after check-in and requires the service token", async () => {
    const buyer = await registerAttendee(app);
    const staff = await registerStaff(app);
    const order = await buyTicket(app, buyer.token);
    const ticket = await prisma.ticket.findFirstOrThrow({ where: { orderId: order.id } });

    const before = await verifyAccess(buyer.userId, order.eventId);
    expect(before.status).toBe(200);
    expect(before.data.hasAccess).toBe(false);

    const qr = await getQrToken(buyer.token, ticket.id);
    await scan(staff.token, qr.data.qrToken);

    const after = await verifyAccess(buyer.userId, order.eventId);
    expect(after.status).toBe(200);
    expect(after.data.hasAccess).toBe(true);
    expect(after.data.ticketId).toBe(ticket.id);

    const unauthorized = await verifyAccess(buyer.userId, order.eventId, "wrong-token");
    expect(unauthorized.status).toBe(401);
    expect(unauthorized.data.code).toBe("UNAUTHORIZED_SERVICE");
  });
});
