import type { Deps } from "../deps";
import type { CurrentUser } from "./auth";
import { SessionNotFoundError } from "./event-client";
import { fail } from "./http";
import { InfraError } from "./resilient-fetch";

type SetLike = { status?: number | string };

/**
 * HOST accounts may only drive sessions in events an organizer assigned to
 * them. ORGANIZER and STAFF keep their existing global console permissions.
 */
export async function requireHostSession(
  deps: Deps,
  currentUser: CurrentUser | null,
  set: SetLike,
  sessionId: string
) {
  // Only HOST is scoped per event; other roles are handled by the route guard.
  if (!currentUser || currentUser.role !== "HOST") return null;

  try {
    const session = await deps.eventClient.getSession(sessionId, currentUser.id);
    if (!session.hostAssigned) {
      return fail(set, 403, "EVENT_NOT_ASSIGNED", "Host is not assigned to this event");
    }
  } catch (error) {
    if (error instanceof SessionNotFoundError) {
      return fail(set, 404, "SESSION_NOT_FOUND", "Session was not found");
    }
    if (error instanceof InfraError) {
      const timeout = /timeout/i.test(error.message);
      return fail(
        set,
        timeout ? 504 : 503,
        `EVENT_SERVICE_${timeout ? "TIMEOUT" : "UNAVAILABLE"}`,
        timeout ? "Event Service timed out; try again later" : "Event Service is unavailable; try again later"
      );
    }
    throw error;
  }

  return null;
}
