import type { OfflineDb, SqlValue } from './db';

export type CachedTicket = {
  ticketId: string;
  eventId: string;
  eventName: string | null;
  ticketTypeName: string | null;
  status: string;
  orderStatus: string;
  attendeeName: string | null;
  checkedInAt: string | null;
  updatedAt: string;
};

type Row = {
  ticket_id: string;
  event_id: string;
  event_name: string | null;
  ticket_type_name: string | null;
  status: string;
  order_status: string;
  attendee_name: string | null;
  checked_in_at: string | null;
  updated_at: string;
};

function fromRow(row: Row): CachedTicket {
  return {
    ticketId: row.ticket_id,
    eventId: row.event_id,
    eventName: row.event_name,
    ticketTypeName: row.ticket_type_name,
    status: row.status,
    orderStatus: row.order_status,
    attendeeName: row.attendee_name,
    checkedInAt: row.checked_in_at,
    updatedAt: row.updated_at,
  };
}

export async function upsertCachedTickets(db: OfflineDb, tickets: CachedTicket[]): Promise<void> {
  for (const ticket of tickets) {
    await db.run(
      `INSERT INTO cached_tickets
        (ticket_id, event_id, event_name, ticket_type_name, status, order_status, attendee_name, checked_in_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(ticket_id) DO UPDATE SET
         event_id = excluded.event_id,
         event_name = COALESCE(excluded.event_name, cached_tickets.event_name),
         ticket_type_name = COALESCE(excluded.ticket_type_name, cached_tickets.ticket_type_name),
         status = excluded.status,
         order_status = excluded.order_status,
         attendee_name = COALESCE(excluded.attendee_name, cached_tickets.attendee_name),
         checked_in_at = excluded.checked_in_at,
         updated_at = excluded.updated_at`,
      [
        ticket.ticketId,
        ticket.eventId,
        ticket.eventName,
        ticket.ticketTypeName,
        ticket.status,
        ticket.orderStatus,
        ticket.attendeeName,
        ticket.checkedInAt,
        ticket.updatedAt,
      ]
    );
  }
}

export async function getCachedTickets(db: OfflineDb, eventId?: string): Promise<CachedTicket[]> {
  const rows = eventId
    ? await db.all<Row>(
        'SELECT * FROM cached_tickets WHERE event_id = ? ORDER BY attendee_name ASC',
        [eventId]
      )
    : await db.all<Row>('SELECT * FROM cached_tickets ORDER BY attendee_name ASC');
  return rows.map(fromRow);
}

export async function getCachedTicket(
  db: OfflineDb,
  ticketId: string
): Promise<CachedTicket | null> {
  const row = await db.get<Row>('SELECT * FROM cached_tickets WHERE ticket_id = ?', [ticketId]);
  return row ? fromRow(row) : null;
}

export async function countCachedTickets(db: OfflineDb, eventId?: string): Promise<number> {
  const row = eventId
    ? await db.get<{ count: number }>(
        'SELECT COUNT(*) AS count FROM cached_tickets WHERE event_id = ?',
        [eventId]
      )
    : await db.get<{ count: number }>('SELECT COUNT(*) AS count FROM cached_tickets');
  return row?.count ?? 0;
}

export async function markCachedTicketCheckedIn(
  db: OfflineDb,
  ticketId: string,
  checkedInAt: string
): Promise<void> {
  await db.run(
    `UPDATE cached_tickets SET status = 'CHECKED_IN', checked_in_at = ? WHERE ticket_id = ?`,
    [checkedInAt, ticketId]
  );
}

export async function setMeta(db: OfflineDb, key: string, value: string): Promise<void> {
  await db.run(
    `INSERT INTO app_meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value]
  );
}

export async function getMeta(db: OfflineDb, key: string): Promise<string | null> {
  const row = await db.get<{ value: string }>('SELECT value FROM app_meta WHERE key = ?', [key]);
  return row?.value ?? null;
}

export async function deleteMeta(db: OfflineDb, key: string): Promise<void> {
  await db.run('DELETE FROM app_meta WHERE key = ?', [key]);
}

export const META_KEYS = {
  publicKey: 'qr.publicKey',
  publicKeyId: 'qr.publicKeyId',
  publicKeyFetchedAt: 'qr.publicKeyFetchedAt',
  lastCacheAt: 'cache.lastAt',
  lastCacheEventId: 'cache.eventId',
} as const;

export type { SqlValue };
