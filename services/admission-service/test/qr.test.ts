import { describe, expect, it } from "bun:test";
import { getKeys } from "../src/lib/keys";
import {
  buildQrToken,
  generateTotp,
  signQrToken,
  verifyQrToken,
  verifyTotp,
} from "../src/lib/qr";

const keys = getKeys(process.env.KEYS_DIR);
const secret = "12345678901234567890";

describe("TOTP (RFC 6238)", () => {
  it("matches the RFC 6238 SHA-1 vector", () => {
    expect(generateTotp(secret, 59_000)).toBe("287082");
  });

  it("accepts the current and previous 30s window only", () => {
    const code = generateTotp(secret, 40_000);
    expect(verifyTotp(secret, code, 40_000)).toBe(true);
    expect(verifyTotp(secret, code, 61_000)).toBe(true);
    expect(verifyTotp(secret, code, 91_000)).toBe(false);
  });

  it("rejects a wrong code", () => {
    const code = generateTotp(secret, 59_000);
    const wrong = code === "000000" ? "111111" : "000000";
    expect(verifyTotp(secret, wrong, 59_000)).toBe(false);
  });
});

describe("dynamic QR token", () => {
  const ticket = { id: "ticket-1", eventId: "event-1", qrSecret: "ticket-secret" };
  const now = 1_700_000_000_000;

  it("signs and verifies a ticket-bound token", () => {
    const { qrToken, expiresIn } = buildQrToken(ticket, keys.privateKey, now);
    expect(expiresIn).toBeGreaterThan(0);
    expect(expiresIn).toBeLessThanOrEqual(30);

    const result = verifyQrToken(qrToken, keys.publicKey, now);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.payload.tid).toBe(ticket.id);
      expect(result.payload.eid).toBe(ticket.eventId);
    }
  });

  it("rejects tampered payloads", () => {
    const { qrToken } = buildQrToken(ticket, keys.privateKey, now);
    const [, signature] = qrToken.split(".");
    const tampered = Buffer.from(
      JSON.stringify({ tid: "other", eid: "event-1", code: "123456", iat: now / 1000 })
    ).toString("base64url");

    expect(verifyQrToken(`${tampered}.${signature}`, keys.publicKey, now).valid).toBe(false);
  });

  it("rejects expired tokens", () => {
    const old = now - 31_000;
    const qrToken = signQrToken(
      {
        tid: ticket.id,
        eid: ticket.eventId,
        code: generateTotp(ticket.qrSecret, old),
        iat: Math.floor(old / 1000),
      },
      keys.privateKey
    );

    const result = verifyQrToken(qrToken, keys.publicKey, now);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toBe("EXPIRED");
  });

  it("rejects tokens from the future and malformed tokens", () => {
    const future = signQrToken(
      {
        tid: ticket.id,
        eid: ticket.eventId,
        code: generateTotp(ticket.qrSecret, now),
        iat: Math.floor(now / 1000) + 10,
      },
      keys.privateKey
    );

    const futureResult = verifyQrToken(future, keys.publicKey, now);
    expect(futureResult.valid).toBe(false);
    if (!futureResult.valid) expect(futureResult.error).toBe("FUTURE");

    expect(verifyQrToken("not-a-token", keys.publicKey, now).valid).toBe(false);
  });
});
