import crypto from "node:crypto";
import { describe, expect, it } from "bun:test";
import {
  call,
  createEventViaApi,
  createEventWithTicketType,
  futureIso,
  makeTestApp,
  organizerHeaders,
  serviceHeaders,
} from "./helpers";

function eventBody(overrides: Record<string, unknown> = {}) {
  return {
    name: `Event ${crypto.randomUUID()}`,
    venue: "Test Venue",
    startTime: futureIso(24),
    endTime: futureIso(30),
    maxCapacity: 100,
    ...overrides,
  };
}

describe("event endpoints", () => {
  it("lists events ordered by start time", async () => {
    const { app } = makeTestApp();
    const created = await createEventViaApi(app);

    const result = await call(app, "/api/events");

    expect(result.status).toBe(200);
    expect(result.data.events.some((event: { id: string }) => event.id === created.id)).toBe(true);
    const startTimes = result.data.events.map((event: { startTime: string }) =>
      Date.parse(event.startTime)
    );
    expect([...startTimes].sort((a: number, b: number) => a - b)).toEqual(startTimes);
  });

  it("creates an event with rooms, sessions and ticket types", async () => {
    const { app } = makeTestApp();
    const startTime = futureIso(24);
    const endTime = futureIso(30);

    const result = await call(app, "/api/events", {
      method: "POST",
      headers: organizerHeaders(),
      body: {
        name: "Launch Day",
        venue: "Hall A",
        startTime,
        endTime,
        maxCapacity: 50,
        rooms: [{ name: "Main Hall", capacity: 50 }],
        sessions: [
          {
            title: "Opening",
            speaker: "Alex",
            startTime,
            endTime: futureIso(26),
            isLive: true,
          },
        ],
        ticketTypes: [{ name: "Standard", price: 25, quota: 40 }],
      },
    });

    expect(result.status).toBe(201);
    expect(result.data.event.name).toBe("Launch Day");
    expect(result.data.event.reservedCount).toBe(0);
    expect(result.data.event.rooms).toHaveLength(1);
    expect(result.data.event.sessions).toHaveLength(1);
    expect(result.data.event.sessions[0].isLive).toBe(true);
    expect(result.data.event.ticketTypes).toHaveLength(1);
    expect(result.data.event.ticketTypes[0].soldCount).toBe(0);
    expect(result.data.event.ticketTypes[0].available).toBe(40);
  });

  it("rejects callers that are not organizers", async () => {
    const { app } = makeTestApp();

    const anonymous = await call(app, "/api/events", {
      method: "POST",
      body: eventBody(),
    });
    const attendee = await call(app, "/api/events", {
      method: "POST",
      headers: { "x-user-role": "ATTENDEE" },
      body: eventBody(),
    });

    expect(anonymous.status).toBe(403);
    expect(anonymous.data.code).toBe("FORBIDDEN");
    expect(attendee.status).toBe(403);
    expect(attendee.data.code).toBe("FORBIDDEN");
  });

  it("rejects an event whose start is not before its end", async () => {
    const { app } = makeTestApp();

    const result = await call(app, "/api/events", {
      method: "POST",
      headers: organizerHeaders(),
      body: eventBody({ startTime: futureIso(30), endTime: futureIso(24) }),
    });

    expect(result.status).toBe(422);
    expect(result.data.code).toBe("INVALID_EVENT_TIME");
  });

  it("rejects an event that starts in the past", async () => {
    const { app } = makeTestApp();

    const result = await call(app, "/api/events", {
      method: "POST",
      headers: organizerHeaders(),
      body: eventBody({
        startTime: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        endTime: futureIso(2),
      }),
    });

    expect(result.status).toBe(422);
    expect(result.data.code).toBe("INVALID_EVENT_TIME");
  });

  it("rejects a nested session whose start is not before its end", async () => {
    const { app } = makeTestApp();

    const result = await call(app, "/api/events", {
      method: "POST",
      headers: organizerHeaders(),
      body: eventBody({
        sessions: [
          {
            title: "Broken",
            speaker: "Alex",
            startTime: futureIso(28),
            endTime: futureIso(26),
          },
        ],
      }),
    });

    expect(result.status).toBe(422);
    expect(result.data.code).toBe("INVALID_SESSION_TIME");
  });

  it("returns event detail and 404 for an unknown id", async () => {
    const { app } = makeTestApp();
    const created = await createEventViaApi(app);

    const found = await call(app, `/api/events/${created.id}`);
    const missing = await call(app, `/api/events/${crypto.randomUUID()}`);

    expect(found.status).toBe(200);
    expect(found.data.event.id).toBe(created.id);
    expect(missing.status).toBe(404);
    expect(missing.data.code).toBe("EVENT_NOT_FOUND");
  });

  it("updates an event and validates the resulting time window", async () => {
    const { app } = makeTestApp();
    const created = await createEventViaApi(app);

    const updated = await call(app, `/api/events/${created.id}`, {
      method: "PATCH",
      headers: organizerHeaders(),
      body: { name: "Renamed", maxCapacity: 200 },
    });
    expect(updated.status).toBe(200);
    expect(updated.data.event.name).toBe("Renamed");
    expect(updated.data.event.maxCapacity).toBe(200);

    const invalid = await call(app, `/api/events/${created.id}`, {
      method: "PATCH",
      headers: organizerHeaders(),
      body: { startTime: futureIso(40) },
    });
    expect(invalid.status).toBe(422);
    expect(invalid.data.code).toBe("INVALID_EVENT_TIME");
  });

  it("refuses to lower capacity below the reserved seats", async () => {
    const { app } = makeTestApp();
    const { event, ticketType } = await createEventWithTicketType({ maxCapacity: 10, quota: 10 });

    const held = await call(app, "/internal/reservations", {
      method: "POST",
      headers: serviceHeaders(),
      body: {
        operationId: crypto.randomUUID(),
        eventId: event.id,
        ticketTypeId: ticketType.id,
        quantity: 2,
      },
    });
    expect(held.status).toBe(201);

    const result = await call(app, `/api/events/${event.id}`, {
      method: "PATCH",
      headers: organizerHeaders(),
      body: { maxCapacity: 1 },
    });

    expect(result.status).toBe(409);
    expect(result.data.code).toBe("CAPACITY_BELOW_RESERVED");
  });

  it("adds a room, a session and a ticket type to an existing event", async () => {
    const { app } = makeTestApp();
    const created = await createEventViaApi(app);

    const room = await call(app, `/api/events/${created.id}/rooms`, {
      method: "POST",
      headers: organizerHeaders(),
      body: { name: "Side Room", capacity: 20 },
    });
    const session = await call(app, `/api/events/${created.id}/sessions`, {
      method: "POST",
      headers: organizerHeaders(),
      body: {
        title: "Workshop",
        speaker: "Bao",
        startTime: futureIso(25),
        endTime: futureIso(26),
      },
    });
    const ticketType = await call(app, `/api/events/${created.id}/ticket-types`, {
      method: "POST",
      headers: organizerHeaders(),
      body: { name: "VIP", price: 90, quota: 10 },
    });

    expect(room.status).toBe(201);
    expect(room.data.room.name).toBe("Side Room");
    expect(session.status).toBe(201);
    expect(session.data.session.title).toBe("Workshop");
    expect(ticketType.status).toBe(201);
    expect(ticketType.data.ticketType.available).toBe(10);

    const detail = await call(app, `/api/events/${created.id}`);
    expect(detail.data.event.rooms).toHaveLength(1);
    expect(detail.data.event.sessions).toHaveLength(1);
    expect(detail.data.event.ticketTypes).toHaveLength(2);
  });

  it("returns 404 when adding a child to an unknown event", async () => {
    const { app } = makeTestApp();
    const id = crypto.randomUUID();

    const room = await call(app, `/api/events/${id}/rooms`, {
      method: "POST",
      headers: organizerHeaders(),
      body: { name: "Ghost", capacity: 1 },
    });
    const session = await call(app, `/api/events/${id}/sessions`, {
      method: "POST",
      headers: organizerHeaders(),
      body: {
        title: "Ghost",
        speaker: "Nobody",
        startTime: futureIso(25),
        endTime: futureIso(26),
      },
    });
    const ticketType = await call(app, `/api/events/${id}/ticket-types`, {
      method: "POST",
      headers: organizerHeaders(),
      body: { name: "Ghost", price: 1, quota: 1 },
    });

    for (const result of [room, session, ticketType]) {
      expect(result.status).toBe(404);
      expect(result.data.code).toBe("EVENT_NOT_FOUND");
    }
  });
});
