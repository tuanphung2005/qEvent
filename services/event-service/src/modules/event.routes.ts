import { Elysia, t } from "elysia";
import type { Deps } from "../deps";
import { requireOrganizer } from "../lib/auth";
import {
  addRoom,
  addSession,
  addTicketType,
  createEvent,
  getEvent,
  listEvents,
  updateEvent,
} from "../services/event.service";

const time = t.String({ minLength: 1 });

const roomSchema = t.Object({ name: t.String({ minLength: 1 }), capacity: t.Integer({ minimum: 1 }) });

const sessionSchema = t.Object({
  title: t.String({ minLength: 1 }),
  speaker: t.String({ minLength: 1 }),
  startTime: time,
  endTime: time,
  isLive: t.Optional(t.Boolean()),
});

const ticketTypeSchema = t.Object({
  name: t.String({ minLength: 1 }),
  price: t.Number({ minimum: 0 }),
  quota: t.Integer({ minimum: 1 }),
});

const eventBody = t.Object({
  name: t.String({ minLength: 1 }),
  venue: t.String({ minLength: 1 }),
  startTime: time,
  endTime: time,
  maxCapacity: t.Integer({ minimum: 1 }),
  rooms: t.Optional(t.Array(roomSchema)),
  sessions: t.Optional(t.Array(sessionSchema)),
  ticketTypes: t.Optional(t.Array(ticketTypeSchema)),
});

const eventUpdateBody = t.Object({
  name: t.Optional(t.String({ minLength: 1 })),
  venue: t.Optional(t.String({ minLength: 1 })),
  startTime: t.Optional(time),
  endTime: t.Optional(time),
  maxCapacity: t.Optional(t.Integer({ minimum: 1 })),
});

const idParams = t.Object({ id: t.String({ minLength: 1 }) });

export function eventRoutes(deps: Deps) {
  return new Elysia({ tags: ["events"] })
    .get("/api/events", async () => ({ events: await listEvents(deps) }))
    .get(
      "/api/events/:id",
      async ({ params, set }) => {
        const result = await getEvent(deps, params.id);
        set.status = result.status;
        return result.body;
      },
      { params: idParams }
    )
    .post(
      "/api/events",
      async ({ body, headers, set }) => {
        const denied = requireOrganizer(headers, set);
        if (denied) return denied;
        const result = await createEvent(deps, body);
        set.status = result.status;
        return result.body;
      },
      { body: eventBody }
    )
    .patch(
      "/api/events/:id",
      async ({ body, headers, params, set }) => {
        const denied = requireOrganizer(headers, set);
        if (denied) return denied;
        const result = await updateEvent(deps, params.id, body);
        set.status = result.status;
        return result.body;
      },
      { body: eventUpdateBody, params: idParams }
    )
    .post(
      "/api/events/:id/rooms",
      async ({ body, headers, params, set }) => {
        const denied = requireOrganizer(headers, set);
        if (denied) return denied;
        const result = await addRoom(deps, params.id, body);
        set.status = result.status;
        return result.body;
      },
      { body: roomSchema, params: idParams }
    )
    .post(
      "/api/events/:id/sessions",
      async ({ body, headers, params, set }) => {
        const denied = requireOrganizer(headers, set);
        if (denied) return denied;
        const result = await addSession(deps, params.id, body);
        set.status = result.status;
        return result.body;
      },
      { body: sessionSchema, params: idParams }
    )
    .post(
      "/api/events/:id/ticket-types",
      async ({ body, headers, params, set }) => {
        const denied = requireOrganizer(headers, set);
        if (denied) return denied;
        const result = await addTicketType(deps, params.id, body);
        set.status = result.status;
        return result.body;
      },
      { body: ticketTypeSchema, params: idParams }
    );
}
