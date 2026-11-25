/** Seconds left for a live quiz question; null when the host has not started it. */
export function secondsLeft(
  startedAt: string | null | undefined,
  timeLimitSec: number | null | undefined,
  now: number,
): number | null {
  if (!startedAt) return null;
  const elapsed = Math.floor((now - Date.parse(startedAt)) / 1000);
  if (!Number.isFinite(elapsed)) return null;
  return Math.max(0, Math.max(1, timeLimitSec ?? 30) - Math.max(0, elapsed));
}
