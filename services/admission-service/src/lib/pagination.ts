export type PageQuery = {
  limit?: number;
  cursor?: string;
};

/** Clamp the requested page size; never let a client ask for the whole table. */
export function pageSize(query: PageQuery, max = 100): number {
  const requested = Number(query.limit ?? 20);
  if (!Number.isFinite(requested)) return 20;
  return Math.min(Math.max(Math.trunc(requested), 1), max);
}

/** Prisma cursor arguments for createdAt/id descending pages. */
export function cursorArgs(cursor?: string) {
  return cursor ? { cursor: { id: cursor }, skip: 1 } : {};
}

export function pageResult<T extends { id: string }>(
  rows: T[],
  limit: number
): { items: T[]; nextCursor: string | null } {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return {
    items,
    nextCursor: hasMore ? items[items.length - 1].id : null,
  };
}

export function parseSince(value?: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
