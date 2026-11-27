import { getCachedTicket, upsertCachedTickets } from '@/lib/offline/cache';
import { enqueueScan, listQueue } from '@/lib/offline/queue';
import { syncQueue } from '@/lib/offline/sync';
import { createTestDb } from '@/test/sqlite-test-db';

async function seed(db: ReturnType<typeof createTestDb>) {
  await upsertCachedTickets(db, [
    {
      ticketId: 'ticket-1',
      eventId: 'event-1',
      eventName: 'Tech Summit',
      ticketTypeName: 'Standard',
      status: 'PAID',
      orderStatus: 'CONFIRMED',
      attendeeName: 'A',
      checkedInAt: null,
      updatedAt: '2026-11-09T08:00:00.000Z',
    },
    {
      ticketId: 'ticket-2',
      eventId: 'event-1',
      eventName: 'Tech Summit',
      ticketTypeName: 'Standard',
      status: 'PAID',
      orderStatus: 'CONFIRMED',
      attendeeName: 'B',
      checkedInAt: null,
      updatedAt: '2026-11-09T08:00:00.000Z',
    },
  ]);

  await enqueueScan(db, {
    ticketId: 'ticket-1',
    eventId: 'event-1',
    scannedAt: '2026-11-09T09:00:00.000Z',
    deviceId: 'device-1',
    gate: 'gate-1',
    qrToken: 'token-1',
  });
  await enqueueScan(db, {
    ticketId: 'ticket-2',
    eventId: 'event-1',
    scannedAt: '2026-11-09T09:00:01.000Z',
    deviceId: 'device-1',
    gate: 'gate-1',
  });
}

describe('syncQueue', () => {
  it('sends qrToken, removes terminal statuses and marks synced tickets', async () => {
    const db = createTestDb();
    await seed(db);

    let sent: any;
    const summary = await syncQueue({
      db,
      eventId: 'event-1',
      call: async (input) => {
        sent = input;
        return {
          data: {
            processed: 2,
            synced: 1,
            conflicts: 1,
            duplicates: 0,
            results: [
              { ticketId: 'ticket-1', status: 'SYNCED' as const },
              { ticketId: 'ticket-2', status: 'CONFLICT' as const, message: 'already' },
            ],
          },
          response: new Response('{}', { headers: { date: new Date().toUTCString() } }),
        };
      },
    });

    expect(sent.logs[0]).toMatchObject({ ticketId: 'ticket-1', qrToken: 'token-1' });
    expect(summary.synced).toBe(1);
    expect(summary.conflicts).toBe(1);
    expect(summary.remaining).toBe(0);
    expect((await getCachedTicket(db, 'ticket-1'))?.status).toBe('CHECKED_IN');
    expect(await listQueue(db)).toHaveLength(0);
    db.close();
  });

  it('counts deterministic server errors and stops after three attempts', async () => {
    const db = createTestDb();
    await enqueueScan(db, {
      ticketId: 'ticket-1',
      eventId: 'event-1',
      scannedAt: '2026-11-09T09:00:00.000Z',
      deviceId: 'device-1',
    });

    let calls = 0;
    const failing = async () => {
      calls += 1;
      return {
        data: {
          processed: 1,
          synced: 0,
          conflicts: 0,
          duplicates: 0,
          results: [{ ticketId: 'ticket-1', status: 'ERROR' as const, reason: 'TICKET_NOT_FOUND' }],
        },
        response: new Response('{}'),
      };
    };

    let summary = await syncQueue({ db, eventId: 'event-1', call: failing });
    expect(summary.errors).toBe(1);
    expect(summary.remaining).toBe(1);
    expect((await listQueue(db))[0].attempts).toBe(1);

    await syncQueue({ db, eventId: 'event-1', call: failing });
    summary = await syncQueue({ db, eventId: 'event-1', call: failing });
    expect((await listQueue(db))[0].attempts).toBe(3);

    // Exhausted rows stay visible but are no longer sent.
    summary = await syncQueue({ db, eventId: 'event-1', call: failing });
    expect(summary.processed).toBe(0);
    expect(summary.remaining).toBe(1);
    expect(calls).toBe(3);
    db.close();
  });

  it('keeps rows retryable after a network failure', async () => {
    const db = createTestDb();
    await enqueueScan(db, {
      ticketId: 'ticket-1',
      eventId: 'event-1',
      scannedAt: '2026-11-09T09:00:00.000Z',
      deviceId: 'device-1',
    });

    const offline = async () => {
      throw new Error('Network request failed');
    };

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await syncQueue({ db, eventId: 'event-1', call: offline });
    }
    expect((await listQueue(db))[0].attempts).toBe(0);

    const summary = await syncQueue({
      db,
      eventId: 'event-1',
      call: async () => ({
        data: {
          processed: 1,
          synced: 1,
          conflicts: 0,
          duplicates: 0,
          results: [{ ticketId: 'ticket-1', status: 'SYNCED' as const }],
        },
        response: new Response('{}'),
      }),
    });
    expect(summary.synced).toBe(1);
    expect(await listQueue(db)).toHaveLength(0);
    db.close();
  });

  it('only sends scans belonging to the synced event', async () => {
    const db = createTestDb();
    await enqueueScan(db, {
      ticketId: 'ticket-a',
      eventId: 'event-a',
      scannedAt: '2026-11-09T09:00:00.000Z',
      deviceId: 'device-1',
    });
    await enqueueScan(db, {
      ticketId: 'ticket-b',
      eventId: 'event-b',
      scannedAt: '2026-11-09T09:00:01.000Z',
      deviceId: 'device-1',
    });

    let sent: string[] = [];
    const summary = await syncQueue({
      db,
      eventId: 'event-a',
      call: async ({ logs }) => {
        sent = logs.map((log) => log.ticketId);
        return {
          data: {
            processed: logs.length,
            synced: logs.length,
            conflicts: 0,
            duplicates: 0,
            results: logs.map((log) => ({ ticketId: log.ticketId, status: 'SYNCED' as const })),
          },
          response: new Response('{}'),
        };
      },
    });

    expect(sent).toEqual(['ticket-a']);
    expect(summary.remaining).toBe(1);
    expect((await listQueue(db, 'event-b')).map((scan) => scan.ticketId)).toEqual(['ticket-b']);
    db.close();
  });

  it('clears DUPLICATE rows without changing cached state', async () => {
    const db = createTestDb();
    await seed(db);

    const summary = await syncQueue({
      db,
      eventId: 'event-1',
      call: async () => ({
        data: {
          processed: 2,
          synced: 0,
          conflicts: 0,
          duplicates: 2,
          results: [
            { ticketId: 'ticket-1', status: 'DUPLICATE' as const },
            { ticketId: 'ticket-2', status: 'DUPLICATE' as const },
          ],
        },
        response: new Response('{}'),
      }),
    });

    expect(summary.duplicates).toBe(2);
    expect(summary.remaining).toBe(0);
    expect((await getCachedTicket(db, 'ticket-1'))?.status).toBe('PAID');
    db.close();
  });
});
