import { InfraError, resilientFetch } from "./resilient-fetch";

export type AccessVerification = {
  hasAccess: boolean;
  checkedIn: boolean;
  ticketId?: string | null;
};

export interface AdmissionClient {
  verifyAccess(userId: string, eventId: string): Promise<AccessVerification>;
}

export class HttpAdmissionClient implements AdmissionClient {
  private cache = new Map<string, { value: AccessVerification; expiresAt: number }>();

  constructor(
    private readonly baseUrl: string,
    private readonly serviceToken: string,
    private readonly timeoutMs: number = 1000,
    private readonly ttlMs: number = 60_000,
    private readonly fetchImpl?: typeof fetch
  ) {}

  async verifyAccess(userId: string, eventId: string): Promise<AccessVerification> {
    const cacheKey = `${userId}:${eventId}`;
    const now = Date.now();
    const cached = this.cache.get(cacheKey);

    if (cached && cached.expiresAt > now) {
      return cached.value;
    }

    const url = `${this.baseUrl}/internal/tickets/verify-access?userId=${encodeURIComponent(
      userId
    )}&eventId=${encodeURIComponent(eventId)}`;

    try {
      const { status, body } = await resilientFetch(
        url,
        {
          headers: {
            "x-service-token": this.serviceToken,
          },
        },
        // Single attempt: retries would exceed the gateway's request budget and
        // turn a clean 503 into a gateway timeout.
        { timeoutMs: this.timeoutMs, retries: 0, fetchImpl: this.fetchImpl }
      );

      if (status === 200 && body && typeof body === "object") {
        const payload = body as Record<string, unknown>;
        const checkedIn = Boolean(payload.checkedIn ?? payload.hasAccess);
        const result: AccessVerification = {
          hasAccess: checkedIn,
          checkedIn,
          ticketId: typeof payload.ticketId === "string" ? payload.ticketId : null,
        };

        // Only cache positive results. Caching "not checked in" would keep an
        // attendee locked out for the whole TTL right after they check in.
        if (result.hasAccess) {
          this.cache.set(cacheKey, { value: result, expiresAt: now + this.ttlMs });
        }
        return result;
      }

      // A non-200 response is an infrastructure/config failure, not proof that
      // the attendee is absent: the endpoint reports denial as 200 + false.
      throw new InfraError(`admission service responded ${status}`, status);
    } catch (error) {
      // Infrastructure failures must not be reported as "not checked in":
      // the caller turns them into 503/504 instead of 403.
      if (error instanceof InfraError) throw error;
      throw new InfraError("admission service unreachable");
    }
  }

  clearCache() {
    this.cache.clear();
  }
}
