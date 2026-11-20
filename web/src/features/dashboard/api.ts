import { api } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import type { EventSummary, Session } from "@/lib/api/types";
import { qk } from "@/lib/query/keys";
import { useQuery } from "@tanstack/react-query";

function requireId(id: string | null, what: string): string {
  if (!id) throw new Error(`${what} chưa được chọn`);
  return id;
}

export function useEventDetail(eventId: string | null) {
  return useQuery({
    queryKey: qk.events.detail(eventId ?? "none"),
    queryFn: async () =>
      unwrap(
        await api.GET("/api/events/{id}", {
          params: { path: { id: requireId(eventId, "Sự kiện") } },
        }),
      ),
    enabled: Boolean(eventId),
  });
}

/** Admission service: ticket/order/gate counters for one event. */
export function useCheckinStats(eventId: string | null) {
  return useQuery({
    queryKey: qk.checkins.stats(eventId ?? "none"),
    queryFn: async () =>
      unwrap(
        await api.GET("/api/checkins/stats", {
          params: { query: { eventId: requireId(eventId, "Sự kiện") } },
        }),
      ),
    enabled: Boolean(eventId),
  });
}

/** Engagement service: Q&A, active poll and quiz state for one session. */
export function useSessionStats(sessionId: string | null) {
  return useQuery({
    queryKey: qk.engagement.stats(sessionId ?? "none"),
    queryFn: async () =>
      unwrap(
        await api.GET("/api/sessions/{sessionId}/stats", {
          params: { path: { sessionId: requireId(sessionId, "Phiên") } },
        }),
      ),
    enabled: Boolean(sessionId),
  });
}

/** The live session wins; otherwise the first one is the default context. */
export function pickSession(event: EventSummary | null | undefined): Session | null {
  if (!event || event.sessions.length === 0) return null;
  return event.sessions.find((session) => session.isLive) ?? event.sessions[0] ?? null;
}
