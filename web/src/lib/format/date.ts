const TIME_ZONE = "Asia/Ho_Chi_Minh";
const EMPTY = "—";

const dateTime = new Intl.DateTimeFormat("vi-VN", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const timeOnly = new Intl.DateTimeFormat("vi-VN", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function parts(iso: string, formatter: Intl.DateTimeFormat): Record<string, string> | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const out: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) out[part.type] = part.value;
  return out;
}

/** "15/11/2026 14:30" — full timestamp. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return EMPTY;
  const p = parts(iso, dateTime);
  if (!p) return EMPTY;
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

/** "15/11 · 14:30" — table column, year dropped by design. */
export function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return EMPTY;
  const p = parts(iso, dateTime);
  if (!p) return EMPTY;
  return `${p.day}/${p.month} · ${p.hour}:${p.minute}`;
}

/** "15/11/2026" — day only. */
export function formatDay(iso: string | null | undefined): string {
  if (!iso) return EMPTY;
  const p = parts(iso, dateTime);
  if (!p) return EMPTY;
  return `${p.day}/${p.month}/${p.year}`;
}

/** "14:30" — clock only. */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return EMPTY;
  const p = parts(iso, timeOnly);
  if (!p) return EMPTY;
  return `${p.hour}:${p.minute}`;
}

/** Long form for page headers: "15/11/2026 08:00 – 17:00". */
export function formatRange(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
): string {
  if (!startIso || !endIso) return EMPTY;
  return `${formatDate(startIso)} – ${formatTime(endIso)}`;
}
