import type { OfflineDb } from './db';

export type QueuedScan = {
  ticketId: string;
  eventId: string;
  scannedAt: string;
  deviceId: string;
  gate: string | null;
  qrToken: string | null;
  attempts: number;
  lastError: string | null;
  createdAt: string;
};

export type NewScan = {
  ticketId: string;
  eventId: string;
  scannedAt: string;
  deviceId: string;
  gate?: string | null;
  qrToken?: string | null;
};

type Row = {
  ticket_id: string;
  event_id: string;
  scanned_at: string;
  device_id: string;
  gate: string | null;
  qr_token: string | null;
  attempts: number;
  last_error: string | null;
  created_at: string;
};

function fromRow(row: Row): QueuedScan {
  return {
    ticketId: row.ticket_id,
    eventId: row.event_id,
    scannedAt: row.scanned_at,
    deviceId: row.device_id,
    gate: row.gate,
    qrToken: row.qr_token,
    attempts: row.attempts,
    lastError: row.last_error,
    createdAt: row.created_at,
  };
}

const MAX_ATTEMPTS = 3;

/**
 * One queue row per ticket: scanning the same ticket twice on the same device is
 * a duplicate, not a second check-in.
 */
export async function enqueueScan(db: OfflineDb, scan: NewScan): Promise<boolean> {
  const existing = await db.get<{ ticket_id: string }>(
    'SELECT ticket_id FROM scan_queue WHERE ticket_id = ?',
    [scan.ticketId]
  );
  if (existing) return false;

  await db.run(
    `INSERT INTO scan_queue (ticket_id, event_id, scanned_at, device_id, gate, qr_token, attempts, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
    [
      scan.ticketId,
      scan.eventId,
      scan.scannedAt,
      scan.deviceId,
      scan.gate ?? null,
      scan.qrToken ?? null,
      new Date().toISOString(),
    ]
  );
  return true;
}

export async function listQueue(
  db: OfflineDb,
  eventId?: string,
  limit = 500
): Promise<QueuedScan[]> {
  const rows = eventId
    ? await db.all<Row>(
        'SELECT * FROM scan_queue WHERE event_id = ? ORDER BY scanned_at ASC LIMIT ?',
        [eventId, limit]
      )
    : await db.all<Row>('SELECT * FROM scan_queue ORDER BY scanned_at ASC LIMIT ?', [limit]);
  return rows.map(fromRow);
}

export async function countQueue(db: OfflineDb, eventId?: string): Promise<number> {
  const row = eventId
    ? await db.get<{ count: number }>(
        'SELECT COUNT(*) AS count FROM scan_queue WHERE event_id = ?',
        [eventId]
      )
    : await db.get<{ count: number }>('SELECT COUNT(*) AS count FROM scan_queue');
  return row?.count ?? 0;
}

export async function removeFromQueue(db: OfflineDb, ticketIds: string[]): Promise<void> {
  for (const ticketId of ticketIds) {
    await db.run('DELETE FROM scan_queue WHERE ticket_id = ?', [ticketId]);
  }
}

export async function recordAttempt(
  db: OfflineDb,
  ticketId: string,
  error: string
): Promise<void> {
  await db.run(
    'UPDATE scan_queue SET attempts = attempts + 1, last_error = ? WHERE ticket_id = ?',
    [error, ticketId]
  );
}

/** Errors that will never succeed on retry; keep them visible but stop syncing. */
export async function isExhausted(db: OfflineDb, ticketId: string): Promise<boolean> {
  const row = await db.get<{ attempts: number }>(
    'SELECT attempts FROM scan_queue WHERE ticket_id = ?',
    [ticketId]
  );
  return (row?.attempts ?? 0) >= MAX_ATTEMPTS;
}

export { MAX_ATTEMPTS };
