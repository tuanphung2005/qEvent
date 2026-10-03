import * as SQLite from "expo-sqlite";
import { Platform } from "react-native";
import * as Crypto from "expo-crypto";

export interface CachedTicket {
  id: string;
  eventId: string;
  attendeeName: string;
  attendeeEmail?: string;
  ticketTypeName: string;
  status: "PAID" | "CHECKED_IN" | "CANCELLED";
  totpSecret: string;
  checkedInAt?: string | null;
}

export interface OfflineScanLog {
  id: string;
  ticketId: string;
  scannedAt: string;
  deviceId: string;
  syncStatus: "PENDING" | "SYNCED" | "CONFLICT";
}

class OfflineDatabase {
  private db: SQLite.SQLiteDatabase | null = null;
  private memoryCache: Map<string, CachedTicket> = new Map();
  private memoryQueue: OfflineScanLog[] = [];

  async init() {
    if (Platform.OS === "web") {
      // Memory fallback for browser preview
      return;
    }
    try {
      this.db = await SQLite.openDatabaseAsync("qcheck_offline.db");
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS cached_tickets (
          id TEXT PRIMARY KEY,
          event_id TEXT NOT NULL,
          attendee_name TEXT NOT NULL,
          attendee_email TEXT,
          ticket_type_name TEXT NOT NULL,
          status TEXT NOT NULL,
          totp_secret TEXT NOT NULL,
          checked_in_at TEXT
        );

        CREATE TABLE IF NOT EXISTS offline_scan_queue (
          id TEXT PRIMARY KEY,
          ticket_id TEXT NOT NULL,
          scanned_at TEXT NOT NULL,
          device_id TEXT NOT NULL,
          sync_status TEXT NOT NULL DEFAULT 'PENDING'
        );
      `);
    } catch (err) {
      console.warn("SQLite initialization fallback to memory:", err);
    }
  }

  async saveTicketsToCache(tickets: CachedTicket[]): Promise<void> {
    if (this.db) {
      for (const t of tickets) {
        await this.db.runAsync(
          `INSERT OR REPLACE INTO cached_tickets 
          (id, event_id, attendee_name, attendee_email, ticket_type_name, status, totp_secret, checked_in_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            t.id,
            t.eventId,
            t.attendeeName,
            t.attendeeEmail || "",
            t.ticketTypeName,
            t.status,
            t.totpSecret,
            t.checkedInAt || null,
          ]
        );
      }
    } else {
      tickets.forEach((t) => this.memoryCache.set(t.id, t));
    }
  }

  async getCachedTicket(ticketId: string): Promise<CachedTicket | null> {
    if (this.db) {
      const row = await this.db.getFirstAsync<any>(
        "SELECT * FROM cached_tickets WHERE id = ?",
        [ticketId]
      );
      if (!row) return null;
      return {
        id: row.id,
        eventId: row.event_id,
        attendeeName: row.attendee_name,
        attendeeEmail: row.attendee_email,
        ticketTypeName: row.ticket_type_name,
        status: row.status,
        totpSecret: row.totp_secret,
        checkedInAt: row.checked_in_at,
      };
    } else {
      return this.memoryCache.get(ticketId) || null;
    }
  }

  async markTicketCheckedIn(ticketId: string, scannedAt: string): Promise<void> {
    if (this.db) {
      await this.db.runAsync(
        "UPDATE cached_tickets SET status = 'CHECKED_IN', checked_in_at = ? WHERE id = ?",
        [scannedAt, ticketId]
      );
    } else {
      const t = this.memoryCache.get(ticketId);
      if (t) {
        t.status = "CHECKED_IN";
        t.checkedInAt = scannedAt;
      }
    }
  }

  async enqueueOfflineScan(ticketId: string, scannedAt: string, deviceId: string): Promise<OfflineScanLog> {
    const id = Crypto.randomUUID();
    const item: OfflineScanLog = {
      id,
      ticketId,
      scannedAt,
      deviceId,
      syncStatus: "PENDING",
    };

    if (this.db) {
      await this.db.runAsync(
        `INSERT INTO offline_scan_queue (id, ticket_id, scanned_at, device_id, sync_status)
         VALUES (?, ?, ?, ?, ?)`,
        [id, ticketId, scannedAt, deviceId, "PENDING"]
      );
    } else {
      this.memoryQueue.push(item);
    }

    return item;
  }

  async getPendingScans(): Promise<OfflineScanLog[]> {
    if (this.db) {
      const rows = await this.db.getAllAsync<any>(
        "SELECT * FROM offline_scan_queue WHERE sync_status = 'PENDING' ORDER BY scanned_at ASC"
      );
      return rows.map((r) => ({
        id: r.id,
        ticketId: r.ticket_id,
        scannedAt: r.scanned_at,
        deviceId: r.device_id,
        syncStatus: r.sync_status,
      }));
    } else {
      return this.memoryQueue.filter((q) => q.syncStatus === "PENDING");
    }
  }

  async getPendingCount(): Promise<number> {
    if (this.db) {
      const row = await this.db.getFirstAsync<any>(
        "SELECT COUNT(*) as count FROM offline_scan_queue WHERE sync_status = 'PENDING'"
      );
      return row ? row.count : 0;
    } else {
      return this.memoryQueue.filter((q) => q.syncStatus === "PENDING").length;
    }
  }

  async markScansSynced(scanIds: string[]): Promise<void> {
    if (this.db) {
      for (const id of scanIds) {
        await this.db.runAsync(
          "UPDATE offline_scan_queue SET sync_status = 'SYNCED' WHERE id = ?",
          [id]
        );
      }
    } else {
      this.memoryQueue.forEach((q) => {
        if (scanIds.includes(q.id)) {
          q.syncStatus = "SYNCED";
        }
      });
    }
  }

  async clearPendingQueue(): Promise<void> {
    if (this.db) {
      await this.db.runAsync("DELETE FROM offline_scan_queue WHERE sync_status = 'SYNCED'");
    } else {
      this.memoryQueue = this.memoryQueue.filter((q) => q.syncStatus === "PENDING");
    }
  }
}

export const offlineDb = new OfflineDatabase();
