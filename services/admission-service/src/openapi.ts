import type { swagger } from "@elysiajs/swagger";

type Documentation = NonNullable<
  NonNullable<Parameters<typeof swagger>[0]>["documentation"]
>;
type JsonSchema = Record<string, any>;

// ---------------------------------------------------------------- schema kit
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
const nullableDateTime = str({ format: "date-time", nullable: true });

const schemas: Record<string, JsonSchema> = {
  ErrorBody: obj({
    code: str({ example: "ALREADY_CHECKED_IN" }),
    message: str({ example: "Ticket has already been checked in" }),
  }),
  ValidationError: obj(
    {
      type: str({ example: "validation" }),
      on: str({ example: "body" }),
      property: str({ example: "/password" }),
      message: str({ example: "Expected string length greater or equal to 8" }),
      summary: str(),
      expected: { type: "object", additionalProperties: true },
      found: { type: "object", additionalProperties: true },
      errors: arr({ type: "object", additionalProperties: true }),
    },
    ["type", "on", "property", "message"]
  ),
  HealthResponse: obj({
    status: en("ok", "degraded"),
    service: str({ example: "admission-service" }),
    database: en("ok", "unavailable"),
  }),
  RegisterRequest: obj(
    {
      email: str({ format: "email", minLength: 3 }),
      password: str({ format: "password", minLength: 8 }),
      fullName: str({ minLength: 1 }),
      role: str({
        description: "Ignored; public registration always creates an ATTENDEE.",
      }),
    },
    ["email", "password", "fullName"]
  ),
  LoginRequest: obj({
    email: str({ format: "email", minLength: 3 }),
    password: str({ minLength: 1 }),
  }),
  User: obj({
    id: uuid,
    email: str({ format: "email" }),
    fullName: str(),
    role: en("ORGANIZER", "STAFF", "ATTENDEE"),
  }),
  AuthResponse: obj({
    token: str({ description: "JWT valid for 12 hours." }),
    user: ref("User"),
  }),
  PlaceOrderRequest: obj(
    {
      eventId: str({ minLength: 1 }),
      ticketTypeId: str({ minLength: 1 }),
      quantity: int({ minimum: 1, maximum: 10, default: 1 }),
    },
    ["eventId", "ticketTypeId"]
  ),
  OrderTicket: obj({
    id: uuid,
    status: en("PENDING_PAYMENT", "PAID", "CHECKED_IN", "CANCELLED"),
    eventId: uuid,
    ticketTypeId: uuid,
    checkedInAt: nullableDateTime,
    createdAt: dateTime,
  }),
  Order: obj({
    id: uuid,
    userId: uuid,
    eventId: uuid,
    ticketTypeId: uuid,
    status: en(
      "PENDING",
      "PENDING_RECONCILIATION",
      "COMPENSATING",
      "CONFIRMED",
      "FAILED"
    ),
    quantity: int({ minimum: 1, maximum: 10 }),
    totalAmount: num({ example: 50 }),
    failureCode: str({ nullable: true, example: "SOLD_OUT" }),
    createdAt: dateTime,
    tickets: arr(ref("OrderTicket")),
  }),
  OrderResponse: obj({ order: ref("Order") }),
  TicketSummary: obj({
    id: uuid,
    eventId: uuid,
    ticketTypeId: uuid,
    status: en("PENDING_PAYMENT", "PAID", "CHECKED_IN", "CANCELLED"),
    orderStatus: str({ example: "CONFIRMED" }),
    checkedInAt: nullableDateTime,
    createdAt: dateTime,
  }),
  TicketListResponse: obj({ tickets: arr(ref("TicketSummary")) }),
  QrTokenResponse: obj({
    ticketId: uuid,
    qrToken: str({
      description:
        "Ticket-bound JWT signed with RSA-SHA256 and carrying a TOTP code for the current 30-second step.",
    }),
    expiresIn: int({ example: 30 }),
    status: en("PENDING_PAYMENT", "PAID", "CHECKED_IN", "CANCELLED"),
    checkedInAt: nullableDateTime,
  }),
  CheckinRequest: obj(
    {
      qrToken: str({ minLength: 1 }),
      deviceId: str(),
      gate: str(),
    },
    ["qrToken"]
  ),
  CheckinTicket: obj({
    id: uuid,
    status: en("CHECKED_IN"),
    checkedInAt: dateTime,
    attendeeName: str(),
  }),
  CheckinSuccess: obj({
    status: en("CHECKIN_SUCCESS"),
    code: en("CHECKIN_SUCCESS"),
    ticket: ref("CheckinTicket"),
    logId: uuid,
  }),
  CheckinConflict: obj({
    code: en("ALREADY_CHECKED_IN"),
    message: str(),
    ticket: obj({
      id: uuid,
      status: en("CHECKED_IN"),
      checkedInAt: nullableDateTime,
      attendeeName: str(),
    }),
  }),
  OfflineSyncRequest: obj({
    logs: arr(
      obj(
        {
          ticketId: str({ minLength: 1 }),
          scannedAt: dateTime,
          deviceId: str(),
        },
        ["ticketId", "scannedAt"]
      ),
      { minItems: 1 }
    ),
  }),
  OfflineSyncResult: obj(
    {
      ticketId: str(),
      status: en("SYNCED", "CONFLICT", "DUPLICATE", "ERROR"),
      reason: str({ example: "TICKET_NOT_FOUND" }),
      message: str(),
      attendeeName: str(),
      logId: uuid,
    },
    ["ticketId", "status"]
  ),
  OfflineSyncResponse: obj({
    processed: int({ example: 2 }),
    synced: int({ example: 1 }),
    conflicts: int({ example: 1 }),
    duplicates: int({ example: 0 }),
    results: arr(ref("OfflineSyncResult")),
  }),
  InternalAccessResponse: obj({
    userId: uuid,
    eventId: uuid,
    checkedIn: bool(),
    hasAccess: bool(),
    ticketId: str({ format: "uuid", nullable: true }),
  }),
  Attendee: obj({
    id: uuid,
    email: str({ format: "email" }),
    fullName: str(),
  }),
  AuthMeResponse: obj({ user: ref("User") }),
  StaffOrder: obj({
    id: uuid,
    attendee: ref("Attendee"),
    status: en("PENDING", "PENDING_RECONCILIATION", "COMPENSATING", "CONFIRMED", "FAILED"),
    quantity: int({ minimum: 1, maximum: 10 }),
    totalAmount: num({ example: 50 }),
    failureCode: str({ nullable: true, example: "SOLD_OUT" }),
    createdAt: dateTime,
    updatedAt: dateTime,
    ticketsCount: int({ minimum: 0, example: 2 }),
  }),
  OrderListResponse: obj({
    orders: arr(ref("StaffOrder")),
    nextCursor: str({ nullable: true }),
  }),
  StaffTicket: obj({
    id: uuid,
    eventId: uuid,
    ticketTypeId: uuid,
    orderId: uuid,
    status: en("PENDING_PAYMENT", "PAID", "CHECKED_IN", "CANCELLED"),
    orderStatus: str({ example: "CONFIRMED" }),
    checkedInAt: nullableDateTime,
    createdAt: dateTime,
    attendee: ref("Attendee"),
  }),
  StaffTicketListResponse: obj({
    tickets: arr(ref("StaffTicket")),
    nextCursor: str({ nullable: true }),
  }),
  StaffOrderDetail: obj({
    id: uuid,
    status: en("PENDING", "PENDING_RECONCILIATION", "COMPENSATING", "CONFIRMED", "FAILED"),
    quantity: int({ minimum: 1 }),
    totalAmount: num({ example: 50 }),
    createdAt: dateTime,
  }),
  CheckinLog: obj({
    id: uuid,
    scannedBy: uuid,
    scannedAt: dateTime,
    isOffline: bool(),
    deviceId: str({ nullable: true, example: "gate-1" }),
    syncStatus: en("SYNCED", "CONFLICT"),
  }),
  TicketDetailResponse: obj({
    ticket: ref("StaffTicket"),
    order: ref("StaffOrderDetail"),
    checkinLogs: arr(ref("CheckinLog")),
  }),
  CheckinFeedItem: obj({
    id: uuid,
    ticketId: uuid,
    scannedAt: dateTime,
    isOffline: bool(),
    syncStatus: en("SYNCED", "CONFLICT"),
    deviceId: str({ nullable: true, example: "gate-1" }),
    attendee: ref("Attendee"),
    ticketStatus: en("PENDING_PAYMENT", "PAID", "CHECKED_IN", "CANCELLED"),
  }),
  CheckinFeedResponse: obj({
    checkins: arr(ref("CheckinFeedItem")),
    nextCursor: str({ nullable: true }),
  }),
  AdmissionStatsResponse: obj({
    eventId: uuid,
    tickets: obj({
      total: int({ minimum: 0, example: 100 }),
      checkedIn: int({ minimum: 0, example: 42 }),
      remaining: int({ minimum: 0, example: 58 }),
    }),
    orders: obj({
      total: int({ minimum: 0, example: 80 }),
      confirmed: int({ minimum: 0, example: 75 }),
      pending: int({ minimum: 0, example: 3 }),
      failed: int({ minimum: 0, example: 2 }),
      soldTickets: int({ minimum: 0, example: 100 }),
    }),
    byGate: arr(
      obj({
        gate: str({ example: "gate-1" }),
        count: int({ minimum: 1, example: 30 }),
      })
    ),
    lastCheckinAt: nullableDateTime,
  }),
};

// ---------------------------------------------------------------- examples
const seed = {
  userId: "5f3b6e2a-1c4d-4a8e-9b7f-2d6c8a1e4b90",
  eventId: "7c1e9a3d-2b6f-4c8a-8e5d-3a9b1c7e2f60",
  ticketTypeId: "9a2d5c7e-4f1b-4e3a-8c6d-5b2e9f1a3c70",
  ticketId: "1b4d7f9a-3c6e-4a2b-8d5f-7e9c1a3b5d20",
  logId: "3d6f8b2c-5e9a-4c4d-8f7b-9a2e1c3d5f40",
};

const strings: Record<string, string> = {
  email: "attendee@qevent.dev",
  password: "password123",
  fullName: "Nguyen Van A",
  attendeeName: "Nguyen Van A",
  token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjVmM2I2ZSJ9.signature",
  qrToken:
    "eyJhbGciOiJSUzI1NiJ9.eyJ0aWQiOiIxYjRkN2Y5YSIsImVpZCI6IjdjMWU5YTNkIiwiY29kZSI6IjEyMzQ1NiJ9.signature",
  deviceId: "gate-1",
  gate: "gate-a",
  userId: seed.userId,
  eventId: seed.eventId,
  ticketTypeId: seed.ticketTypeId,
  ticketId: seed.ticketId,
  logId: seed.logId,
  reason: "TICKET_NOT_FOUND",
  message: "Ticket has already been checked in",
};

// Fields whose first enum value is technically valid but a poor demo value.
const overrides: Record<string, unknown> = {
  "User.role": "ATTENDEE",
  "Order.status": "CONFIRMED",
  "Order.failureCode": null,
  "OrderTicket.status": "PAID",
  "OrderTicket.checkedInAt": null,
  "TicketSummary.status": "PAID",
  "TicketSummary.checkedInAt": null,
  "QrTokenResponse.status": "PAID",
  "QrTokenResponse.checkedInAt": null,
  "OfflineSyncResponse.processed": 1,
  "OfflineSyncResponse.synced": 1,
  "OfflineSyncResponse.conflicts": 0,
  "OfflineSyncResponse.duplicates": 0,
};

let uuidSeq = 0;
const nextUuid = () =>
  `00000000-0000-4000-8000-${String(++uuidSeq).padStart(12, "0")}`;

function sampleString(schema: JsonSchema, key: string): string {
  if (strings[key]) return strings[key];
  if (schema.format === "uuid") return nextUuid();
  if (schema.format === "date-time") return "2026-11-09T08:00:00.000Z";
  if (schema.format === "email") return "attendee@qevent.dev";
  if (schema.format === "password") return "password123";
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
    for (const [key, child] of Object.entries<JsonSchema>(
      schema.properties ?? {}
    )) {
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

// ---------------------------------------------------------------- responses
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
  content: media(
    ref(schemaName),
    merge(sampleValue(ref(schemaName), schemaName), patch)
  ),
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
  content: media(
    ref(schemaName),
    merge(sampleValue(ref(schemaName), schemaName), patch)
  ),
});

const idParameter = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "string", format: "uuid" },
};
const idempotencyHeader = {
  name: "Idempotency-Key",
  in: "header",
  required: true,
  schema: { type: "string" },
  description: "Client-generated unique key scoped to the authenticated user.",
};
const bearer = [{ bearerAuth: [] }];
const serviceAuth = [{ serviceToken: [] }];

const unauthorized = { $ref: "#/components/responses/Unauthorized" };
const serviceUnauthorized = { $ref: "#/components/responses/ServiceUnauthorized" };
const validationFailed = { $ref: "#/components/responses/ValidationFailed" };

const checkedInTicket = merge(
  sampleValue(ref("TicketSummary"), "TicketSummary"),
  { status: "CHECKED_IN", checkedInAt: "2026-11-09T09:15:00.000Z" }
);
const noAccess = merge(
  sampleValue(ref("InternalAccessResponse"), "InternalAccessResponse"),
  { checkedIn: false, hasAccess: false, ticketId: null }
);

// ---------------------------------------------------------------- document
const components = {
  securitySchemes: {
    bearerAuth: {
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
      description: "JWT issued by `/api/auth/login` or `/api/auth/register`.",
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
    ServiceUnauthorized: fail(
      "The service token is missing or invalid.",
      "UNAUTHORIZED_SERVICE",
      "Valid service token is required"
    ),
    ValidationFailed: {
      description:
        "The request body or query does not satisfy the declared schema.",
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
  "/api/auth/register": {
    post: {
      tags: ["auth"],
      summary: "Register an attendee",
      description:
        "Creates an ATTENDEE account and returns a JWT. The optional `role` field is ignored.",
      operationId: "register",
      requestBody: body("RegisterRequest"),
      responses: {
        "201": ok("Account created and JWT issued.", "AuthResponse"),
        "409": fail("The email is already registered.", "EMAIL_TAKEN", "Email is already registered"),
        "422": validationFailed,
      },
    },
  },
  "/api/auth/login": {
    post: {
      tags: ["auth"],
      summary: "Log in and issue a JWT",
      operationId: "login",
      requestBody: body("LoginRequest"),
      responses: {
        "200": ok("Credentials accepted.", "AuthResponse"),
        "401": fail("The email or password is incorrect.", "INVALID_CREDENTIALS", "Email or password is incorrect"),
        "422": validationFailed,
      },
    },
  },
  "/api/auth/me": {
    get: {
      tags: ["auth"],
      summary: "Return the authenticated user",
      description:
        "Restores the staff web session after a reload. The role always comes from the database, not from client input.",
      operationId: "getCurrentUser",
      security: bearer,
      responses: {
        "200": ok("The authenticated user.", "AuthMeResponse"),
        "401": unauthorized,
      },
    },
  },
  "/api/orders": {
    get: {
      tags: ["orders"],
      summary: "List orders for an event (staff)",
      description:
        "Requires STAFF or ORGANIZER. Filters by status and searches by order id, attendee email or name. Cursor pagination.",
      operationId: "listOrders",
      security: bearer,
      parameters: [
        {
          name: "eventId",
          in: "query",
          required: true,
          schema: { type: "string", minLength: 1 },
        },
        {
          name: "status",
          in: "query",
          required: false,
          schema: {
            type: "string",
            enum: ["PENDING", "PENDING_RECONCILIATION", "COMPENSATING", "CONFIRMED", "FAILED"],
          },
        },
        {
          name: "q",
          in: "query",
          required: false,
          schema: { type: "string", maxLength: 100 },
        },
        {
          name: "cursor",
          in: "query",
          required: false,
          schema: { type: "string" },
        },
        {
          name: "limit",
          in: "query",
          required: false,
          schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
        },
      ],
      responses: {
        "200": ok("Orders ordered by creation time, newest first.", "OrderListResponse"),
        "401": unauthorized,
        "403": fail(
          "The caller is not STAFF or ORGANIZER.",
          "FORBIDDEN",
          "Staff or organizer role is required"
        ),
        "422": validationFailed,
      },
    },
    post: {
      tags: ["orders"],
      summary: "Place a ticket order through the Event Service saga",
      description:
        "Requires a unique `Idempotency-Key` per user. Replaying the same key and payload returns the stored result; reusing it with a different payload returns `409 IDEMPOTENCY_CONFLICT`. " +
        "When the downstream result is unknown (timeout or 5xx), the order stays pending and the response is `202` with `Location` for polling.",
      operationId: "placeOrder",
      security: bearer,
      parameters: [idempotencyHeader],
      requestBody: body("PlaceOrderRequest"),
      responses: {
        "201": ok("Reservation confirmed and tickets issued.", "OrderResponse"),
        "202": {
          ...ok(
            "Reservation outcome is unknown; the order is pending reconciliation.",
            "OrderResponse",
            {
              order: {
                status: "PENDING_RECONCILIATION",
                totalAmount: 0,
                tickets: [],
              },
            }
          ),
          headers: {
            Location: {
              description: "Order status URL for polling.",
              schema: {
                type: "string",
                example: "/api/orders/0f7b6d1e-8a5c-4f2b-9d3e-1c7a5b9e2f40",
              },
            },
          },
        },
        "400": fail(
          "The Idempotency-Key header is missing.",
          "IDEMPOTENCY_KEY_REQUIRED",
          "Idempotency-Key header is required"
        ),
        "401": unauthorized,
        "409": examples(
          "The key conflicts with another payload, or capacity is exhausted.",
          ref("ErrorBody"),
          {
            idempotencyConflict: {
              code: "IDEMPOTENCY_CONFLICT",
              message: "Idempotency key reused with a different payload",
            },
            soldOut: {
              code: "SOLD_OUT",
              message: "Ticket type or event capacity is exhausted",
            },
          }
        ),
        "422": validationFailed,
        "502": fail(
          "Tickets could not be issued and the reservation was released.",
          "TICKET_ISSUE_FAILED",
          "Ticket issuance failed; reservation was released"
        ),
      },
    },
  },
  "/api/orders/{id}": {
    get: {
      tags: ["orders"],
      summary: "Get an order and its tickets",
      description:
        "Attendees can read only their own orders; STAFF and ORGANIZER can read any order.",
      operationId: "getOrder",
      security: bearer,
      parameters: [idParameter],
      responses: {
        "200": ok("Order found.", "OrderResponse"),
        "401": unauthorized,
        "404": fail(
          "The order does not exist or is not visible to the caller.",
          "ORDER_NOT_FOUND",
          "Order was not found"
        ),
      },
    },
  },
  "/api/tickets": {
    get: {
      tags: ["tickets"],
      summary: "List tickets for an event (staff)",
      description:
        "Requires STAFF or ORGANIZER. Filters by status and searches by ticket id, attendee email or name. Attendees must use `/api/tickets/my`.",
      operationId: "listStaffTickets",
      security: bearer,
      parameters: [
        {
          name: "eventId",
          in: "query",
          required: true,
          schema: { type: "string", minLength: 1 },
        },
        {
          name: "status",
          in: "query",
          required: false,
          schema: {
            type: "string",
            enum: ["PENDING_PAYMENT", "PAID", "CHECKED_IN", "CANCELLED"],
          },
        },
        {
          name: "q",
          in: "query",
          required: false,
          schema: { type: "string", maxLength: 100 },
        },
        {
          name: "cursor",
          in: "query",
          required: false,
          schema: { type: "string" },
        },
        {
          name: "limit",
          in: "query",
          required: false,
          schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
        },
      ],
      responses: {
        "200": ok("Tickets ordered by creation time, newest first.", "StaffTicketListResponse"),
        "401": unauthorized,
        "403": fail(
          "The caller is not STAFF or ORGANIZER.",
          "FORBIDDEN",
          "Staff or organizer role is required"
        ),
        "422": validationFailed,
      },
    },
  },
  "/api/tickets/my": {
    get: {
      tags: ["tickets"],
      summary: "List the caller's tickets",
      operationId: "listMyTickets",
      security: bearer,
      responses: {
        "200": ok("Tickets owned by the authenticated user.", "TicketListResponse", {
          tickets: [checkedInTicket],
        }),
        "401": unauthorized,
      },
    },
  },
  "/api/tickets/{id}": {
    get: {
      tags: ["tickets"],
      summary: "Get a ticket with its order and check-in logs (staff)",
      description:
        "Requires STAFF or ORGANIZER. QR secrets are never returned; use `/api/tickets/{id}/qr-token` to reveal a fresh token.",
      operationId: "getStaffTicket",
      security: bearer,
      parameters: [idParameter],
      responses: {
        "200": ok("Ticket detail.", "TicketDetailResponse"),
        "401": unauthorized,
        "403": fail(
          "The caller is not STAFF or ORGANIZER.",
          "FORBIDDEN",
          "Staff or organizer role is required"
        ),
        "404": fail(
          "The ticket does not exist.",
          "TICKET_NOT_FOUND",
          "Ticket was not found"
        ),
      },
    },
  },
  "/api/tickets/{id}/qr-token": {
    get: {
      tags: ["tickets"],
      summary: "Issue a dynamic QR token",
      description:
        "Only the ticket owner or STAFF/ORGANIZER may request it. The token expires after 30 seconds and is bound to the ticket and event.",
      operationId: "getTicketQrToken",
      security: bearer,
      parameters: [idParameter],
      responses: {
        "200": ok("A fresh dynamic QR token.", "QrTokenResponse"),
        "401": unauthorized,
        "403": fail(
          "The ticket belongs to another attendee.",
          "FORBIDDEN",
          "Ticket belongs to another attendee"
        ),
        "404": fail(
          "The ticket does not exist.",
          "TICKET_NOT_FOUND",
          "Ticket was not found"
        ),
        "409": examples(
          "The ticket cannot produce a usable QR token.",
          ref("ErrorBody"),
          {
            cancelled: {
              code: "TICKET_CANCELLED",
              message: "Ticket has been cancelled",
            },
            orderNotConfirmed: {
              code: "ORDER_NOT_CONFIRMED",
              message: "Ticket order is not confirmed",
            },
          }
        ),
      },
    },
  },
  "/api/checkins": {
    get: {
      tags: ["checkins"],
      summary: "List the check-in feed for an event (staff)",
      description:
        "Requires STAFF or ORGANIZER. Newest first; filter by `since` and gate (deviceId). Cursor pagination.",
      operationId: "listCheckins",
      security: bearer,
      parameters: [
        {
          name: "eventId",
          in: "query",
          required: true,
          schema: { type: "string", minLength: 1 },
        },
        {
          name: "since",
          in: "query",
          required: false,
          schema: { type: "string", format: "date-time" },
        },
        {
          name: "gate",
          in: "query",
          required: false,
          schema: { type: "string" },
        },
        {
          name: "cursor",
          in: "query",
          required: false,
          schema: { type: "string" },
        },
        {
          name: "limit",
          in: "query",
          required: false,
          schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
        },
      ],
      responses: {
        "200": ok("Check-in logs, newest first.", "CheckinFeedResponse"),
        "401": unauthorized,
        "403": fail(
          "The caller is not STAFF or ORGANIZER.",
          "FORBIDDEN",
          "Staff or organizer role is required"
        ),
        "422": fail(
          "The since filter is not a valid ISO date-time.",
          "INVALID_SINCE",
          "since must be an ISO date-time"
        ),
      },
    },
    post: {
      tags: ["checkins"],
      summary: "Check in one ticket online",
      description:
        "Requires STAFF or ORGANIZER. Verifies the RSA signature and the 30-second TOTP before a compare-and-set update from PAID to CHECKED_IN. Concurrent scans accept exactly one request.",
      operationId: "checkIn",
      security: bearer,
      requestBody: body("CheckinRequest"),
      responses: {
        "201": ok("The ticket was checked in.", "CheckinSuccess"),
        "400": examples(
          "The QR token is invalid, expired, or the ticket status is unusable.",
          ref("ErrorBody"),
          {
            invalidQrToken: {
              code: "INVALID_QR_TOKEN",
              message: "Dynamic QR token has expired",
            },
            invalidTicketStatus: {
              code: "INVALID_TICKET_STATUS",
              message: "Ticket status is CANCELLED",
            },
          }
        ),
        "401": unauthorized,
        "403": fail(
          "The caller is not STAFF or ORGANIZER.",
          "FORBIDDEN",
          "Staff role is required"
        ),
        "409": examples(
          "The ticket was already checked in or its order is not confirmed.",
          {
            oneOf: [ref("CheckinConflict"), ref("ErrorBody")],
          },
          {
            alreadyCheckedIn: sampleValue(
              ref("CheckinConflict"),
              "CheckinConflict"
            ),
            orderNotConfirmed: {
              code: "ORDER_NOT_CONFIRMED",
              message: "Ticket order is not confirmed",
            },
          }
        ),
        "422": validationFailed,
      },
    },
  },
  "/api/checkins/stats": {
    get: {
      tags: ["checkins"],
      summary: "Dashboard counters for an event (staff)",
      description:
        "Requires STAFF or ORGANIZER. `byGate` groups check-in logs by deviceId; scanners should send a stable value such as `gate-1`.",
      operationId: "getCheckinStats",
      security: bearer,
      parameters: [
        {
          name: "eventId",
          in: "query",
          required: true,
          schema: { type: "string", minLength: 1 },
        },
      ],
      responses: {
        "200": ok("Ticket, order and gate counters.", "AdmissionStatsResponse"),
        "401": unauthorized,
        "403": fail(
          "The caller is not STAFF or ORGANIZER.",
          "FORBIDDEN",
          "Staff or organizer role is required"
        ),
        "422": validationFailed,
      },
    },
  },
  "/api/checkins/sync-offline": {
    post: {
      tags: ["checkins"],
      summary: "Synchronize offline check-in logs",
      description:
        "Requires STAFF or ORGANIZER. Scans are applied in chronological order. The first scan per ticket wins; later scans are reported as CONFLICT. Replayed scans are reported as DUPLICATE and do not change state.",
      operationId: "syncOfflineCheckins",
      security: bearer,
      requestBody: body("OfflineSyncRequest"),
      responses: {
        "200": ok("Per-scan synchronization results.", "OfflineSyncResponse"),
        "401": unauthorized,
        "403": fail(
          "The caller is not STAFF or ORGANIZER.",
          "FORBIDDEN",
          "Staff role is required"
        ),
        "422": validationFailed,
      },
    },
  },
  "/internal/tickets/verify-access": {
    get: {
      tags: ["internal"],
      summary: "Check whether a user checked in to an event",
      description:
        "Used by the Engagement Service to enforce BR-6. Requires the shared service token instead of a user JWT.",
      operationId: "verifyAccess",
      security: serviceAuth,
      parameters: [
        {
          name: "userId",
          in: "query",
          required: true,
          schema: { type: "string", minLength: 1 },
        },
        {
          name: "eventId",
          in: "query",
          required: true,
          schema: { type: "string", minLength: 1 },
        },
      ],
      responses: {
        "200": examples(
          "Access decision for the user and event.",
          ref("InternalAccessResponse"),
          {
            checkedIn: sampleValue(
              ref("InternalAccessResponse"),
              "InternalAccessResponse"
            ),
            notCheckedIn: noAccess,
          }
        ),
        "401": serviceUnauthorized,
        "422": validationFailed,
      },
    },
  },
};

export const openapiDocumentation = {
  info: {
    title: "qEvent Admission Service",
    version: "1.0.0",
    description:
      "Accounts, ticket orders with the Event Service saga, dynamic QR, and check-in. " +
      "Protected endpoints verify the JWT inside this service and never trust identity from the body. " +
      "Errors always use `{ code, message }` except request validation failures, which return the Elysia validation payload. " +
      "Order creation is idempotent per user and `Idempotency-Key`; an unknown downstream result returns `202` with a `Location` header instead of a false failure.",
  },
  servers: [
    { url: "http://localhost:3002", description: "Direct service port (Docker network)" },
    { url: "http://localhost:8000", description: "API Gateway entry point" },
  ],
  tags: [
    { name: "auth", description: "Accounts and JWT" },
    { name: "orders", description: "Ticket ordering saga" },
    { name: "tickets", description: "Ticket listing and dynamic QR" },
    { name: "checkins", description: "Online and offline check-in" },
    { name: "internal", description: "Service-to-service access checks" },
    { name: "health", description: "Service and database readiness" },
  ],
  components,
  paths,
} as Documentation;
