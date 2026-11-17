import { api } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import { qk } from "@/lib/query/keys";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { TicketStatus } from "./types";

export type TicketsFilter = {
  eventId: string;
  status?: TicketStatus;
  q?: string;
  cursor?: string;
};

const PAGE_SIZE = 20;

export function useTickets(filter: TicketsFilter | null) {
  return useQuery({
    queryKey: qk.tickets.list(filter ?? {}),
    queryFn: async () => {
      if (!filter) throw new Error("Chưa chọn sự kiện");
      return unwrap(
        await api.GET("/api/tickets", { params: { query: { ...filter, limit: PAGE_SIZE } } }),
      );
    },
    enabled: filter !== null,
    placeholderData: (previous) => previous,
  });
}

export function useTicket(ticketId: string | undefined) {
  return useQuery({
    queryKey: qk.tickets.detail(ticketId ?? "none"),
    queryFn: async () =>
      unwrap(await api.GET("/api/tickets/{id}", { params: { path: { id: ticketId ?? "" } } })),
    enabled: Boolean(ticketId),
  });
}

/** Issues a fresh 30-second token. Called only from an explicit reveal. */
export function useQrToken(ticketId: string | undefined) {
  return useMutation({
    mutationFn: async () =>
      unwrap(
        await api.GET("/api/tickets/{id}/qr-token", { params: { path: { id: ticketId ?? "" } } }),
      ),
  });
}
