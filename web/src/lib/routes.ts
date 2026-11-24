import type { ListFilter } from "@/lib/api/types";

function withQuery(path: string, filter?: ListFilter): string {
  if (!filter) return path;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(filter)) {
    if (value === null || value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

/**
 * Canonical URLs. Features never concatenate route strings by hand — rename
 * happens here once and all four owners follow.
 */
export const routes = {
  login: () => "/login",
  dashboard: () => "/dashboard",
  events: (f?: ListFilter) => withQuery("/events", f),
  event: (eventId: string) => `/events/${eventId}`,
  eventRooms: (eventId: string) => `/events/${eventId}/rooms`,
  eventSessions: (eventId: string) => `/events/${eventId}/sessions`,
  eventTicketTypes: (eventId: string) => `/events/${eventId}/ticket-types`,
  eventHosts: (eventId: string) => `/events/${eventId}/hosts`,
  orders: (f?: ListFilter) => withQuery("/orders", f),
  order: (orderId: string) => `/orders/${orderId}`,
  tickets: (f?: ListFilter) => withQuery("/tickets", f),
  ticket: (ticketId: string) => `/tickets/${ticketId}`,
  checkins: (f?: ListFilter) => withQuery("/checkins", f),
  scan: () => "/scan",
  sync: () => "/sync",
  engagement: (sessionId: string, tab: "qa" | "polls" | "quiz" = "qa") =>
    `/engagement/${sessionId}${tab === "qa" ? "" : `/${tab}`}`,
  present: (sessionId?: string) => (sessionId ? `/present/${sessionId}` : "/present"),
  settings: () => "/settings",
} as const;
