import { routes } from "@/lib/routes";

/** A host lands on the presenter screen, but keeps an explicit deep link. */
export function loginLanding(role: string | undefined, from: string): string {
  return role === "HOST" && from === routes.dashboard() ? routes.present() : from;
}
