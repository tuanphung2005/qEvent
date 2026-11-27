/**
 * Tiny async DB seam. Mapping to expo-sqlite lives here so cache/queue logic can
 * be unit-tested with node:sqlite or a fake without a native runtime.
 */
export type SqlValue = string | number | null;

export interface OfflineDb {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlValue[]): Promise<void>;
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
  get<T>(sql: string, params?: SqlValue[]): Promise<T | null>;
}

export const OFFLINE_SCHEMA = `
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS cached_tickets (
  ticket_id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL,
  event_name TEXT,
  ticket_type_name TEXT,
  status TEXT NOT NULL,
  order_status TEXT NOT NULL,
  attendee_name TEXT,
  checked_in_at TEXT,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cached_tickets_event ON cached_tickets(event_id);
CREATE TABLE IF NOT EXISTS scan_queue (
  ticket_id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL,
  scanned_at TEXT NOT NULL,
  device_id TEXT NOT NULL,
  gate TEXT,
  qr_token TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
`;

let dbPromise: Promise<OfflineDb> | null = null;
let migrated = false;

/**
 * Existing dev installs created scan_queue without event_id. SQLite cannot add a
 * NOT NULL column without a default, so old rows get '' and are never synced.
 */
async function migrate(db: OfflineDb): Promise<void> {
  const columns = await db.all<{ name: string }>('PRAGMA table_info(scan_queue)');
  if (!columns.some((column) => column.name === 'event_id')) {
    await db.exec("ALTER TABLE scan_queue ADD COLUMN event_id TEXT NOT NULL DEFAULT ''");
  }
}

async function openExpoDb(): Promise<OfflineDb> {
  const SQLite = await import('expo-sqlite');
  const db = await SQLite.openDatabaseAsync('qevent.db');

  return {
    async exec(sql) {
      await db.execAsync(sql);
    },
    async run(sql, params = []) {
      await db.runAsync(sql, params);
    },
    async all<T>(sql: string, params: SqlValue[] = []) {
      return (await db.getAllAsync(sql, params)) as T[];
    },
    async get<T>(sql: string, params: SqlValue[] = []) {
      return (await db.getFirstAsync(sql, params)) as T | null;
    },
  };
}

export async function getOfflineDb(): Promise<OfflineDb> {
  if (!dbPromise) dbPromise = openExpoDb();
  const db = await dbPromise;
  if (!migrated) {
    await db.exec(OFFLINE_SCHEMA);
    await migrate(db);
    migrated = true;
  }
  return db;
}

/** Test-only hook. */
export function setOfflineDb(db: OfflineDb | null): void {
  if (db) {
    dbPromise = Promise.resolve(db);
    migrated = true;
  } else {
    dbPromise = null;
    migrated = false;
  }
}
