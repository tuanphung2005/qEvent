import { describe, expect, it } from "bun:test";
import { HttpAdmissionClient } from "../src/lib/admission-client";
import { InfraError } from "../src/lib/resilient-fetch";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("HttpAdmissionClient", () => {
  it("does not cache a negative check-in result", async () => {
    let checkedIn = false;
    let calls = 0;
    const fetchImpl = (async () => {
      calls++;
      return jsonResponse({ checkedIn });
    }) as unknown as typeof fetch;

    const client = new HttpAdmissionClient("http://admission", "token", 200, 60_000, fetchImpl);

    expect((await client.verifyAccess("user-1", "event-1")).hasAccess).toBe(false);
    checkedIn = true;
    expect((await client.verifyAccess("user-1", "event-1")).hasAccess).toBe(true);
    expect(calls).toBe(2);
  });

  it("caches a positive result until the TTL expires", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls++;
      return jsonResponse({ checkedIn: true, ticketId: "ticket-1" });
    }) as unknown as typeof fetch;

    const client = new HttpAdmissionClient("http://admission", "token", 200, 60_000, fetchImpl);

    const first = await client.verifyAccess("user-1", "event-1");
    const second = await client.verifyAccess("user-1", "event-1");

    expect(first.hasAccess).toBe(true);
    expect(second.ticketId).toBe("ticket-1");
    expect(calls).toBe(1);
  });

  it("propagates infrastructure failures instead of reporting no access", async () => {
    const fetchImpl = (async () => {
      throw new Error("connection refused");
    }) as unknown as typeof fetch;

    const client = new HttpAdmissionClient("http://admission", "token", 200, 0, fetchImpl);

    await expect(client.verifyAccess("user-1", "event-1")).rejects.toBeInstanceOf(InfraError);
  });
});
