import { resilientFetch } from "./resilient-fetch";

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
    private readonly ttlMs: number = 60_000
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
        { timeoutMs: this.timeoutMs, retries: 1 }
      );

      if (status === 200 && body && typeof body === "object") {
        const payload = body as Record<string, unknown>;
        const checkedIn = Boolean(payload.checkedIn ?? payload.hasAccess);
        const result: AccessVerification = {
          hasAccess: checkedIn,
          checkedIn,
          ticketId: typeof payload.ticketId === "string" ? payload.ticketId : null,
        };

        this.cache.set(cacheKey, { value: result, expiresAt: now + this.ttlMs });
        return result;
      }

      return { hasAccess: false, checkedIn: false };
    } catch {
      return { hasAccess: false, checkedIn: false };
    }
  }

  clearCache() {
    this.cache.clear();
  }
}
