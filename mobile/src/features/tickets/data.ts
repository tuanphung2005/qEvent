import { useQueries, useQuery } from '@tanstack/react-query';

import { api, recordServerDate, serverNow } from '@/api/client';
import { unwrap } from '@/api/errors';
import type { components as AdmissionComponents } from '@/api/generated/admission';
import type { components as EventComponents } from '@/api/generated/event';
import type { Event, TicketSummary } from './lib';

export type QrTokenResponse = AdmissionComponents['schemas']['QrTokenResponse'];

/** `expiresAt` is computed with the server clock offset, not the device clock. */
export type QrTokenData = QrTokenResponse & { expiresAt: number };

export const ticketKeys = {
  my: ['tickets', 'my'] as const,
  qr: (ticketId: string) => ['tickets', ticketId, 'qr'] as const,
  event: (eventId: string) => ['events', eventId] as const,
};

export async function fetchMyTickets(): Promise<TicketSummary[]> {
  const result = await api.GET('/api/tickets/my');
  recordServerDate(result.response);
  return unwrap(result).tickets;
}

export async function fetchEvent(eventId: string): Promise<Event> {
  const result = await api.GET('/api/events/{id}', { params: { path: { id: eventId } } });
  recordServerDate(result.response);
  return unwrap(result).event;
}

export async function fetchQrToken(ticketId: string): Promise<QrTokenData> {
  const result = await api.GET('/api/tickets/{id}/qr-token', {
    params: { path: { id: ticketId } },
  });
  recordServerDate(result.response);
  const data = unwrap(result);
  return { ...data, expiresAt: serverNow() + data.expiresIn * 1000 };
}

export function useMyTickets() {
  return useQuery({
    queryKey: ticketKeys.my,
    queryFn: fetchMyTickets,
    staleTime: 15_000,
  });
}

export function useEvent(eventId: string | undefined) {
  return useQuery({
    queryKey: ticketKeys.event(eventId ?? 'unknown'),
    queryFn: () => fetchEvent(eventId as string),
    enabled: Boolean(eventId),
    staleTime: 5 * 60_000,
  });
}

/** Event names live in event-service; tickets only carry eventId (B5). */
export function useEvents(eventIds: string[]) {
  const ids = Array.from(new Set(eventIds));
  const queries = useQueries({
    queries: ids.map((id) => ({
      queryKey: ticketKeys.event(id),
      queryFn: () => fetchEvent(id),
      staleTime: 5 * 60_000,
    })),
  });

  const byId = new Map<string, Event>();
  ids.forEach((id, index) => {
    const data = queries[index]?.data;
    if (data) byId.set(id, data);
  });

  return {
    byId,
    isLoading: queries.some((query) => query.isLoading),
    error: queries.find((query) => query.error)?.error ?? null,
  };
}

export function useQrToken(ticketId: string, enabled = true) {
  return useQuery({
    queryKey: ticketKeys.qr(ticketId),
    queryFn: () => fetchQrToken(ticketId),
    enabled,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchInterval: (query) => {
      const data = query.state.data;
      return data ? Math.max(1_000, data.expiresAt - serverNow()) : false;
    },
  });
}

export type { Event, TicketSummary };
export type EventSession = EventComponents['schemas']['Session'];
