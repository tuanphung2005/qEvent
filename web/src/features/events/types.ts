import type { EventSummary } from "@/lib/api/types";
import type { StatusTone } from "@/lib/format/status-label";

/** The event service has no status column; the phase is derived from its window. */
export type EventPhase = "UPCOMING" | "LIVE" | "PAST";

export const EVENT_PHASE: Record<EventPhase, { label: string; tone: StatusTone }> = {
  UPCOMING: { label: "Sắp diễn ra", tone: "info" },
  LIVE: { label: "Đang diễn ra", tone: "success" },
  PAST: { label: "Đã kết thúc", tone: "neutral" },
};

export function eventPhase(
  event: Pick<EventSummary, "startTime" | "endTime">,
  now = Date.now(),
): EventPhase {
  const start = Date.parse(event.startTime);
  const end = Date.parse(event.endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "UPCOMING";
  if (now < start) return "UPCOMING";
  if (now > end) return "PAST";
  return "LIVE";
}

/** Codes the event service returns that `lib/api/errors` does not know yet. */
export function eventErrorText(code: string, fallback: string): string {
  switch (code) {
    case "INVALID_EVENT_TIME":
      return "Thời gian sự kiện chưa hợp lệ: giờ kết thúc phải sau giờ bắt đầu và không ở quá khứ.";
    case "INVALID_SESSION_TIME":
      return "Giờ kết thúc phiên phải sau giờ bắt đầu.";
    case "CAPACITY_BELOW_RESERVED":
      return "Không giảm được sức chứa: đã có nhiều vé giữ chỗ hơn mức mới.";
    case "EVENT_NOT_FOUND":
      return "Không tìm thấy sự kiện.";
    case "TICKET_TYPE_NOT_FOUND":
      return "Không tìm thấy loại vé.";
    default:
      return fallback;
  }
}

const TIME_ZONE = "Asia/Ho_Chi_Minh";

const dateTimeParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** ISO string → `datetime-local` value, in the venue timezone. */
export function toDateTimeInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts: Record<string, string> = {};
  for (const part of dateTimeParts.formatToParts(date)) parts[part.type] = part.value;
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** `datetime-local` value (venue timezone, UTC+7) → ISO string for the API. */
export function fromDateTimeInput(value: string): string {
  if (!value) return "";
  const date = new Date(`${value}:00+07:00`);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

export type EventTabContext = { event: EventSummary };
