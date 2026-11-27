import { DatabaseSync } from 'node:sqlite';

import { OFFLINE_SCHEMA, type OfflineDb, type SqlValue } from '@/lib/offline/db';

/**
 * Test-only adapter over node:sqlite so cache/queue/sync logic is exercised
 * against real SQL instead of a mock that can drift from the SQLite dialect.
 */
export function createTestDb(): OfflineDb & { close(): void } {
  const db = new DatabaseSync(':memory:');
  db.exec(OFFLINE_SCHEMA);

  return {
    async exec(sql: string) {
      db.exec(sql);
    },
    async run(sql: string, params: SqlValue[] = []) {
      db.prepare(sql).run(...params);
    },
    async all<T>(sql: string, params: SqlValue[] = []) {
      return db.prepare(sql).all(...params) as T[];
    },
    async get<T>(sql: string, params: SqlValue[] = []) {
      return (db.prepare(sql).get(...params) ?? null) as T | null;
    },
    close() {
      db.close();
    },
  };
}
