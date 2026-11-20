import { describe, expect, it } from "bun:test";
import { createFailureLimiter } from "./rate-limit";

describe("failed-login limiter", () => {
  it("blocks after the limit and forgets old failures", () => {
    const limiter = createFailureLimiter({ windowMs: 1000, max: 3 });
    const now = 10_000;

    limiter.record("1.2.3.4", now);
    limiter.record("1.2.3.4", now);
    expect(limiter.blocked("1.2.3.4", now)).toBe(false);

    limiter.record("1.2.3.4", now);
    expect(limiter.blocked("1.2.3.4", now)).toBe(true);
    expect(limiter.blocked("5.6.7.8", now)).toBe(false);

    // All failures fall out of the window.
    expect(limiter.blocked("1.2.3.4", now + 1001)).toBe(false);
  });

  it("clears the counter after a successful login", () => {
    const limiter = createFailureLimiter({ windowMs: 1000, max: 2 });
    limiter.record("1.2.3.4", 0);
    limiter.record("1.2.3.4", 0);
    expect(limiter.blocked("1.2.3.4", 0)).toBe(true);

    limiter.reset("1.2.3.4");
    expect(limiter.blocked("1.2.3.4", 0)).toBe(false);
  });
});
