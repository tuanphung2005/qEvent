import { countCachedTickets, getCachedTicket, getMeta, META_KEYS } from '@/lib/offline/cache';
import { cacheTicketsForEvent, type StaffTicketPage } from '@/lib/offline/staff-cache';
import { createTestDb } from '@/test/sqlite-test-db';

function ticketPage(ids: string[], eventId: string, nextCursor: string | null): StaffTicketPage {
  return {
    tickets: ids.map((id) => ({
      id,
      eventId,
      status: 'PAID',
      orderStatus: 'CONFIRMED',
      attendee: { fullName: `Attendee ${id}` },
      checkedInAt: null,
      updatedAt: '2026-11-09T08:00:00.000Z',
    })),
    nextCursor,
  };
}

describe('cacheTicketsForEvent', () => {
  it('follows nextCursor until the last page', async () => {
    const db = createTestDb();
    const calls: (string | undefined)[] = [];

    const result = await cacheTicketsForEvent({
      db,
      eventId: 'event-1',
      eventName: 'Tech Summit',
      fetchPage: async ({ cursor }) => {
        calls.push(cursor);
        if (!cursor) return ticketPage(['a', 'b'], 'event-1', 'page-2');
        if (cursor === 'page-2') return ticketPage(['c'], 'event-1', 'page-3');
        return ticketPage(['d'], 'event-1', null);
      },
    });

    expect(result).toEqual({ cached: 4, pages: 3 });
    expect(calls).toEqual([undefined, 'page-2', 'page-3']);
    expect(await countCachedTickets(db, 'event-1')).toBe(4);
    expect((await getCachedTicket(db, 'd'))?.attendeeName).toBe('Attendee d');
    expect(await getMeta(db, META_KEYS.lastCacheEventId)).toBe('event-1');
    expect(await getMeta(db, META_KEYS.lastCacheAt)).not.toBeNull();
    db.close();
  });

  it('stops after one page when nextCursor is null', async () => {
    const db = createTestDb();
    let calls = 0;

    const result = await cacheTicketsForEvent({
      db,
      eventId: 'event-1',
      fetchPage: async () => {
        calls += 1;
        return ticketPage(['a'], 'event-1', null);
      },
    });

    expect(result).toEqual({ cached: 1, pages: 1 });
    expect(calls).toBe(1);
    db.close();
  });
});
