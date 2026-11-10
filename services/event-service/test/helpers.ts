import crypto from "node:crypto";
import { createApp } from "../src/app";
import type { Deps } from "../src/deps";
import { prisma } from "../src/lib/prisma";

export { prisma };

export const SERVICE_TOKEN = "qevent_internal_service_token_dev";

export function makeTestApp(overrides: Partial<Deps> = {}) {
  return createApp(overrides);
}

type App = ReturnType<typeof createApp>["app"];

export async function call(
  app: App,
  path: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {}
): Promise<{ status: number; data: any; headers: Headers }> {
  const headers: Record<string, string> = { ...options.headers };
  if (options.body !== undefined) headers["content-type"] = "application/json";

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

export function futureIso(hoursFromNow: number): string {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
}

export function organizerHeaders(): Record<string, string> {
  return { "x-user-role": "ORGANIZER" };
}

export function serviceHeaders(): Record<string, string> {
  return { "x-service-token": SERVICE_TOKEN };
}

export async function createEventViaApi(
  app: App,
  overrides: Partial<{
    name: string;
    venue: string;
    startTime: string;
    endTime: string;
    maxCapacity: number;
    ticketTypes: Array<{ name: string; price: number; quota: number }>;
  }> = {}
) {
  const result = await call(app, "/api/events", {
    method: "POST",
    headers: organizerHeaders(),
    body: {
      name: overrides.name ?? `Event ${crypto.randomUUID()}`,
      venue: overrides.venue ?? "Test Venue",
      startTime: overrides.startTime ?? futureIso(24),
      endTime: overrides.endTime ?? futureIso(30),
      maxCapacity: overrides.maxCapacity ?? 100,
      ticketTypes: overrides.ticketTypes ?? [{ name: "Standard", price: 25, quota: 100 }],
    },
  });
  if (result.status !== 201) {
    throw new Error(`create event failed: ${JSON.stringify(result.data)}`);
  }
  return result.data.event;
}

export async function createEventWithTicketType(
  input: { maxCapacity?: number; quota?: number; price?: number } = {}
) {
  const event = await prisma.event.create({
    data: {
      name: `Event ${crypto.randomUUID()}`,
      venue: "Test Venue",
      startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 30 * 60 * 60 * 1000),
      maxCapacity: input.maxCapacity ?? 100,
    },
  });
  const ticketType = await prisma.ticketType.create({
    data: {
      eventId: event.id,
      name: "Standard",
      price: input.price ?? 25,
      quota: input.quota ?? 100,
    },
  });
  return { event, ticketType };
}
