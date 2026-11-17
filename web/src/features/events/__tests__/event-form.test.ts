import { describe, expect, it } from "vitest";
import {
  EVENT_PHASE,
  eventErrorText,
  eventPhase,
  fromDateTimeInput,
  toDateTimeInput,
} from "../types";

describe("eventPhase", () => {
  const event = {
    startTime: "2026-11-20T01:00:00.000Z",
    endTime: "2026-11-20T10:00:00.000Z",
  };

  it("chia đúng sắp diễn ra / đang diễn ra / đã kết thúc", () => {
    expect(eventPhase(event, Date.parse("2026-11-19T00:00:00.000Z"))).toBe("UPCOMING");
    expect(eventPhase(event, Date.parse("2026-11-20T05:00:00.000Z"))).toBe("LIVE");
    expect(eventPhase(event, Date.parse("2026-11-21T00:00:00.000Z"))).toBe("PAST");
  });

  it("có nhãn tiếng Việt cho mọi trạng thái", () => {
    expect(EVENT_PHASE.UPCOMING.label).toBe("Sắp diễn ra");
    expect(EVENT_PHASE.LIVE.label).toBe("Đang diễn ra");
    expect(EVENT_PHASE.PAST.label).toBe("Đã kết thúc");
  });
});

describe("datetime-local", () => {
  it("đi và về đúng múi giờ venue (UTC+7)", () => {
    const iso = "2026-11-20T01:00:00.000Z";
    expect(toDateTimeInput(iso)).toBe("2026-11-20T08:00");
    expect(fromDateTimeInput("2026-11-20T08:00")).toBe(iso);
  });

  it("trả chuỗi rỗng cho giá trị không hợp lệ", () => {
    expect(toDateTimeInput("không-phải-ngày")).toBe("");
    expect(fromDateTimeInput("")).toBe("");
  });
});

describe("eventErrorText", () => {
  it("dịch mã lỗi riêng của event service", () => {
    expect(eventErrorText("INVALID_SESSION_TIME", "fallback")).toContain("Giờ kết thúc phiên");
    expect(eventErrorText("CAPACITY_BELOW_RESERVED", "fallback")).toContain("sức chứa");
    expect(eventErrorText("SOMETHING_ELSE", "fallback")).toBe("fallback");
  });
});
