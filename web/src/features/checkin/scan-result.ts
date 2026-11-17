import { errorMessage } from "@/lib/api/errors";
import { formatTime } from "@/lib/format/date";

export type ScanTone = "success" | "warning" | "error" | "neutral";

export type CheckinOutcome = {
  status: number;
  code: string;
  message?: string | null;
  ticketId?: string | null;
  attendeeName?: string | null;
  at?: string | null;
};

export type ScanFeedback = {
  tone: ScanTone;
  title: string;
  detail: string;
  /** Beeps the scanner plays; count 0 means silence. */
  beeps: { count: number; durationMs: number };
  vibrate: number | number[];
};

/**
 * The frozen mapping table from `docs/STAFF_WEB_TEAM_SPLIT.md` §6.3.
 * Order matters: a 409 with ALREADY_CHECKED_IN is a warning, not an error.
 */
export function describeCheckin(outcome: CheckinOutcome): ScanFeedback {
  const name = outcome.attendeeName ?? "Khách tham dự";

  if (outcome.status === 201 || outcome.code === "CHECKIN_SUCCESS") {
    return {
      tone: "success",
      title: "Vé hợp lệ",
      detail: outcome.at ? `${name} · đã soát lúc ${formatTime(outcome.at)}` : `${name} · đã soát`,
      beeps: { count: 1, durationMs: 120 },
      vibrate: 120,
    };
  }

  if (outcome.code === "ALREADY_CHECKED_IN") {
    return {
      tone: "warning",
      title: "Vé đã được soát",
      detail: outcome.at
        ? `${name} · soát trước lúc ${formatTime(outcome.at)}`
        : errorMessage("ALREADY_CHECKED_IN"),
      beeps: { count: 2, durationMs: 120 },
      vibrate: [120, 80, 120],
    };
  }

  if (outcome.code === "ORDER_NOT_CONFIRMED") {
    return {
      tone: "error",
      title: "Đơn chưa xác nhận",
      detail: "Đơn của vé chưa được xác nhận nên chưa soát được. Kiểm tra thanh toán của khách.",
      beeps: { count: 1, durationMs: 320 },
      vibrate: 300,
    };
  }

  if (outcome.status === 400 || outcome.code === "INVALID_QR_TOKEN") {
    return {
      tone: "error",
      title: "Mã QR không hợp lệ",
      // Server messages are English; the gate needs the Vietnamese copy.
      detail: errorMessage("INVALID_QR_TOKEN"),
      beeps: { count: 1, durationMs: 320 },
      vibrate: 400,
    };
  }

  if (outcome.status === 401 || outcome.code === "UNAUTHORIZED") {
    return {
      tone: "error",
      title: "Phiên đã hết hạn",
      detail: "Đăng nhập lại để tiếp tục soát vé. Các lượt đã ghi nhận vẫn được giữ.",
      beeps: { count: 0, durationMs: 0 },
      vibrate: 120,
    };
  }

  if (outcome.status === 403) {
    return {
      tone: "error",
      title: "Không có quyền",
      detail: "Tài khoản này không được soát vé. Đăng nhập bằng tài khoản STAFF hoặc ORGANIZER.",
      beeps: { count: 0, durationMs: 0 },
      vibrate: 120,
    };
  }

  if (outcome.status === 503 || outcome.status === 504) {
    return {
      tone: "neutral",
      title: "Dịch vụ không phản hồi",
      detail: "Máy chủ chưa trả lời. Chưa kết luận được vé, thử quét lại sau ít phút.",
      beeps: { count: 0, durationMs: 0 },
      vibrate: 0,
    };
  }

  if (outcome.status === 0 || outcome.code === "NETWORK") {
    return {
      tone: "neutral",
      title: "Cần mạng",
      detail: "Không có kết nối tới máy chủ. Kiểm tra Wi-Fi hoặc 4G rồi quét lại.",
      beeps: { count: 0, durationMs: 0 },
      vibrate: 0,
    };
  }

  return {
    tone: "error",
    title: "Chưa soát được",
    detail: `${outcome.code} · ${outcome.message ?? "Thử lại hoặc dán mã khác."}`,
    beeps: { count: 1, durationMs: 220 },
    vibrate: 200,
  };
}
