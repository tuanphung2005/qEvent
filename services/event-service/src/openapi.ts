import type { swagger } from "@elysiajs/swagger";

type Documentation = NonNullable<
  NonNullable<Parameters<typeof swagger>[0]>["documentation"]
>;
type JsonSchema = Record<string, any>;

const SCHEMA_REF = "#/components/schemas/";
const ref = (name: string): JsonSchema => ({ $ref: SCHEMA_REF + name });

const obj = (
  properties: Record<string, JsonSchema>,
  required: string[] = Object.keys(properties)
): JsonSchema => ({ type: "object", required, properties });
const arr = (items: JsonSchema, extra: JsonSchema = {}): JsonSchema => ({
  type: "array",
  items,
  ...extra,
});
const str = (extra: JsonSchema = {}): JsonSchema => ({ type: "string", ...extra });
const en = (...values: string[]): JsonSchema => ({ type: "string", enum: values });
const int = (extra: JsonSchema = {}): JsonSchema => ({ type: "integer", ...extra });
const num = (extra: JsonSchema = {}): JsonSchema => ({ type: "number", ...extra });
const bool = (): JsonSchema => ({ type: "boolean" });

const uuid = str({ format: "uuid" });
const dateTime = str({ format: "date-time" });

const schemas: Record<string, JsonSchema> = {
  ErrorBody: obj({
    code: str({ example: "SOLD_OUT" }),
    message: str({ example: "Ticket type or event capacity is exhausted" }),
  }),
  ValidationError: obj(
    {
      type: str({ example: "validation" }),
      on: str({ example: "body" }),
      property: str({ example: "/maxCapacity" }),
      message: str({ example: "Expected number to be greater or equal to 1" }),
      summary: str(),
      expected: { type: "object", additionalProperties: true },
      found: { type: "object", additionalProperties: true },
      errors: arr({ type: "object", additionalProperties: true }),
    },
    ["type", "on", "property", "message"]
  ),
  HealthResponse: obj({
    status: en("ok", "degraded"),
    service: str({ example: "event-service" }),
    database: en("ok", "unavailable"),
  }),
  Room: obj({
    id: uuid,
    name: str({ example: "Main Hall" }),
    capacity: int({ minimum: 1, example: 500 }),
  }),
  Session: obj({
    id: uuid,
    title: str({ example: "Opening Keynote" }),
    speaker: str({ example: "Alex Nguyen" }),
    startTime: dateTime,
    endTime: dateTime,
    isLive: bool(),
  }),
  TicketType: obj({
    id: uuid,
    name: str({ example: "Standard" }),
    price: num({ minimum: 0, example: 25 }),
    quota: int({ minimum: 1, example: 500 }),
    soldCount: int({ minimum: 0, example: 12 }),
    available: int({ minimum: 0, example: 488 }),
  }),
  Event: obj({
    id: uuid,
    name: str({ example: "Tech Summit Vietnam 2026" }),
    venue: str({ example: "Saigon Exhibition and Convention Center" }),
    startTime: dateTime,
    endTime: dateTime,
    maxCapacity: int({ minimum: 1, example: 500 }),
    reservedCount: int({ minimum: 0, example: 12 }),
    createdAt: dateTime,
    rooms: arr(ref("Room")),
    sessions: arr(ref("Session")),
    ticketTypes: arr(ref("TicketType")),
  }),
  EventResponse: obj({ event: ref("Event") }),
  EventListResponse: obj({ events: arr(ref("Event")) }),
  RoomRequest: obj({
    name: str({ minLength: 1 }),
    capacity: int({ minimum: 1 }),
  }),
  RoomResponse: obj({ room: ref("Room") }),
  SessionRequest: obj({
    title: str({ minLength: 1 }),
    speaker: str({ minLength: 1 }),
    startTime: dateTime,
    endTime: dateTime,
    isLive: bool(),
  }),
  SessionResponse: obj({ session: ref("Session") }),
  TicketTypeRequest: obj({
    name: str({ minLength: 1 }),
    price: num({ minimum: 0 }),
    quota: int({ minimum: 1 }),
  }),
  TicketTypeResponse: obj({ ticketType: ref("TicketType") }),
  CreateEventRequest: obj({
    name: str({ minLength: 1 }),
    venue: str({ minLength: 1 }),
    startTime: dateTime,
    endTime: dateTime,
    maxCapacity: int({ minimum: 1 }),
    rooms: arr(ref("RoomRequest")),
    sessions: arr(ref("SessionRequest")),
    ticketTypes: arr(ref("TicketTypeRequest")),
  }),
  UpdateEventRequest: {
    type: "object",
    minProperties: 1,
    properties: {
      name: str({ minLength: 1 }),
      venue: str({ minLength: 1 }),
      startTime: dateTime,
      endTime: dateTime,
      maxCapacity: int({ minimum: 1 }),
    },
  },
  UpdateRoomRequest: obj(
    {
      name: str({ minLength: 1 }),
      capacity: int({ minimum: 1 }),
    },
    []
  ),
  UpdateSessionRequest: obj(
    {
      title: str({ minLength: 1 }),
      speaker: str({ minLength: 1 }),
      startTime: dateTime,
      endTime: dateTime,
      isLive: bool(),
    },
    []
  ),
  UpdateTicketTypeRequest: obj(
    {
      name: str({ minLength: 1 }),
      price: num({ minimum: 0 }),
      quota: int({ minimum: 1 }),
    },
    []
  ),
  ReservationRequest: obj({
    operationId: str({ minLength: 1 }),
    eventId: str({ minLength: 1 }),
    ticketTypeId: str({ minLength: 1 }),
    quantity: int({ minimum: 1, example: 1 }),
  }),
  Reservation: obj({
    id: uuid,
    operationId: str({ example: "3f6f2f0e-9b2a-4c6d-8e1a-2b3c4d5e6f70" }),
    eventId: uuid,
    ticketTypeId: uuid,
    quantity: int({ minimum: 1 }),
    status: en("CONFIRMED", "RELEASED"),
    expiresAt: dateTime,
    createdAt: dateTime,
    unitPrice: num({ minimum: 0, example: 25 }),
  }),
  ReservationResponse: obj({ reservation: ref("Reservation") }),
  InternalSessionResponse: obj({
    session: obj({
      id: uuid,
      title: str({ example: "Opening Keynote" }),
      speaker: str({ example: "Alex Nguyen" }),
      startTime: dateTime,
      endTime: dateTime,
      isLive: bool(),
      event: obj({
        id: uuid,
        name: str({ example: "Tech Summit Vietnam 2026" }),
        startTime: dateTime,
        endTime: dateTime,
      }),
    }),
  }),
};

const overrides: Record<string, unknown> = {
  "Event.ticketTypes": [
    {
      id: "44444444-4444-4444-8444-444444444444",
      name: "Standard",
      price: 25,
      quota: 500,
      soldCount: 12,
      available: 488,
    },
  ],
  "Event.reservedCount": 12,
  "TicketType.soldCount": 12,
  "TicketType.available": 488,
};

let uuidSeq = 0;
const nextUuid = () =>
  `00000000-0000-4000-8000-${String(++uuidSeq).padStart(12, "0")}`;

function sampleString(schema: JsonSchema, key: string): string {
  if (schema.format === "uuid") return nextUuid();
  if (schema.format === "date-time") return "2026-11-09T08:00:00.000Z";
  return "string";
}

function sampleValue(schema: JsonSchema, path: string): any {
  if (typeof schema.$ref === "string") {
    const name = schema.$ref.startsWith(SCHEMA_REF)
      ? schema.$ref.slice(SCHEMA_REF.length)
      : "";
    return name && schemas[name] ? sampleValue(schemas[name], name) : {};
  }
  if (Object.prototype.hasOwnProperty.call(overrides, path)) {
    return structuredClone(overrides[path]);
  }
  if (schema.example !== undefined) return structuredClone(schema.example);
  if (schema.default !== undefined) return schema.default;
  if (Array.isArray(schema.oneOf)) return sampleValue(schema.oneOf[0], path);
  if (Array.isArray(schema.enum)) return schema.enum[0];
  if (schema.type === "object") {
    const value: Record<string, any> = {};
    for (const [key, child] of Object.entries<JsonSchema>(schema.properties ?? {})) {
      value[key] = sampleValue(child, path ? `${path}.${key}` : key);
    }
    return value;
  }
  if (schema.type === "array") {
    return schema.items ? [sampleValue(schema.items, path)] : [];
  }
  if (schema.type === "integer" || schema.type === "number") {
    return schema.minimum ?? 1;
  }
  if (schema.type === "boolean") return true;
  return sampleString(schema, path.split(".").pop() ?? "");
}

function merge(base: any, patch: any): any {
  if (patch === undefined) return base;
  if (patch === null || typeof patch !== "object") return patch;
  if (Array.isArray(patch)) return patch;
  if (!base || typeof base !== "object" || Array.isArray(base)) return patch;
  const merged: Record<string, any> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    merged[key] = merge(base[key], value);
  }
  return merged;
}

const media = (schema: JsonSchema, example: unknown) => ({
  "application/json": { schema, example },
});

const ok = (description: string, schemaName: string, patch?: JsonSchema) => ({
  description,
  content: media(ref(schemaName), merge(sampleValue(ref(schemaName), schemaName), patch)),
});

const fail = (description: string, code: string, message: string) => ({
  description,
  content: media(ref("ErrorBody"), { code, message }),
});

const examples = (
  description: string,
  schema: JsonSchema,
  values: Record<string, unknown>
) => ({
  description,
  content: {
    "application/json": {
      schema,
      examples: Object.fromEntries(
        Object.entries(values).map(([label, value]) => [label, { value }])
      ),
    },
  },
});

const body = (schemaName: string, patch?: JsonSchema) => ({
  required: true,
  content: media(ref(schemaName), merge(sampleValue(ref(schemaName), schemaName), patch)),
});

const idParameter = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "string", format: "uuid" },
};
const operationParameter = {
  name: "operationId",
  in: "path",
  required: true,
  schema: { type: "string" },
};
const organizerHeader = {
  name: "x-user-role",
  in: "header",
  required: true,
  schema: { type: "string", enum: ["ORGANIZER"] },
  description:
    "Forwarded by the API Gateway after JWT verification. The service rejects other roles with 403.",
};
const bearer = [{ bearerAuth: [] }];
const serviceAuth = [{ serviceToken: [] }];

const unauthorized = { $ref: "#/components/responses/Unauthorized" };
const forbidden = { $ref: "#/components/responses/Forbidden" };
const serviceUnauthorized = { $ref: "#/components/responses/ServiceUnauthorized" };
const validationFailed = { $ref: "#/components/responses/ValidationFailed" };

const components = {
  securitySchemes: {
    bearerAuth: {
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
      description: "JWT verified by the API Gateway before the request is forwarded.",
    },
    serviceToken: {
      type: "apiKey",
      in: "header",
      name: "x-service-token",
      description: "Shared service credential for internal endpoints.",
    },
  },
  schemas,
  responses: {
    Unauthorized: fail(
      "Authentication is missing or the JWT is invalid.",
      "UNAUTHORIZED",
      "Authentication is required"
    ),
    Forbidden: fail(
      "The caller is not an ORGANIZER.",
      "FORBIDDEN",
      "Organizer role is required"
    ),
    ServiceUnauthorized: fail(
      "The service token is missing or invalid.",
      "UNAUTHORIZED_SERVICE",
      "Valid service token is required"
    ),
    ValidationFailed: {
      description: "The request body or parameters do not satisfy the declared schema.",
      content: media(
        ref("ValidationError"),
        sampleValue(ref("ValidationError"), "ValidationError")
      ),
    },
  },
};

const paths = {
  "/health": {
    get: {
      tags: ["health"],
      summary: "Report service and database readiness",
      operationId: "getHealth",
      responses: {
        "200": ok("Service and database are reachable.", "HealthResponse"),
        "503": ok("Database is unavailable.", "HealthResponse", {
          status: "degraded",
          database: "unavailable",
        }),
      },
    },
  },
  "/api/events": {
    get: {
      tags: ["events"],
      summary: "List events",
      description: "Public. Returns events ordered by start time.",
      operationId: "listEvents",
      responses: {
        "200": ok("Events ordered by start time.", "EventListResponse"),
      },
    },
    post: {
      tags: ["events"],
      summary: "Create an event with optional rooms, sessions and ticket types",
      description:
        "Requires the ORGANIZER role. `startTime` must be before `endTime` and must not be in the past, otherwise `422 INVALID_EVENT_TIME` is returned.",
      operationId: "createEvent",
      security: bearer,
      parameters: [organizerHeader],
      requestBody: body("CreateEventRequest"),
      responses: {
        "201": ok("Event created.", "EventResponse"),
        "401": unauthorized,
        "403": forbidden,
        "422": examples(
          "The event or session time is invalid.",
          ref("ErrorBody"),
          {
            invalidEventTime: {
              code: "INVALID_EVENT_TIME",
              message: "Start time must be before end time",
            },
            invalidSessionTime: {
              code: "INVALID_SESSION_TIME",
              message: "Session start time must be before end time",
            },
          }
        ),
      },
    },
  },
  "/api/events/{id}": {
    get: {
      tags: ["events"],
      summary: "Get an event with rooms, sessions and ticket types",
      operationId: "getEvent",
      parameters: [idParameter],
      responses: {
        "200": ok("Event found.", "EventResponse"),
        "404": fail("The event does not exist.", "EVENT_NOT_FOUND", "Event was not found"),
      },
    },
    patch: {
      tags: ["events"],
      summary: "Update an event",
      description:
        "Requires the ORGANIZER role. Capacity cannot be lowered below the number of reserved seats.",
      operationId: "updateEvent",
      security: bearer,
      parameters: [idParameter, organizerHeader],
      requestBody: body("UpdateEventRequest"),
      responses: {
        "200": ok("Event updated.", "EventResponse"),
        "401": unauthorized,
        "403": forbidden,
        "404": fail("The event does not exist.", "EVENT_NOT_FOUND", "Event was not found"),
        "409": fail(
          "The new capacity is lower than the reserved seats.",
          "CAPACITY_BELOW_RESERVED",
          "maxCapacity cannot be lower than the number of reserved seats"
        ),
        "422": fail(
          "The event time is invalid.",
          "INVALID_EVENT_TIME",
          "Start time must be before end time"
        ),
      },
    },
  },
  "/api/events/{id}/rooms": {
    post: {
      tags: ["events"],
      summary: "Add a room to an event",
      operationId: "addRoom",
      security: bearer,
      parameters: [idParameter, organizerHeader],
      requestBody: body("RoomRequest"),
      responses: {
        "201": ok("Room added.", "RoomResponse"),
        "401": unauthorized,
        "403": forbidden,
        "404": fail("The event does not exist.", "EVENT_NOT_FOUND", "Event was not found"),
        "422": validationFailed,
      },
    },
  },
  "/api/events/{id}/sessions": {
    post: {
      tags: ["events"],
      summary: "Add a session to an event",
      operationId: "addSession",
      security: bearer,
      parameters: [idParameter, organizerHeader],
      requestBody: body("SessionRequest"),
      responses: {
        "201": ok("Session added.", "SessionResponse"),
        "401": unauthorized,
        "403": forbidden,
        "404": fail("The event does not exist.", "EVENT_NOT_FOUND", "Event was not found"),
        "422": fail(
          "The session time is invalid.",
          "INVALID_SESSION_TIME",
          "Session start time must be before end time"
        ),
      },
    },
  },
  "/api/events/{id}/ticket-types": {
    post: {
      tags: ["events"],
      summary: "Add a ticket type to an event",
      operationId: "addTicketType",
      security: bearer,
      parameters: [idParameter, organizerHeader],
      requestBody: body("TicketTypeRequest"),
      responses: {
        "201": ok("Ticket type added.", "TicketTypeResponse"),
        "401": unauthorized,
        "403": forbidden,
        "404": fail("The event does not exist.", "EVENT_NOT_FOUND", "Event was not found"),
        "422": validationFailed,
      },
    },
  },
  "/api/events/{id}/rooms/{roomId}": {
    patch: {
      tags: ["events"],
      summary: "Update a room",
      operationId: "updateRoom",
      security: bearer,
      parameters: [
        idParameter,
        { name: "roomId", in: "path", required: true, schema: { type: "string" } },
        organizerHeader,
      ],
      requestBody: body("UpdateRoomRequest"),
      responses: {
        "200": ok("Room updated.", "RoomResponse"),
        "401": unauthorized,
        "403": forbidden,
        "404": fail("The room does not belong to this event.", "ROOM_NOT_FOUND", "Room was not found"),
        "422": validationFailed,
      },
    },
  },
  "/api/events/{id}/sessions/{sessionId}": {
    patch: {
      tags: ["events"],
      summary: "Update a session, including its live flag",
      description:
        "Partial update. When either time is supplied the merged start/end must still be valid. `isLive` toggles attendee interaction for that session.",
      operationId: "updateSession",
      security: bearer,
      parameters: [
        idParameter,
        { name: "sessionId", in: "path", required: true, schema: { type: "string" } },
        organizerHeader,
      ],
      requestBody: body("UpdateSessionRequest"),
      responses: {
        "200": ok("Session updated.", "SessionResponse"),
        "401": unauthorized,
        "403": forbidden,
        "404": fail(
          "The session does not belong to this event.",
          "SESSION_NOT_FOUND",
          "Session was not found"
        ),
        "422": fail(
          "The resulting session time is invalid.",
          "INVALID_SESSION_TIME",
          "Session start time must be before end time"
        ),
      },
    },
  },
  "/api/events/{id}/ticket-types/{ticketTypeId}": {
    patch: {
      tags: ["events"],
      summary: "Update a ticket type",
      description: "`quota` cannot be lower than the number of tickets already sold.",
      operationId: "updateTicketType",
      security: bearer,
      parameters: [
        idParameter,
        { name: "ticketTypeId", in: "path", required: true, schema: { type: "string" } },
        organizerHeader,
      ],
      requestBody: body("UpdateTicketTypeRequest"),
      responses: {
        "200": ok("Ticket type updated.", "TicketTypeResponse"),
        "401": unauthorized,
        "403": forbidden,
        "404": fail(
          "The ticket type does not belong to this event.",
          "TICKET_TYPE_NOT_FOUND",
          "Ticket type was not found"
        ),
        "409": fail(
          "The new quota is below the sold count.",
          "QUOTA_BELOW_SOLD",
          "quota cannot be lower than the number of sold tickets"
        ),
        "422": validationFailed,
      },
    },
  },
  "/internal/reservations": {
    post: {
      tags: ["internal"],
      summary: "Atomically hold seats for an order",
      description:
        "Used by the Admission Service saga. The operation is idempotent per `operationId`: replaying the same payload returns the stored reservation, while a different payload returns `409 IDEMPOTENCY_CONFLICT`. Capacity is enforced with conditional updates on the event and ticket type inside one transaction, so concurrent callers cannot oversell.",
      operationId: "createReservation",
      security: serviceAuth,
      requestBody: body("ReservationRequest"),
      responses: {
        "201": ok("Seats held and reservation confirmed.", "ReservationResponse"),
        "200": ok("Existing reservation replayed for the same operationId.", "ReservationResponse"),
        "401": serviceUnauthorized,
        "404": fail(
          "The ticket type does not exist.",
          "TICKET_TYPE_NOT_FOUND",
          "Ticket type was not found"
        ),
        "409": examples(
          "Capacity is exhausted or the operationId conflicts with another payload.",
          ref("ErrorBody"),
          {
            soldOut: {
              code: "SOLD_OUT",
              message: "Ticket type or event capacity is exhausted",
            },
            idempotencyConflict: {
              code: "IDEMPOTENCY_CONFLICT",
              message: "operationId reused with a different payload",
            },
            ticketTypeEventMismatch: {
              code: "TICKET_TYPE_EVENT_MISMATCH",
              message: "Ticket type does not belong to the event",
            },
            reservationReleased: {
              code: "RESERVATION_RELEASED",
              message: "Reservation was already released and cannot be reused",
            },
          }
        ),
        "422": validationFailed,
      },
    },
  },
  "/internal/reservations/{operationId}": {
    delete: {
      tags: ["internal"],
      summary: "Release a reservation and return its seats",
      description:
        "Compensating action for the Admission saga. Releasing an already released reservation is idempotent and does not decrement the counters twice.",
      operationId: "releaseReservation",
      security: serviceAuth,
      parameters: [operationParameter],
      responses: {
        "200": ok("Reservation released.", "ReservationResponse"),
        "401": serviceUnauthorized,
        "404": fail(
          "The reservation does not exist.",
          "RESERVATION_NOT_FOUND",
          "Reservation was not found"
        ),
      },
    },
  },
  "/internal/events/{id}": {
    get: {
      tags: ["internal"],
      summary: "Read event metadata for another service",
      operationId: "getInternalEvent",
      security: serviceAuth,
      parameters: [idParameter],
      responses: {
        "200": ok("Event found.", "EventResponse"),
        "401": serviceUnauthorized,
        "404": fail("The event does not exist.", "EVENT_NOT_FOUND", "Event was not found"),
      },
    },
  },
  "/internal/sessions/{id}": {
    get: {
      tags: ["internal"],
      summary: "Read session metadata and its live flag",
      operationId: "getInternalSession",
      security: serviceAuth,
      parameters: [idParameter],
      responses: {
        "200": ok("Session found.", "InternalSessionResponse"),
        "401": serviceUnauthorized,
        "404": fail(
          "The session does not exist.",
          "SESSION_NOT_FOUND",
          "Session was not found"
        ),
      },
    },
  },
};

export const openapiDocumentation = {
  info: {
    title: "qEvent Event Service",
    version: "1.0.0",
    description:
      "Events, rooms, sessions, ticket types and atomic seat reservations. " +
      "The service owns `qevent_event` and never joins another service database. " +
      "Organizer endpoints trust the `x-user-role` header forwarded by the API Gateway after JWT verification. " +
      "Errors use `{ code, message }` except request validation failures, which return the Elysia validation payload.",
  },
  servers: [
    { url: "http://localhost:3001", description: "Direct service port (Docker network)" },
    { url: "http://localhost:8000", description: "API Gateway entry point" },
  ],
  tags: [
    { name: "events", description: "Event, room, session and ticket type management" },
    { name: "internal", description: "Service-to-service reservations and metadata" },
    { name: "health", description: "Service and database readiness" },
  ],
  components,
  paths,
} as Documentation;
