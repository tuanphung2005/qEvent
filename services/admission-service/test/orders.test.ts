import crypto from "node:crypto";
import { describe, expect, it } from "bun:test";
import { InfraError } from "../src/lib/resilient-fetch";
import { reconcileOnce } from "../src/services/order.service";
import {
  FakeEventClient,
  buyTicket,
  call,
  makeTestApp,
  prisma,
  registerAttendee,
  registerStaff,
} from "./helpers";

function orderBody(quantity = 1) {
  return { eventId: "event-1", ticketTypeId: "ticket-type-1", quantity };
}

describe("ticket ordering saga", () => {
  it("confirms the order and issues one ticket per unit", async () => {
    const fake = new FakeEventClient(() => ({ status: 201, body: { unitPrice: 25 } }));
    const { app } = makeTestApp({ eventClient: fake });
    const buyer = await registerAttendee(app);

    const key = crypto.randomUUID();
    const result = await call(app, "/api/orders", {
      method: "POST",
      token: buyer.token,
      headers: { "idempotency-key": key },
      body: orderBody(2),
    });

    expect(result.status).toBe(201);
    expect(result.data.order.status).toBe("CONFIRMED");
    expect(result.data.order.totalAmount).toBe(50);
    expect(result.data.order.tickets).toHaveLength(2);
    expect(fake.createCalls).toHaveLength(1);

    const stored = await prisma.order.findUniqueOrThrow({
      where: { id: result.data.order.id },
      include: { tickets: true, idempotency: true },
    });
    expect(stored.tickets).toHaveLength(2);
    expect(stored.tickets.every((ticket) => ticket.status === "PAID")).toBe(true);
    expect(stored.idempotency?.status).toBe("COMPLETED");
  });

  it("replays the same key and payload without a second reservation", async () => {
    const fake = new FakeEventClient();
    const { app } = makeTestApp({ eventClient: fake });
    const buyer = await registerAttendee(app);
    const key = crypto.randomUUID();

    const first = await call(app, "/api/orders", {
      method: "POST",
      token: buyer.token,
      headers: { "idempotency-key": key },
      body: orderBody(),
    });
    const second = await call(app, "/api/orders", {
      method: "POST",
      token: buyer.token,
      headers: { "idempotency-key": key },
      body: orderBody(),
    });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.data.order.id).toBe(first.data.order.id);
    expect(fake.createCalls).toHaveLength(1);
  });

  it("rejects a reused key with a different payload", async () => {
    const fake = new FakeEventClient();
    const { app } = makeTestApp({ eventClient: fake });
    const buyer = await registerAttendee(app);
    const key = crypto.randomUUID();

    await call(app, "/api/orders", {
      method: "POST",
      token: buyer.token,
      headers: { "idempotency-key": key },
      body: orderBody(1),
    });

    const conflict = await call(app, "/api/orders", {
      method: "POST",
      token: buyer.token,
      headers: { "idempotency-key": key },
      body: orderBody(2),
    });

    expect(conflict.status).toBe(409);
    expect(conflict.data.code).toBe("IDEMPOTENCY_CONFLICT");
    expect(fake.createCalls).toHaveLength(1);
  });

  it("requires an Idempotency-Key header", async () => {
    const { app } = makeTestApp({ eventClient: new FakeEventClient() });
    const buyer = await registerAttendee(app);

    const result = await call(app, "/api/orders", {
      method: "POST",
      token: buyer.token,
      body: orderBody(),
    });

    expect(result.status).toBe(400);
    expect(result.data.code).toBe("IDEMPOTENCY_KEY_REQUIRED");
  });

  it("maps SOLD_OUT to 409 and does not issue tickets", async () => {
    const fake = new FakeEventClient(() => ({
      status: 409,
      body: { code: "SOLD_OUT", message: "Ticket type is exhausted" },
    }));
    const { app } = makeTestApp({ eventClient: fake });
    const buyer = await registerAttendee(app);

    const result = await call(app, "/api/orders", {
      method: "POST",
      token: buyer.token,
      headers: { "idempotency-key": crypto.randomUUID() },
      body: orderBody(),
    });

    expect(result.status).toBe(409);
    expect(result.data.code).toBe("SOLD_OUT");

    const order = await prisma.order.findFirstOrThrow({
      where: { userId: buyer.userId },
      include: { tickets: true },
    });
    expect(order.status).toBe("FAILED");
    expect(order.failureCode).toBe("SOLD_OUT");
    expect(order.tickets).toHaveLength(0);
  });

  it("keeps the order pending on timeout and reconciles it later", async () => {
    let fail = true;
    const fake = new FakeEventClient(() => {
      if (fail) throw new InfraError("downstream timeout");
      return { status: 201, body: {} };
    });
    const { app, deps } = makeTestApp({ eventClient: fake });
    const buyer = await registerAttendee(app);
    const key = crypto.randomUUID();

    const pending = await call(app, "/api/orders", {
      method: "POST",
      token: buyer.token,
      headers: { "idempotency-key": key },
      body: orderBody(),
    });

    expect(pending.status).toBe(202);
    expect(pending.headers.get("location")).toBe(`/api/orders/${pending.data.order.id}`);
    expect(pending.data.order.status).toBe("PENDING_RECONCILIATION");

    const replay = await call(app, "/api/orders", {
      method: "POST",
      token: buyer.token,
      headers: { "idempotency-key": key },
      body: orderBody(),
    });
    expect(replay.status).toBe(202);
    expect(fake.createCalls).toHaveLength(1);

    fail = false;
    expect(await reconcileOnce(deps)).toBe(1);

    const confirmed = await call(app, `/api/orders/${pending.data.order.id}`, {
      token: buyer.token,
    });
    expect(confirmed.status).toBe(200);
    expect(confirmed.data.order.status).toBe("CONFIRMED");
    expect(confirmed.data.order.tickets).toHaveLength(1);

    const replayAfter = await call(app, "/api/orders", {
      method: "POST",
      token: buyer.token,
      headers: { "idempotency-key": key },
      body: orderBody(),
    });
    expect(replayAfter.status).toBe(201);
    expect(replayAfter.data.order.id).toBe(pending.data.order.id);
  });

  it("only the owner or staff can read an order", async () => {
    const { app } = makeTestApp({ eventClient: new FakeEventClient() });
    const owner = await registerAttendee(app);
    const other = await registerAttendee(app);
    const staff = await registerStaff(app);
    const order = await buyTicket(app, owner.token);

    expect((await call(app, `/api/orders/${order.id}`, { token: owner.token })).status).toBe(200);
    expect((await call(app, `/api/orders/${order.id}`, { token: other.token })).status).toBe(404);
    expect((await call(app, `/api/orders/${order.id}`, { token: staff.token })).status).toBe(200);
  });

  it("does not process an order whose reconciliation lease is still active", async () => {
    const fake = new FakeEventClient();
    const { deps } = makeTestApp({ eventClient: fake });
    const user = await prisma.user.create({
      data: {
        email: `lease-${crypto.randomUUID()}@test.local`,
        passwordHash: "x",
        fullName: "Lease User",
      },
    });
    const order = await prisma.order.create({
      data: {
        userId: user.id,
        eventId: "event-lease",
        ticketTypeId: "ticket-type-lease",
        idempotencyKey: crypto.randomUUID(),
        operationId: crypto.randomUUID(),
        status: "PENDING_RECONCILIATION",
        leaseUntil: new Date(Date.now() + 60_000),
      },
    });

    expect(await reconcileOnce(deps)).toBe(0);
    expect(fake.createCalls).toHaveLength(0);

    await prisma.order.update({
      where: { id: order.id },
      data: { leaseUntil: new Date(Date.now() - 1000) },
    });
    expect(await reconcileOnce(deps)).toBe(1);
    expect(fake.createCalls).toHaveLength(1);
  });

  it("compensates a failed ticket issuance and marks the order failed", async () => {
    const fake = new FakeEventClient(
      () => ({ status: 201, body: {} }),
      () => ({ status: 200, body: {} })
    );
    const { deps } = makeTestApp({ eventClient: fake });
    const user = await prisma.user.create({
      data: {
        email: `comp-${crypto.randomUUID()}@test.local`,
        passwordHash: "x",
        fullName: "Comp User",
      },
    });
    const key = crypto.randomUUID();
    const order = await prisma.order.create({
      data: {
        userId: user.id,
        eventId: "event-comp",
        ticketTypeId: "ticket-type-comp",
        idempotencyKey: key,
        operationId: crypto.randomUUID(),
        status: "COMPENSATING",
        failureCode: "TICKET_ISSUE_FAILED",
      },
    });
    await prisma.idempotencyLog.create({
      data: { userId: user.id, key, fingerprint: "fingerprint", orderId: order.id, status: "PENDING" },
    });

    expect(await reconcileOnce(deps)).toBe(1);

    const failed = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { idempotency: true, tickets: true },
    });
    expect(failed.status).toBe("FAILED");
    expect(failed.tickets).toHaveLength(0);
    expect(fake.releaseCalls).toEqual([order.operationId]);
    expect(failed.idempotency?.status).toBe("COMPLETED");
  });

  it("keeps retrying when the compensating release fails", async () => {
    let releaseOk = false;
    const fake = new FakeEventClient(
      () => ({ status: 201, body: {} }),
      () => {
        if (!releaseOk) throw new InfraError("event service down");
        return { status: 200, body: {} };
      }
    );
    const { deps } = makeTestApp({ eventClient: fake });
    const user = await prisma.user.create({
      data: {
        email: `comp-retry-${crypto.randomUUID()}@test.local`,
        passwordHash: "x",
        fullName: "Retry User",
      },
    });
    const order = await prisma.order.create({
      data: {
        userId: user.id,
        eventId: "event-comp",
        ticketTypeId: "ticket-type-comp",
        idempotencyKey: crypto.randomUUID(),
        operationId: crypto.randomUUID(),
        status: "COMPENSATING",
        failureCode: "TICKET_ISSUE_FAILED",
      },
    });

    await reconcileOnce(deps);
    const stillCompensating = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(stillCompensating.status).toBe("COMPENSATING");
    expect(stillCompensating.attempts).toBe(1);

    await prisma.order.update({
      where: { id: order.id },
      data: { leaseUntil: new Date(Date.now() - 1000) },
    });
    releaseOk = true;
    await reconcileOnce(deps);

    const failed = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(failed.status).toBe("FAILED");
    expect(fake.releaseCalls).toHaveLength(2);
  });
});
