import {
  countCachedTickets,
  getCachedTicket,
  getMeta,
  markCachedTicketCheckedIn,
  setMeta,
  upsertCachedTickets,
  type CachedTicket,
} from '@/lib/offline/cache';
import {
  countQueue,
  enqueueScan,
  isExhausted,
  listQueue,
  recordAttempt,
  removeFromQueue,
} from '@/lib/offline/queue';
import { createTestDb } from '@/test/sqlite-test-db';

const ticket: CachedTicket = {
  ticketId: 'ticket-1',
  eventId: 'event-1',
  eventName: 'Tech Summit',
  ticketTypeName: 'Standard',
  status: 'PAID',
  orderStatus: 'CONFIRMED',
  attendeeName: 'Nguyen Van A',
  checkedInAt: null,
  updatedAt: '2026-11-09T08:00:00.000Z',
};

describe('ticket cache', () => {
  it('upserts, reads and marks a ticket checked in', async () => {
    const db = createTestDb();
    await upsertCachedTickets(db, [ticket, { ...ticket, ticketId: 'ticket-2' }]);

    expect(await countCachedTickets(db, 'event-1')).toBe(2);
    expect((await getCachedTicket(db, 'ticket-1'))?.status).toBe('PAID');

    await upsertCachedTickets(db, [{ ...ticket, status: 'CHECKED_IN', attendeeName: null }]);
    const updated = await getCachedTicket(db, 'ticket-1');
    expect(updated?.status).toBe('CHECKED_IN');
    expect(updated?.attendeeName).toBe('Nguyen Van A');

    await markCachedTicketCheckedIn(db, 'ticket-2', '2026-11-09T09:00:00.000Z');
    expect((await getCachedTicket(db, 'ticket-2'))?.checkedInAt).toBe('2026-11-09T09:00:00.000Z');

    await setMeta(db, 'key', 'value');
    expect(await getMeta(db, 'key')).toBe('value');
    db.close();
  });
});

describe('scan queue', () => {
  it('dedupes by ticket and tracks retry attempts', async () => {
    const db = createTestDb();
    const scan = {
      ticketId: 'ticket-1',
      eventId: 'event-1',
      scannedAt: '2026-11-09T09:00:00.000Z',
      deviceId: 'device-1',
      gate: 'gate-1',
      qrToken: 'token',
    };

    expect(await enqueueScan(db, scan)).toBe(true);
    expect(await enqueueScan(db, scan)).toBe(false);
    expect(await countQueue(db)).toBe(1);
    expect((await listQueue(db))[0]).toMatchObject({
      gate: 'gate-1',
      qrToken: 'token',
      eventId: 'event-1',
    });

    await recordAttempt(db, 'ticket-1', 'TICKET_NOT_FOUND');
    expect((await listQueue(db))[0].attempts).toBe(1);
    expect(await isExhausted(db, 'ticket-1')).toBe(false);
    await recordAttempt(db, 'ticket-1', 'TICKET_NOT_FOUND');
    await recordAttempt(db, 'ticket-1', 'TICKET_NOT_FOUND');
    expect(await isExhausted(db, 'ticket-1')).toBe(true);

    await removeFromQueue(db, ['ticket-1']);
    expect(await countQueue(db)).toBe(0);
    db.close();
  });

  it('keeps queues separated by event', async () => {
    const db = createTestDb();
    const base = {
      scannedAt: '2026-11-09T09:00:00.000Z',
      deviceId: 'device-1',
    };

    await enqueueScan(db, { ...base, ticketId: 'ticket-a', eventId: 'event-a' });
    await enqueueScan(db, { ...base, ticketId: 'ticket-b', eventId: 'event-b' });

    expect(await countQueue(db)).toBe(2);
    expect(await countQueue(db, 'event-a')).toBe(1);
    expect((await listQueue(db, 'event-a')).map((scan) => scan.ticketId)).toEqual(['ticket-a']);
    expect((await listQueue(db, 'event-b')).map((scan) => scan.ticketId)).toEqual(['ticket-b']);
    db.close();
  });
});
