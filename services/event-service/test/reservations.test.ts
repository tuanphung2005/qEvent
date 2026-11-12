import crypto from "node:crypto";
import { describe, expect, it } from "bun:test";
import {
  call,
  createEventWithTicketType,
  makeTestApp,
  prisma,
  serviceHeaders,
} from "./helpers";

function reservationBody(
  eventId: string,
  ticketTypeId: string,
  overrides: Partial<{ operationId: string; quantity: number }> = {}
) {
  return {
    operationId: overrides.operationId ?? crypto.randomUUID(),
    eventId,
    ticketTypeId,
    quantity: overrides.quantity ?? 1,
  };
}

async function hold(
  app: ReturnType<typeof makeTestApp>["app"],
  eventId: string,
  ticketTypeId: string,
  overrides: Partial<{ operationId: string; quantity: number }> = {}
) {
  return call(app, "/internal/reservations", {
    method: "POST",
    headers: serviceHeaders(),
    body: reservationBody(eventId, ticketTypeId, overrides),
  });
}

describe("internal reservations", () => {
  it("holds seats, increments both counters and returns the unit price", async () => {
    const { app } = makeTestApp();
    const { event, ticketType } = await createEventWithTicketType({ maxCapacity: 10, quota: 10 });

    const result = await hold(app, event.id, ticketType.id, { quantity: 3 });

    expect(result.status).toBe(201);
    expect(result.data.reservation.status).toBe("CONFIRMED");
    expect(result.data.reservation.quantity).toBe(3);
    expect(result.data.reservation.unitPrice).toBe(25);

    const storedType = await prisma.ticketType.findUniqueOrThrow({ where: { id: ticketType.id } });
    const storedEvent = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(storedType.soldCount).toBe(3);
    expect(storedEvent.reservedCount).toBe(3);
  });

  it("replays the same operationId and payload without holding twice", async () => {
    const { app } = makeTestApp();
    const { event, ticketType } = await createEventWithTicketType({ quota: 10 });
    const operationId = crypto.randomUUID();

    const first = await hold(app, event.id, ticketType.id, { operationId, quantity: 2 });
    const second = await hold(app, event.id, ticketType.id, { operationId, quantity: 2 });

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.data.reservation.id).toBe(first.data.reservation.id);

    const storedType = await prisma.ticketType.findUniqueOrThrow({ where: { id: ticketType.id } });
    expect(storedType.soldCount).toBe(2);
    expect(await prisma.reservation.count({ where: { operationId } })).toBe(1);
  });

  it("rejects the same operationId with a different payload", async () => {
    const { app } = makeTestApp();
    const { event, ticketType } = await createEventWithTicketType({ quota: 10 });
    const operationId = crypto.randomUUID();

    await hold(app, event.id, ticketType.id, { operationId, quantity: 1 });
    const conflict = await hold(app, event.id, ticketType.id, { operationId, quantity: 2 });

    expect(conflict.status).toBe(409);
    expect(conflict.data.code).toBe("IDEMPOTENCY_CONFLICT");

    const storedType = await prisma.ticketType.findUniqueOrThrow({ where: { id: ticketType.id } });
    expect(storedType.soldCount).toBe(1);
  });

  it("lets exactly one caller win the last ticket under concurrency", async () => {
    const { app } = makeTestApp();
    const { event, ticketType } = await createEventWithTicketType({
      maxCapacity: 1,
      quota: 1,
    });

    const results = await Promise.all(
      Array.from({ length: 10 }, () => hold(app, event.id, ticketType.id))
    );

    const created = results.filter((result) => result.status === 201);
    const soldOut = results.filter((result) => result.status === 409);
    expect(created).toHaveLength(1);
    expect(soldOut).toHaveLength(9);
    expect(soldOut.every((result) => result.data.code === "SOLD_OUT")).toBe(true);

    const storedType = await prisma.ticketType.findUniqueOrThrow({ where: { id: ticketType.id } });
    const storedEvent = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(storedType.soldCount).toBe(1);
    expect(storedEvent.reservedCount).toBe(1);
    expect(await prisma.reservation.count({ where: { eventId: event.id } })).toBe(1);
  });

  it("enforces event capacity across different ticket types", async () => {
    const { app } = makeTestApp();
    const event = await prisma.event.create({
      data: {
        name: `Event ${crypto.randomUUID()}`,
        venue: "Test Venue",
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() + 30 * 60 * 60 * 1000),
        maxCapacity: 2,
      },
    });
    const standard = await prisma.ticketType.create({
      data: { eventId: event.id, name: "Standard", price: 25, quota: 5 },
    });
    const vip = await prisma.ticketType.create({
      data: { eventId: event.id, name: "VIP", price: 90, quota: 5 },
    });

    const first = await hold(app, event.id, standard.id, { quantity: 2 });
    const second = await hold(app, event.id, vip.id, { quantity: 1 });

    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
    expect(second.data.code).toBe("SOLD_OUT");

    const storedEvent = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(storedEvent.reservedCount).toBe(2);
  });

  it("releases seats once and treats a repeated release as idempotent", async () => {
    const { app } = makeTestApp();
    const { event, ticketType } = await createEventWithTicketType({ maxCapacity: 10, quota: 10 });
    const operationId = crypto.randomUUID();

    await hold(app, event.id, ticketType.id, { operationId, quantity: 2 });

    const first = await call(app, `/internal/reservations/${operationId}`, {
      method: "DELETE",
      headers: serviceHeaders(),
    });
    const second = await call(app, `/internal/reservations/${operationId}`, {
      method: "DELETE",
      headers: serviceHeaders(),
    });

    expect(first.status).toBe(200);
    expect(first.data.reservation.status).toBe("RELEASED");
    expect(second.status).toBe(200);
    expect(second.data.reservation.status).toBe("RELEASED");

    const storedType = await prisma.ticketType.findUniqueOrThrow({ where: { id: ticketType.id } });
    const storedEvent = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(storedType.soldCount).toBe(0);
    expect(storedEvent.reservedCount).toBe(0);
  });

  it("does not re-hold seats when a released operationId is replayed", async () => {
    const { app } = makeTestApp();
    const { event, ticketType } = await createEventWithTicketType({ maxCapacity: 10, quota: 10 });
    const operationId = crypto.randomUUID();

    await hold(app, event.id, ticketType.id, { operationId, quantity: 2 });
    await call(app, `/internal/reservations/${operationId}`, {
      method: "DELETE",
      headers: serviceHeaders(),
    });

    const replay = await hold(app, event.id, ticketType.id, { operationId, quantity: 2 });

    expect(replay.status).toBe(409);
    expect(replay.data.code).toBe("RESERVATION_RELEASED");

    const storedType = await prisma.ticketType.findUniqueOrThrow({ where: { id: ticketType.id } });
    expect(storedType.soldCount).toBe(0);
  });

  it("returns 404 for an unknown reservation on release", async () => {
    const { app } = makeTestApp();

    const result = await call(app, `/internal/reservations/${crypto.randomUUID()}`, {
      method: "DELETE",
      headers: serviceHeaders(),
    });

    expect(result.status).toBe(404);
    expect(result.data.code).toBe("RESERVATION_NOT_FOUND");
  });

  it("returns 404 for an unknown ticket type", async () => {
    const { app } = makeTestApp();
    const { event } = await createEventWithTicketType();

    const result = await hold(app, event.id, crypto.randomUUID());

    expect(result.status).toBe(404);
    expect(result.data.code).toBe("TICKET_TYPE_NOT_FOUND");
  });

  it("rejects a ticket type that belongs to another event", async () => {
    const { app } = makeTestApp();
    const first = await createEventWithTicketType();
    const second = await createEventWithTicketType();

    const result = await hold(app, first.event.id, second.ticketType.id);

    expect(result.status).toBe(409);
    expect(result.data.code).toBe("TICKET_TYPE_EVENT_MISMATCH");
  });

  it("requires the shared service token", async () => {
    const { app } = makeTestApp();
    const { event, ticketType } = await createEventWithTicketType();

    const result = await call(app, "/internal/reservations", {
      method: "POST",
      body: reservationBody(event.id, ticketType.id),
    });

    expect(result.status).toBe(401);
    expect(result.data.code).toBe("UNAUTHORIZED_SERVICE");
  });
});
