import { formatDate, formatDateShort, formatTime } from "@/lib/format/date";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format/money";
import { statusLabel, statusTone, statusToneClass } from "@/lib/format/status-label";
import { formatTicketCode, shortCode } from "@/lib/format/ticket-code";
import { describe, expect, it } from "vitest";

describe("date format", () => {
  it("formats in Asia/Ho_Chi_Minh regardless of the runtime locale", () => {
    expect(formatDate("2026-11-20T01:15:00.000Z")).toBe("20/11/2026 08:15");
    expect(formatTime("2026-11-20T01:15:00.000Z")).toBe("08:15");
    expect(formatDateShort("2026-11-20T01:15:00.000Z")).toBe("20/11 · 08:15");
  });

  it("shows an em dash for missing or invalid input", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate("not-a-date")).toBe("—");
  });
});

describe("money format", () => {
  it("groups thousands with dots and keeps the đồng unit", () => {
    expect(formatMoney(1200000)).toBe("1.200.000 ₫");
    expect(formatMoney(0)).toBe("0 ₫");
  });

  it("counts and rates stay readable", () => {
    expect(formatNumber(1200)).toBe("1.200");
    expect(formatPercent(42, 120)).toBe("35%");
    expect(formatPercent(1, 3)).toBe("33.3%");
    expect(formatPercent(0, 0)).toBe("0%");
  });
});

describe("ticket code", () => {
  it("turns a uuid into the QE-XXXX-XXXX form", () => {
    expect(formatTicketCode("7f3a91c2-0e11-4a55-9a3f-123456789abc")).toBe("QE-7F3A-91C2");
    expect(shortCode("7f3a91c2-0e11-4a55-9a3f-123456789abc")).toBe("…9ABC");
  });
});

describe("status labels", () => {
  it("uses backend vocabulary in Vietnamese", () => {
    expect(statusLabel("CONFIRMED")).toBe("Đã xác nhận");
    expect(statusLabel("ALREADY_CHECKED_IN")).toBe("already checked in");
    expect(statusTone("CHECKED_IN")).toBe("success");
    expect(statusTone("FAILED")).toBe("error");
    expect(statusTone("PENDING")).toBe("info");
  });

  it("maps a tone to the Badge tint class", () => {
    expect(statusToneClass("success")).toContain("text-success");
    expect(statusToneClass("error")).toContain("text-destructive");
    expect(statusToneClass("neutral")).toContain("bg-secondary");
  });
});
