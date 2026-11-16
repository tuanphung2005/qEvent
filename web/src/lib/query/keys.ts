import type { ListFilter } from "@/lib/api/types";

/**
 * One key shape for the whole app. `'*'` is the documented wildcard used by
 * mutation invalidation tables (scan → tickets/checkins, event edit → events).
 */
export const qk = {
  me: () => ["me"] as const,
  events: {
    list: (f: ListFilter = {}) => ["events", "list", f] as const,
    detail: (eventId: string) => ["events", "detail", eventId] as const,
  },
  orders: {
    list: (f: ListFilter = {}) => ["orders", "list", f] as const,
    detail: (orderId: string) => ["orders", "detail", orderId] as const,
  },
  tickets: {
    list: (f: ListFilter = {}) => ["tickets", "list", f] as const,
    detail: (ticketId: string) => ["tickets", "detail", ticketId] as const,
  },
  checkins: {
    list: (f: ListFilter = {}) => ["checkins", "list", f] as const,
    stats: (eventId: string) => ["checkins", "stats", eventId] as const,
  },
  engagement: {
    questions: (sessionId: string) => ["engagement", "questions", sessionId] as const,
    polls: (sessionId: string) => ["engagement", "polls", sessionId] as const,
    game: (sessionId: string) => ["engagement", "game", sessionId] as const,
  },
} as const;
