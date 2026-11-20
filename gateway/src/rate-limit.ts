/**
 * Sliding-window limiter for failed logins. Successful logins are never
 * counted, so a busy desk (or e2e) hitting the same IP is not rate limited.
 */
export function createFailureLimiter(options: { windowMs?: number; max?: number } = {}) {
  const windowMs = options.windowMs ?? 5 * 60_000;
  const max = options.max ?? 10;
  const hits = new Map<string, number[]>();

  const recent = (key: string, now: number) =>
    (hits.get(key) ?? []).filter((at) => now - at < windowMs);

  return {
    blocked(key: string, now = Date.now()): boolean {
      const list = recent(key, now);
      if (list.length === 0) hits.delete(key);
      else hits.set(key, list);
      return list.length >= max;
    },
    record(key: string, now = Date.now()): void {
      const list = recent(key, now);
      list.push(now);
      hits.set(key, list);
    },
    reset(key: string): void {
      hits.delete(key);
    },
  };
}

export type FailureLimiter = ReturnType<typeof createFailureLimiter>;
