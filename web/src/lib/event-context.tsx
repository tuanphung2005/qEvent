import { api } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import type { EventSummary } from "@/lib/api/types";
import { qk } from "@/lib/query/keys";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";

const DEFAULT_EVENT_KEY = "qevent.defaultEventId";

export function readDefaultEventId(): string | null {
  try {
    return localStorage.getItem(DEFAULT_EVENT_KEY);
  } catch {
    return null;
  }
}

export function writeDefaultEventId(eventId: string): void {
  try {
    localStorage.setItem(DEFAULT_EVENT_KEY, eventId);
  } catch {
    // Storage disabled: the URL still carries the selection for this tab.
  }
}

export function useEvents() {
  return useQuery({
    queryKey: qk.events.list(),
    queryFn: async () => unwrap(await api.GET("/api/events")),
    staleTime: 60_000,
  });
}

export type EventContextValue = {
  /** Source of truth: `?eventId=`, falling back to the stored default. */
  eventId: string | null;
  setEventId: (eventId: string) => void;
  event: EventSummary | null;
  events: EventSummary[];
  isLoading: boolean;
  isError: boolean;
};

/**
 * The only place "which event am I looking at" is decided. Screens read
 * `eventId` and build queries from it; nobody keeps a private copy in state.
 */
export function useEventContext(): EventContextValue {
  const [params, setParams] = useSearchParams();
  const eventsQuery = useEvents();
  const events = useMemo(() => eventsQuery.data?.events ?? [], [eventsQuery.data]);

  const urlEventId = params.get("eventId");
  const fallbackEventId = useMemo(() => readDefaultEventId(), []);
  const eventId =
    urlEventId ??
    (fallbackEventId && events.some((e) => e.id === fallbackEventId) ? fallbackEventId : null);

  const setEventId = useCallback(
    (nextEventId: string) => {
      const next = new URLSearchParams(params);
      next.set("eventId", nextEventId);
      setParams(next, { replace: true });
      writeDefaultEventId(nextEventId);
    },
    [params, setParams],
  );

  const event = eventId ? (events.find((item) => item.id === eventId) ?? null) : null;

  return {
    eventId,
    setEventId,
    event,
    events,
    isLoading: eventsQuery.isLoading,
    isError: eventsQuery.isError,
  };
}
