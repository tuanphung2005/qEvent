import type { Page } from "@playwright/test";
import { CREDENTIALS, type Role } from "./global-setup";

export { CREDENTIALS } from "./global-setup";
export type { Role } from "./global-setup";

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
