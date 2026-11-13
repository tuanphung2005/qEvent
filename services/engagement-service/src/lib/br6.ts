import type { Deps } from "../deps";
import { SessionNotFoundError, type SessionAccessInfo } from "./event-client";
import { InfraError } from "./resilient-fetch";

/**
 * BR-6 guard: only attendees who checked in to the session's real event may
 * interact. The eventId always comes from Event Service, never from the client,
 * and the session must be live.
 */
export class AccessError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "AccessError";
  }
}

function upstreamFailure(service: "EVENT" | "ADMISSION", error: unknown): AccessError {
  const timeout = error instanceof InfraError && /timeout/i.test(error.message);
  const name = service === "EVENT" ? "Event Service" : "Admission Service";
  return new AccessError(
    timeout ? 504 : 503,
    `${service}_SERVICE_${timeout ? "TIMEOUT" : "UNAVAILABLE"}`,
    timeout ? `${name} timed out; try again later` : `${name} is unavailable; try again later`
  );
}

export async function requireSessionAccess(
  deps: Deps,
  userId: string,
  sessionId: string
): Promise<SessionAccessInfo> {
  let session: SessionAccessInfo;
  try {
    session = await deps.eventClient.getSession(sessionId);
  } catch (error) {
    if (error instanceof SessionNotFoundError) {
      throw new AccessError(404, "SESSION_NOT_FOUND", "Session was not found");
    }
    throw upstreamFailure("EVENT", error);
  }

  if (!session.isLive) {
    throw new AccessError(403, "SESSION_NOT_LIVE", "Session is not live yet");
  }

  let verification;
  try {
    verification = await deps.admissionClient.verifyAccess(userId, session.eventId);
  } catch (error) {
    throw upstreamFailure("ADMISSION", error);
  }

  if (!verification.hasAccess) {
    throw new AccessError(
      403,
      "NOT_CHECKED_IN",
      "Attendee has not checked in to this event"
    );
  }

  return session;
}
