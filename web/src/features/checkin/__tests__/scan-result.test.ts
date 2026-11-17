import { describe, expect, it } from "vitest";
import { describeCheckin } from "../scan-result";

describe("describeCheckin", () => {
  it("vé hợp lệ: xanh, tên khách, giờ, một beep", () => {
    const feedback = describeCheckin({
      status: 201,
      code: "CHECKIN_SUCCESS",
      attendeeName: "Nguyễn Văn An",
      at: "2026-11-20T01:15:00.000Z",
    });

    expect(feedback.tone).toBe("success");
    expect(feedback.title).toBe("Vé hợp lệ");
    expect(feedback.detail).toContain("Nguyễn Văn An");
    expect(feedback.detail).toContain("08:15");
    expect(feedback.beeps).toEqual({ count: 1, durationMs: 120 });
    expect(feedback.vibrate).toBe(120);
  });

  it("soát lại: vàng, giờ soát trước, hai beep", () => {
    const feedback = describeCheckin({
      status: 409,
      code: "ALREADY_CHECKED_IN",
      attendeeName: "Nguyễn Văn An",
      at: "2026-11-20T01:10:00.000Z",
    });

    expect(feedback.tone).toBe("warning");
    expect(feedback.title).toBe("Vé đã được soát");
    expect(feedback.detail).toContain("08:10");
    expect(feedback.beeps.count).toBe(2);
  });

  it("mã sai chữ ký / hết hạn: đỏ, beep dài", () => {
    const feedback = describeCheckin({
      status: 400,
      code: "INVALID_QR_TOKEN",
      message: "Mã QR không hợp lệ hoặc đã hết hạn.",
    });

    expect(feedback.tone).toBe("error");
    expect(feedback.title).toBe("Mã QR không hợp lệ");
    expect(feedback.detail).toContain("hết hạn");
    expect(feedback.beeps).toEqual({ count: 1, durationMs: 320 });
  });

  it("đơn chưa xác nhận: đỏ dù HTTP là 409", () => {
    const feedback = describeCheckin({ status: 409, code: "ORDER_NOT_CONFIRMED" });

    expect(feedback.tone).toBe("error");
    expect(feedback.title).toBe("Đơn chưa xác nhận");
    expect(feedback.beeps.count).toBe(1);
  });

  it("401: phiên hết hạn, không beep", () => {
    const feedback = describeCheckin({ status: 401, code: "UNAUTHORIZED" });

    expect(feedback.tone).toBe("error");
    expect(feedback.title).toBe("Phiên đã hết hạn");
    expect(feedback.beeps.count).toBe(0);
  });

  it("403: đỏ, chỉ rung, không beep", () => {
    const feedback = describeCheckin({ status: 403, code: "FORBIDDEN" });

    expect(feedback.tone).toBe("error");
    expect(feedback.title).toBe("Không có quyền");
    expect(feedback.beeps.count).toBe(0);
    expect(feedback.vibrate).toBe(120);
  });

  it("503/504 và mất mạng: xám, không beep", () => {
    const unavailable = describeCheckin({ status: 503, code: "SERVICE_UNAVAILABLE" });
    const offline = describeCheckin({ status: 0, code: "NETWORK" });

    expect(unavailable.tone).toBe("neutral");
    expect(unavailable.beeps.count).toBe(0);
    expect(offline.tone).toBe("neutral");
    expect(offline.title).toBe("Cần mạng");
    expect(offline.beeps.count).toBe(0);
  });
});
