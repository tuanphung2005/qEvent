import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { CREDENTIALS, type Role } from "./global-setup";

export { CREDENTIALS } from "./global-setup";
export type { Role } from "./global-setup";

/**
 * WCAG 1.4.3 exempts inactive controls, but axe still measures the 50% opacity
 * of disabled buttons, so they are left out of the scan.
 */
export function scanA11y(page: Page) {
  return new AxeBuilder({ page }).exclude("button[disabled]").analyze();
}

const API_BASE = process.env.E2E_API_BASE ?? "http://localhost:8000";

export type SeedResult = { organizerToken: string; staffToken: string; attendeeToken: string };

async function login(role: Role): Promise<string> {
  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(CREDENTIALS[role]),
  });
  if (!response.ok) throw new Error(`Đăng nhập ${role} thất bại: HTTP ${response.status}`);
  const body = (await response.json()) as { token: string };
  return body.token;
}

/** Tokens come from the real API so e2e exercises the same auth path as users. */
export async function seedBase(): Promise<SeedResult> {
  const [organizerToken, staffToken, attendeeToken] = await Promise.all([
    login("organizer"),
    login("staff"),
    login("attendee"),
  ]);
  return { organizerToken, staffToken, attendeeToken };
}

/**
 * The console keeps the token in memory + sessionStorage, so storageState
 * cannot carry it; an init script seeds the session before the app boots.
 */
export async function signIn(page: Page, role: Role): Promise<void> {
  const token = await login(role);
  await page.addInitScript((value) => {
    window.sessionStorage.setItem("qevent.token", value);
  }, token);
}

export async function signInWithToken(page: Page, token: string): Promise<void> {
  await page.addInitScript((value) => {
    window.sessionStorage.setItem("qevent.token", value);
  }, token);
}

export type EventPick = {
  eventId: string;
  eventName: string;
  venue: string;
  sessionId: string | null;
};

type EventListBody = {
  events: Array<{
    id: string;
    name: string;
    venue: string;
    sessions: Array<{ id: string }>;
  }>;
};

/**
 * Seeded event for deep links. Never hard-code ids: the seed can be rebuilt and
 * e2e events created by other specs shift the list.
 */
export async function pickEvent(token: string, options: { withSession?: boolean } = {}) {
  const response = await fetch(`${API_BASE}/api/events`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Không tải được sự kiện: HTTP ${response.status}`);
  const body = (await response.json()) as EventListBody;
  const event = options.withSession
    ? body.events.find((item) => item.sessions.length > 0)
    : body.events[0];
  if (!event) throw new Error("Chưa có sự kiện trong DB seed — chạy `bun run seed`.");

  return {
    eventId: event.id,
    eventName: event.name,
    venue: event.venue,
    sessionId: event.sessions[0]?.id ?? null,
  } satisfies EventPick;
}

/** Fails the test with an actionable message instead of a cascading timeout. */
export function requireSession(pick: EventPick): string {
  if (!pick.sessionId) throw new Error(`Sự kiện ${pick.eventName} không có phiên — chạy seed.`);
  return pick.sessionId;
}

export type CreatedEvent = { eventId: string; eventName: string };

/**
 * Disposable event for specs that mutate structure. Writing rooms/sessions or
 * ticket types into a seeded event leaves "E2E ..." rows (and an over-capacity
 * warning) on the demo data, which is real user-visible pollution.
 */
export async function createEvent(token: string): Promise<CreatedEvent> {
  const stamp = Date.now();
  const start = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 4 * 60 * 60 * 1000);
  const response = await fetch(`${API_BASE}/api/events`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({
      name: `E2E Console ${stamp}`,
      venue: "E2E Venue",
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      maxCapacity: 100,
      rooms: [],
      sessions: [],
      ticketTypes: [],
    }),
  });
  if (!response.ok) throw new Error(`Không tạo được sự kiện e2e: HTTP ${response.status}`);
  const body = (await response.json()) as { event: { id: string; name: string } };
  return { eventId: body.event.id, eventName: body.event.name };
}
