import crypto from "node:crypto";
import { createApp } from "../src/app";
import type { Deps } from "../src/deps";
import { prisma } from "../src/lib/prisma";
import { generateTotp, signQrToken } from "../src/lib/qr";
import type {
  DownstreamResponse,
  EventClient,
  ReservationRequest,
} from "../src/services/event-client";

export { prisma };

export function makeTestApp(overrides: Partial<Deps> = {}) {
  return createApp(overrides);
}

export class FakeEventClient implements EventClient {
  createCalls: ReservationRequest[] = [];
  releaseCalls: string[] = [];

  constructor(
    private readonly create: (
      input: ReservationRequest
    ) => DownstreamResponse | Promise<DownstreamResponse> = () => ({
      status: 201,
      body: { reservationId: crypto.randomUUID(), status: "CONFIRMED" },
    }),
    private readonly release: (
      operationId: string
    ) => DownstreamResponse | Promise<DownstreamResponse> = () => ({ status: 200, body: {} })
  ) {}

  async createReservation(input: ReservationRequest): Promise<DownstreamResponse> {
    this.createCalls.push(input);
    return this.create(input);
  }

  async releaseReservation(operationId: string): Promise<DownstreamResponse> {
    this.releaseCalls.push(operationId);
    return this.release(operationId);
  }
}

type App = ReturnType<typeof createApp>["app"];

export async function call(
  app: App,
  path: string,
  options: {
    method?: string;
    body?: unknown;
    token?: string;
    headers?: Record<string, string>;
  } = {}
): Promise<{ status: number; data: any; headers: Headers }> {
  const headers: Record<string, string> = { ...options.headers };
  if (options.body !== undefined) headers["content-type"] = "application/json";
  if (options.token) headers.authorization = `Bearer ${options.token}`;

  const response = await app.handle(
    new Request(`http://localhost${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  );

  const text = await response.text();
  return {
    status: response.status,
    data: text ? JSON.parse(text) : null,
    headers: response.headers,
  };
}

export async function registerAttendee(app: App): Promise<{ token: string; userId: string }> {
  const email = `user-${crypto.randomUUID()}@test.local`;
  const result = await call(app, "/api/auth/register", {
    method: "POST",
    body: { email, password: "password123", fullName: "Test User" },
  });
  if (result.status !== 201) throw new Error(`register failed: ${JSON.stringify(result.data)}`);
  return { token: result.data.token, userId: result.data.user.id };
}

async function registerWithRole(app: App, role: "STAFF" | "ORGANIZER") {
  const created = await registerAttendee(app);
  await prisma.user.update({ where: { id: created.userId }, data: { role } });
  const user = await prisma.user.findUniqueOrThrow({ where: { id: created.userId } });
  const login = await call(app, "/api/auth/login", {
    method: "POST",
    body: { email: user.email, password: "password123" },
  });
  if (login.status !== 200) throw new Error(`staff login failed: ${JSON.stringify(login.data)}`);
  return { token: login.data.token as string, userId: created.userId };
}

export function registerStaff(app: App) {
  return registerWithRole(app, "STAFF");
}

export function registerOrganizer(app: App) {
  return registerWithRole(app, "ORGANIZER");
}

export async function buyTicket(
  app: App,
  token: string,
  input: { eventId?: string; ticketTypeId?: string; quantity?: number } = {}
) {
  const result = await call(app, "/api/orders", {
    method: "POST",
    token,
    headers: { "idempotency-key": crypto.randomUUID() },
    body: {
      eventId: input.eventId ?? "event-1",
      ticketTypeId: input.ticketTypeId ?? "ticket-type-1",
      quantity: input.quantity ?? 1,
    },
  });
  if (result.status !== 201) throw new Error(`order failed: ${JSON.stringify(result.data)}`);
  return result.data.order;
}

export function qrFor(
  deps: Deps,
  ticket: { id: string; eventId: string; qrSecret: string },
  atMs: number
): string {
  return signQrToken(
    {
      tid: ticket.id,
      eid: ticket.eventId,
      code: generateTotp(ticket.qrSecret, atMs),
      iat: Math.floor(atMs / 1000),
    },
    deps.keys.privateKey
  );
}
