export type StatusTone = "neutral" | "info" | "success" | "warning" | "error";

type Entry = { label: string; tone: StatusTone };

const LABELS: Record<string, Entry> = {
  // Order
  PENDING: { label: "Đang xử lý", tone: "info" },
  PENDING_RECONCILIATION: { label: "Đang đối soát", tone: "warning" },
  COMPENSATING: { label: "Đang hoàn vé", tone: "warning" },
  CONFIRMED: { label: "Đã xác nhận", tone: "success" },
  FAILED: { label: "Thất bại", tone: "error" },
  // Ticket
  PENDING_PAYMENT: { label: "Chờ thanh toán", tone: "info" },
  PAID: { label: "Đã thanh toán", tone: "success" },
  CHECKED_IN: { label: "Đã soát", tone: "success" },
  CANCELLED: { label: "Đã huỷ", tone: "neutral" },
  // Check-in sync
  SYNCED: { label: "Đã đồng bộ", tone: "success" },
  CONFLICT: { label: "Xung đột", tone: "warning" },
  OFFLINE: { label: "Ngoại tuyến", tone: "warning" },
  // Quiz
  WAITING: { label: "Chờ bắt đầu", tone: "neutral" },
  QUESTION_ACTIVE: { label: "Đang hỏi", tone: "info" },
  ROUND_REVEALED: { label: "Đã công bố", tone: "warning" },
  FINISHED: { label: "Đã kết thúc", tone: "neutral" },
  // Roles
  ORGANIZER: { label: "Ban tổ chức", tone: "info" },
  HOST: { label: "Người dẫn phiên", tone: "info" },
  STAFF: { label: "Nhân sự soát vé", tone: "neutral" },
  ATTENDEE: { label: "Khách tham dự", tone: "neutral" },
};

export function statusLabel(code: string | null | undefined): string {
  if (!code) return "—";
  return LABELS[code]?.label ?? code.replaceAll("_", " ").toLowerCase();
}

export function statusTone(code: string | null | undefined): StatusTone {
  if (!code) return "neutral";
  return LABELS[code]?.tone ?? "neutral";
}

/**
 * Badge tint for a tone. Plain function, not a component: the UI itself is
 * always the shadcn Badge, this only supplies the semantic colours.
 */
export function statusToneClass(tone: StatusTone): string {
  switch (tone) {
    case "info":
      return "bg-accent text-accent-foreground";
    case "success":
      return "bg-success-subtle text-success";
    case "warning":
      return "bg-warning-subtle text-warning";
    case "error":
      return "bg-destructive-subtle text-destructive";
    default:
      return "bg-secondary text-secondary-foreground";
  }
}

export const orderStatusLabel = statusLabel;
export const ticketStatusLabel = statusLabel;
export const syncStatusLabel = statusLabel;
export const gameStatusLabel = statusLabel;
