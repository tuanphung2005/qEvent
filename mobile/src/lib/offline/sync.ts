import { api, recordServerDate } from '@/api/client';
import { unwrap } from '@/api/errors';

import { markCachedTicketCheckedIn } from './cache';
import type { OfflineDb } from './db';
import {
  MAX_ATTEMPTS,
  countQueue,
  listQueue,
  recordAttempt,
  removeFromQueue,
  type QueuedScan,
} from './queue';

const BATCH_SIZE = 500;

export type SyncStatus = 'SYNCED' | 'CONFLICT' | 'DUPLICATE' | 'ERROR';

export type SyncResult = {
  ticketId: string;
  status: SyncStatus;
  reason?: string;
  message?: string;
  attendeeName?: string;
};

export type SyncSummary = {
  processed: number;
  synced: number;
  conflicts: number;
  duplicates: number;
  errors: number;
  remaining: number;
  results: SyncResult[];
};

export type OfflineLog = {
  ticketId: string;
  scannedAt: string;
  deviceId: string;
  qrToken?: string;
};

type SyncResponse = {
  processed: number;
  synced: number;
  conflicts: number;
  duplicates: number;
  results: SyncResult[];
};

type SyncCall = (input: {
  eventId: string;
  logs: OfflineLog[];
}) => Promise<{ data: SyncResponse; response: Response }>;

const defaultCall: SyncCall = async ({ eventId, logs }) => {
  const result = await api.POST('/api/checkins/sync-offline', {
    body: { eventId, logs },
  });
  recordServerDate(result.response);
  return { data: unwrap(result, 'Đồng bộ thất bại.'), response: result.response };
};

function toLog(scan: QueuedScan): OfflineLog {
  return {
    ticketId: scan.ticketId,
    scannedAt: scan.scannedAt,
    deviceId: scan.deviceId,
    ...(scan.qrToken ? { qrToken: scan.qrToken } : {}),
  };
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    out.push(items.slice(index, index + size));
  }
  return out;
}

/**
 * Pushes the local queue in chronological batches. Terminal statuses leave the
 * queue; ERROR stays for retry, capped at MAX_ATTEMPTS so a poison record cannot
 * block the gate forever.
 */
export async function syncQueue(options: {
  db: OfflineDb;
  eventId: string;
  call?: SyncCall;
  batchSize?: number;
}): Promise<SyncSummary> {
  const { db, eventId } = options;
  const call = options.call ?? defaultCall;
  const batchSize = Math.min(options.batchSize ?? BATCH_SIZE, BATCH_SIZE);

  const queue = await listQueue(db, eventId, BATCH_SIZE * 4);
  const retryable = queue.filter((scan) => scan.attempts < MAX_ATTEMPTS);

  const summary: SyncSummary = {
    processed: 0,
    synced: 0,
    conflicts: 0,
    duplicates: 0,
    errors: 0,
    remaining: 0,
    results: [],
  };

  if (retryable.length === 0) {
    summary.remaining = await countQueue(db);
    return summary;
  }

  const completed: string[] = [];
  const checkedIn: { ticketId: string; scannedAt: string }[] = [];

  for (const batch of chunk(retryable, batchSize)) {
    let data: SyncResponse;
    try {
      ({ data } = await call({ eventId, logs: batch.map(toLog) }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Đồng bộ thất bại';
      // Network / 5xx is transient: do NOT spend a retry, or three offline taps
      // would permanently remove every queued check-in from the next sync.
      summary.errors += batch.length;
      summary.results.push(
        ...batch.map((scan) => ({ ticketId: scan.ticketId, status: 'ERROR' as const, message }))
      );
      continue;
    }

    summary.processed += data.processed;
    summary.synced += data.synced;
    summary.conflicts += data.conflicts;
    summary.duplicates += data.duplicates;

    const byTicket = new Map(data.results.map((result) => [result.ticketId, result]));

    for (const scan of batch) {
      const result = byTicket.get(scan.ticketId);
      if (!result) {
        await recordAttempt(db, scan.ticketId, 'MISSING_RESULT');
        summary.errors += 1;
        summary.results.push({
          ticketId: scan.ticketId,
          status: 'ERROR',
          reason: 'MISSING_RESULT',
        });
        continue;
      }

      summary.results.push(result);

      if (result.status === 'SYNCED') {
        completed.push(scan.ticketId);
        checkedIn.push({ ticketId: scan.ticketId, scannedAt: scan.scannedAt });
      } else if (result.status === 'DUPLICATE' || result.status === 'CONFLICT') {
        completed.push(scan.ticketId);
      } else {
        summary.errors += 1;
        await recordAttempt(db, scan.ticketId, result.reason ?? result.message ?? 'ERROR');
      }
    }
  }

  await removeFromQueue(db, completed);
  for (const entry of checkedIn) {
    await markCachedTicketCheckedIn(db, entry.ticketId, entry.scannedAt);
  }

  summary.remaining = await countQueue(db);
  return summary;
}
