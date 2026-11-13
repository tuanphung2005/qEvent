import { InfraError, resilientFetch } from "./resilient-fetch";

export type SessionAccessInfo = {
  sessionId: string;
  eventId: string;
  isLive: boolean;
};

export class SessionNotFoundError extends Error {
  constructor(readonly sessionId: string) {
    super(`Session ${sessionId} was not found`);
    this.name = "SessionNotFoundError";
  }
}

export interface EventClient {
  getSession(sessionId: string): Promise<SessionAccessInfo>;
}

type SessionPayload = {
  session?: {
    id?: unknown;
    isLive?: unknown;
    event?: { id?: unknown };
  };
};

/**
 * Reads only the metadata Engagement needs (eventId + isLive) from Event Service.
 * Engagement never queries the Event database directly.
 */
export class HttpEventClient implements EventClient {
  constructor(
    private readonly baseUrl: string,
    private readonly serviceToken: string,
    private readonly timeoutMs: number = 1000
  ) {}

  async getSession(sessionId: string): Promise<SessionAccessInfo> {
    const url = `${this.baseUrl}/internal/sessions/${encodeURIComponent(sessionId)}`;

    const { status, body } = await resilientFetch(
      url,
      { headers: { "x-service-token": this.serviceToken } },
      { timeoutMs: this.timeoutMs, retries: 0 }
    );

    if (status === 404) throw new SessionNotFoundError(sessionId);
    if (status !== 200) {
      throw new InfraError(`event service responded ${status}`, status);
    }

    const payload = body as SessionPayload | null;
    const session = payload?.session;
    const eventId = session?.event?.id;
    if (typeof eventId !== "string" || typeof session?.isLive !== "boolean") {
      throw new InfraError("event service returned a malformed session payload");
    }

    return { sessionId, eventId, isLive: session.isLive };
  }
}
