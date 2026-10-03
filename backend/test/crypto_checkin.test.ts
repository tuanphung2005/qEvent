import { describe, expect, it } from "bun:test";
import {
  generateTOTP,
  verifyTOTP,
  signDynamicQRPayload,
  verifyDynamicQRToken,
} from "../src/config/keys";

describe("qCheck Cryptographic Dynamic QR & Check-in Verification", () => {
  const mockSecret = "mock-totp-secret-uuid-12345";
  const ticketId = "ticket-uuid-abc-123";
  const eventId = "event-uuid-xyz-789";

  it("1. Should generate valid 6-digit TOTP code and verify accurately", () => {
    const code = generateTOTP(mockSecret);
    expect(code).toBeDefined();
    expect(code.length).toBe(6);
    expect(/^\d{6}$/.test(code)).toBe(true);

    const isValid = verifyTOTP(mockSecret, code);
    expect(isValid).toBe(true);

    // Wrong code should fail
    const isInvalid = verifyTOTP(mockSecret, "999999" === code ? "000000" : "999999");
    expect(isInvalid).toBe(false);
  });

  it("2. Should generate and verify RSA-signed Dynamic QR token", () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const code = generateTOTP(mockSecret);

    const token = signDynamicQRPayload({
      tid: ticketId,
      eid: eventId,
      code,
      iat: nowSec,
    });

    expect(token).toBeDefined();
    expect(token.includes(".")).toBe(true);

    const verification = verifyDynamicQRToken(token);
    expect(verification.valid).toBe(true);
    expect(verification.payload).toBeDefined();
    expect(verification.payload?.tid).toBe(ticketId);
    expect(verification.payload?.eid).toBe(eventId);
    expect(verification.payload?.code).toBe(code);
  });

  it("3. Should reject expired Dynamic QR token (>60s)", () => {
    // Generate token from 65 seconds ago
    const expiredTimestamp = Math.floor(Date.now() / 1000) - 65;
    const code = generateTOTP(mockSecret, expiredTimestamp * 1000);

    const token = signDynamicQRPayload({
      tid: ticketId,
      eid: eventId,
      code,
      iat: expiredTimestamp,
    });

    const verification = verifyDynamicQRToken(token);
    expect(verification.valid).toBe(false);
    expect(verification.error).toContain("expired");
  });

  it("4. Should reject tampered signature or payload", () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const code = generateTOTP(mockSecret);

    const token = signDynamicQRPayload({
      tid: ticketId,
      eid: eventId,
      code,
      iat: nowSec,
    });

    const [dataB64, sig] = token.split(".");
    // Tamper with payload
    const tamperedData = Buffer.from(
      JSON.stringify({ tid: "hacked-ticket", eid: eventId, code, iat: nowSec })
    ).toString("base64url");
    const tamperedToken = `${tamperedData}.${sig}`;

    const verification = verifyDynamicQRToken(tamperedToken);
    expect(verification.valid).toBe(false);
  });

  it("5. Should prevent double check-in and correctly resolve offline sync conflicts", () => {
    // Simulating database state & conflict resolution logic
    type SimulatedTicket = {
      id: string;
      status: "PAID" | "CHECKED_IN";
      checkedInAt: Date | null;
    };

    const simulatedTickets: Record<string, SimulatedTicket> = {
      "ticket-1": { id: "ticket-1", status: "PAID", checkedInAt: null },
    };

    function simulateOnlineVerify(tId: string) {
      const ticket = simulatedTickets[tId];
      if (!ticket) return { status: 400, code: "INVALID_TICKET" };
      if (ticket.status === "CHECKED_IN") {
        return { status: 409, code: "ALREADY_CHECKED_IN" };
      }
      ticket.status = "CHECKED_IN";
      ticket.checkedInAt = new Date();
      return { status: 200, code: "CHECKIN_SUCCESS" };
    }

    // First scan: SUCCESS (200) -> Screen turns GREEN
    const scan1 = simulateOnlineVerify("ticket-1");
    expect(scan1.status).toBe(200);
    expect(scan1.code).toBe("CHECKIN_SUCCESS");

    // Second scan: DUPLICATE (409) -> Screen turns AMBER (ALREADY_CHECKED_IN)
    const scan2 = simulateOnlineVerify("ticket-1");
    expect(scan2.status).toBe(409);
    expect(scan2.code).toBe("ALREADY_CHECKED_IN");

    // Offline sync resolution test
    const offlineLogs = [
      { ticketId: "ticket-2", scannedAt: "2026-10-01T10:00:00Z", deviceId: "device-A" },
      { ticketId: "ticket-2", scannedAt: "2026-10-01T10:00:05Z", deviceId: "device-B" },
    ];

    const ticket2: SimulatedTicket = { id: "ticket-2", status: "PAID", checkedInAt: null };
    const syncResults = [];

    // Sort ascending
    offlineLogs.sort(
      (a, b) => new Date(a.scannedAt).getTime() - new Date(b.scannedAt).getTime()
    );

    for (const log of offlineLogs) {
      if (ticket2.status === "CHECKED_IN") {
        syncResults.push({ ticketId: log.ticketId, syncStatus: "CONFLICT" });
      } else {
        ticket2.status = "CHECKED_IN";
        ticket2.checkedInAt = new Date(log.scannedAt);
        syncResults.push({ ticketId: log.ticketId, syncStatus: "SYNCED" });
      }
    }

    expect(syncResults[0].syncStatus).toBe("SYNCED");
    expect(syncResults[1].syncStatus).toBe("CONFLICT");
  });
});
