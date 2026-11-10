import { describe, expect, it } from "bun:test";
import { InfraError, resilientFetch } from "../src/lib/resilient-fetch";

function response(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("resilientFetch", () => {
  it("retries 503 and returns the first successful response", async () => {
    let calls = 0;
    const result = await resilientFetch(
      "http://event.test/internal/reservations",
      {},
      {
        retries: 2,
        backoffMs: 1,
        fetchImpl: (async () => {
          calls++;
          return calls < 3 ? response(503) : response(201, { ok: true });
        }) as unknown as typeof fetch,
      }
    );

    expect(calls).toBe(3);
    expect(result.status).toBe(201);
    expect(result.body).toEqual({ ok: true });
  });

  it("does not retry business 4xx responses", async () => {
    let calls = 0;
    const result = await resilientFetch(
      "http://event.test/internal/reservations",
      {},
      {
        retries: 2,
        backoffMs: 1,
        fetchImpl: (async () => {
          calls++;
          return response(409, { code: "SOLD_OUT" });
        }) as unknown as typeof fetch,
      }
    );

    expect(calls).toBe(1);
    expect(result.status).toBe(409);
  });

  it("throws InfraError after exhausting retryable statuses", async () => {
    let calls = 0;
    await expect(
      resilientFetch(
        "http://event.test/internal/reservations",
        {},
        {
          retries: 2,
          backoffMs: 1,
          fetchImpl: (async () => {
            calls++;
            return response(502);
          }) as unknown as typeof fetch,
        }
      )
    ).rejects.toBeInstanceOf(InfraError);
    expect(calls).toBe(3);
  });

  it("retries connection failures and throws InfraError", async () => {
    let calls = 0;
    await expect(
      resilientFetch(
        "http://event.test/internal/reservations",
        {},
        {
          retries: 1,
          backoffMs: 1,
          fetchImpl: (async () => {
            calls++;
            throw new Error("ECONNREFUSED");
          }) as unknown as typeof fetch,
        }
      )
    ).rejects.toBeInstanceOf(InfraError);
    expect(calls).toBe(2);
  });

  it("aborts a hanging request at the timeout", async () => {
    const started = Date.now();
    await expect(
      resilientFetch(
        "http://event.test/internal/reservations",
        {},
        {
          timeoutMs: 20,
          retries: 0,
          fetchImpl: ((_url: string, init: RequestInit) =>
            new Promise((_resolve, reject) => {
              init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
            })) as unknown as typeof fetch,
        }
      )
    ).rejects.toBeInstanceOf(InfraError);
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
