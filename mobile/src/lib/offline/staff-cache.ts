import { api, recordServerDate } from '@/api/client';
import { unwrap } from '@/api/errors';

import { setMeta, upsertCachedTickets, META_KEYS, type CachedTicket } from './cache';
import type { OfflineDb } from './db';

const PAGE_SIZE = 100;

export type StaffTicketPage = {
  tickets: {
    id: string;
    eventId: string;
    status: string;
    orderStatus: string;
    attendee?: { fullName: string } | null;
    checkedInAt: string | null;
    updatedAt: string;
    ticketTypeName?: string | null;
  }[];
  nextCursor: string | null;
};

export type FetchTicketsPage = (input: {
  eventId: string;
  cursor?: string;
  limit: number;
}) => Promise<StaffTicketPage>;

const defaultFetchPage: FetchTicketsPage = async ({ eventId, cursor, limit }) => {
  const result = await api.GET('/api/tickets', {
    params: { query: { eventId, cursor, limit } },
  });
  recordServerDate(result.response);
  const data = unwrap(result, 'Không tải được danh sách vé để cache.');

  return {
    tickets: data.tickets.map((ticket) => ({
      id: ticket.id,
      eventId: ticket.eventId,
      status: ticket.status,
      orderStatus: ticket.orderStatus,
      attendee: ticket.attendee ? { fullName: ticket.attendee.fullName } : null,
      checkedInAt: ticket.checkedInAt ?? null,
      updatedAt: ticket.updatedAt,
      ticketTypeName: null,
    })),
    nextCursor: data.nextCursor ?? null,
  };
};

/**
 * Pulls the whole event ticket set into SQLite, following nextCursor. A single
 * page is not enough: a 500-person event would silently scan with 100 tickets.
 */
export async function cacheTicketsForEvent(options: {
  db: OfflineDb;
  eventId: string;
  eventName?: string | null;
  fetchPage?: FetchTicketsPage;
}): Promise<{ cached: number; pages: number }> {
  const { db, eventId, eventName } = options;
  const fetchPage = options.fetchPage ?? defaultFetchPage;
  let cursor: string | undefined;
  let pages = 0;
  let cached = 0;

  do {
    const page = await fetchPage({ eventId, cursor, limit: PAGE_SIZE });
    pages += 1;

    const tickets: CachedTicket[] = page.tickets.map((ticket) => ({
      ticketId: ticket.id,
      eventId: ticket.eventId,
      eventName: eventName ?? null,
      ticketTypeName: ticket.ticketTypeName ?? null,
      status: ticket.status,
      orderStatus: ticket.orderStatus,
      attendeeName: ticket.attendee?.fullName ?? null,
      checkedInAt: ticket.checkedInAt,
      updatedAt: ticket.updatedAt,
    }));

    await upsertCachedTickets(db, tickets);
    cached += tickets.length;
    cursor = page.nextCursor ?? undefined;
  } while (cursor);

  await setMeta(db, META_KEYS.lastCacheAt, new Date().toISOString());
  await setMeta(db, META_KEYS.lastCacheEventId, eventId);

  return { cached, pages };
}
