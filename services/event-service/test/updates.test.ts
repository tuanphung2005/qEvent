import crypto from "node:crypto";
import { describe, expect, it } from "bun:test";
import {
  call,
  createEventWithTicketType,
  futureIso,
  makeTestApp,
  organizerHeaders,
  prisma,
  serviceHeaders,
} from "./helpers";

async function createFullEvent(app: ReturnType<typeof makeTestApp>["app"]) {
  const result = await call(app, "/api/events", {
    method: "POST",
    headers: organizerHeaders(),
    body: {
      name: `Event ${crypto.randomUUID()}`,
      venue: "Test Venue",
      startTime: futureIso(24),
      endTime: futureIso(30),
      maxCapacity: 100,
      rooms: [{ name: "Main Hall", capacity: 100 }],
      sessions: [
        {
          title: "Opening",
          speaker: "Alex",
          startTime: futureIso(25),
          endTime: futureIso(26),
          isLive: false,
        },
      ],
      ticketTypes: [{ name: "Standard", price: 10, quota: 100 }],
    },
  });
  if (result.status !== 201) throw new Error(JSON.stringify(result.data));
  return result.data.event;
}

describe("event child updates", () => {
  it("updates a room and rejects a room from another event", async () => {
    const { app } = makeTestApp();
    const event = await createFullEvent(app);
    const room = event.rooms[0];

    const updated = await call(app, `/api/events/${event.id}/rooms/${room.id}`, {
      method: "PATCH",
      headers: organizerHeaders(),
      body: { name: "Renamed Hall", capacity: 250 },
    });
    expect(updated.status).toBe(200);
    expect(updated.data.room.name).toBe("Renamed Hall");
    expect(updated.data.room.capacity).toBe(250);

    const other = await createFullEvent(app);
    const wrongEvent = await call(app, `/api/events/${other.id}/rooms/${room.id}`, {
      method: "PATCH",
      headers: organizerHeaders(),
      body: { name: "Nope" },
    });
    expect(wrongEvent.status).toBe(404);
    expect(wrongEvent.data.code).toBe("ROOM_NOT_FOUND");

    const forbidden = await call(app, `/api/events/${event.id}/rooms/${room.id}`, {
      method: "PATCH",
      body: { name: "Nope" },
    });
    expect(forbidden.status).toBe(403);
  });

  it("toggles a session live and validates the resulting time window", async () => {
    const { app } = makeTestApp();
    const event = await createFullEvent(app);
    const session = event.sessions[0];

    const live = await call(app, `/api/events/${event.id}/sessions/${session.id}`, {
      method: "PATCH",
      headers: organizerHeaders(),
      body: { isLive: true, speaker: "New Speaker" },
    });
    expect(live.status).toBe(200);
    expect(live.data.session.isLive).toBe(true);
    expect(live.data.session.speaker).toBe("New Speaker");

    const invalid = await call(app, `/api/events/${event.id}/sessions/${session.id}`, {
      method: "PATCH",
      headers: organizerHeaders(),
      body: { startTime: futureIso(40) },
    });
    expect(invalid.status).toBe(422);
    expect(invalid.data.code).toBe("INVALID_SESSION_TIME");
  });

  it("updates a ticket type and refuses a quota below the sold count", async () => {
    const { app } = makeTestApp();
    const { event, ticketType } = await createEventWithTicketType({
      maxCapacity: 10,
      quota: 10,
    });

    const held = await call(app, "/internal/reservations", {
      method: "POST",
      headers: serviceHeaders(),
      body: {
        operationId: crypto.randomUUID(),
        eventId: event.id,
        ticketTypeId: ticketType.id,
        quantity: 3,
      },
    });
    expect(held.status).toBe(201);

    const updated = await call(
      app,
      `/api/events/${event.id}/ticket-types/${ticketType.id}`,
      {
        method: "PATCH",
        headers: organizerHeaders(),
        body: { name: "VIP", price: 40, quota: 5 },
      }
    );
    expect(updated.status).toBe(200);
    expect(updated.data.ticketType.name).toBe("VIP");
    expect(updated.data.ticketType.available).toBe(2);

    const tooLow = await call(
      app,
      `/api/events/${event.id}/ticket-types/${ticketType.id}`,
      {
        method: "PATCH",
        headers: organizerHeaders(),
        body: { quota: 2 },
      }
    );
    expect(tooLow.status).toBe(409);
    expect(tooLow.data.code).toBe("QUOTA_BELOW_SOLD");

    const stored = await prisma.ticketType.findUniqueOrThrow({ where: { id: ticketType.id } });
    expect(stored.quota).toBe(5);
  });
});
