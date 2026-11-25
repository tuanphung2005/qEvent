import { api } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import type { components } from "@/lib/api/generated";
import { qk } from "@/lib/query/keys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type CreateEventInput = components["schemas"]["CreateEventRequest"];
export type UpdateEventInput = components["schemas"]["UpdateEventRequest"];
export type RoomInput = components["schemas"]["RoomRequest"];
export type UpdateRoomInput = components["schemas"]["UpdateRoomRequest"];
export type SessionInput = components["schemas"]["SessionRequest"];
export type UpdateSessionInput = components["schemas"]["UpdateSessionRequest"];
export type TicketTypeInput = components["schemas"]["TicketTypeRequest"];
export type UpdateTicketTypeInput = components["schemas"]["UpdateTicketTypeRequest"];

/** The gateway overwrites this header from the JWT; the contract still requires it. */
const ORGANIZER = { "x-user-role": "ORGANIZER" } as const;

function requireId(id: string | null | undefined, what: string): string {
  if (!id) throw new Error(`${what} chưa được chọn`);
  return id;
}

export function useEvent(eventId: string | null | undefined) {
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

function useInvalidateEvents() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["events"] });
}

export function useCreateEvent() {
  const invalidate = useInvalidateEvents();
  return useMutation({
    mutationFn: async (body: CreateEventInput) =>
      unwrap(await api.POST("/api/events", { body, params: { header: ORGANIZER } })),
    onSuccess: () => void invalidate(),
  });
}

export function useUpdateEvent(eventId: string) {
  const invalidate = useInvalidateEvents();
  return useMutation({
    mutationFn: async (body: UpdateEventInput) =>
      unwrap(
        await api.PATCH("/api/events/{id}", {
          body,
          params: { path: { id: eventId }, header: ORGANIZER },
        }),
      ),
    onSuccess: () => void invalidate(),
  });
}

export function useCreateRoom(eventId: string) {
  const invalidate = useInvalidateEvents();
  return useMutation({
    mutationFn: async (body: RoomInput) =>
      unwrap(
        await api.POST("/api/events/{id}/rooms", {
          body,
          params: { path: { id: eventId }, header: ORGANIZER },
        }),
      ),
    onSuccess: () => void invalidate(),
  });
}

export function useUpdateRoom(eventId: string) {
  const invalidate = useInvalidateEvents();
  return useMutation({
    mutationFn: async ({ roomId, body }: { roomId: string; body: UpdateRoomInput }) =>
      unwrap(
        await api.PATCH("/api/events/{id}/rooms/{roomId}", {
          body,
          params: { path: { id: eventId, roomId }, header: ORGANIZER },
        }),
      ),
    onSuccess: () => void invalidate(),
  });
}

export function useCreateSession(eventId: string) {
  const invalidate = useInvalidateEvents();
  return useMutation({
    mutationFn: async (body: SessionInput) =>
      unwrap(
        await api.POST("/api/events/{id}/sessions", {
          body,
          params: { path: { id: eventId }, header: ORGANIZER },
        }),
      ),
    onSuccess: () => void invalidate(),
  });
}

export function useUpdateSession(eventId: string) {
  const invalidate = useInvalidateEvents();
  return useMutation({
    mutationFn: async ({ sessionId, body }: { sessionId: string; body: UpdateSessionInput }) =>
      unwrap(
        await api.PATCH("/api/events/{id}/sessions/{sessionId}", {
          body,
          params: { path: { id: eventId, sessionId }, header: ORGANIZER },
        }),
      ),
    onSuccess: () => void invalidate(),
  });
}

export function useCreateTicketType(eventId: string) {
  const invalidate = useInvalidateEvents();
  return useMutation({
    mutationFn: async (body: TicketTypeInput) =>
      unwrap(
        await api.POST("/api/events/{id}/ticket-types", {
          body,
          params: { path: { id: eventId }, header: ORGANIZER },
        }),
      ),
    onSuccess: () => void invalidate(),
  });
}

export function useUpdateTicketType(eventId: string) {
  const invalidate = useInvalidateEvents();
  return useMutation({
    mutationFn: async ({
      ticketTypeId,
      body,
    }: {
      ticketTypeId: string;
      body: UpdateTicketTypeInput;
    }) =>
      unwrap(
        await api.PATCH("/api/events/{id}/ticket-types/{ticketTypeId}", {
          body,
          params: { path: { id: eventId, ticketTypeId }, header: ORGANIZER },
        }),
      ),
    onSuccess: () => void invalidate(),
  });
}

export function useEventHosts(eventId: string) {
  return useQuery({
    queryKey: ["events", "hosts", eventId],
    queryFn: async () =>
      unwrap(
        await api.GET("/api/events/{id}/hosts", {
          params: { path: { id: eventId }, header: ORGANIZER },
        }),
      ),
    enabled: Boolean(eventId),
  });
}

/** Organizer picker: only HOST accounts can be assigned to an event. */
export function useHostAccounts(enabled = true) {
  return useQuery({
    queryKey: ["users", "HOST"],
    queryFn: async () =>
      unwrap(await api.GET("/api/users", { params: { query: { role: "HOST" } } })),
    enabled,
    staleTime: 60_000,
  });
}

export function useAssignEventHost(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) =>
      unwrap(
        await api.PUT("/api/events/{id}/hosts/{userId}", {
          params: { path: { id: eventId, userId }, header: ORGANIZER },
        }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["events", "hosts", eventId] });
      void queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

export function useUnassignEventHost(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) =>
      unwrap(
        await api.DELETE("/api/events/{id}/hosts/{userId}", {
          params: { path: { id: eventId, userId }, header: ORGANIZER },
        }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["events", "hosts", eventId] });
      void queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });
}
