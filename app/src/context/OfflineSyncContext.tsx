import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { offlineDb, CachedTicket } from "../services/db";
import { networkService } from "../services/network";
import { api } from "../api/client";
import * as Crypto from "expo-crypto";

interface OfflineSyncContextType {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  refreshPendingCount: () => Promise<void>;
  downloadCache: (eventId: string) => Promise<{ count: number }>;
  processOfflineScan: (ticketId: string) => Promise<{
    status: "VALID" | "ALREADY_CHECKED_IN" | "NOT_FOUND";
    ticket?: CachedTicket;
    message: string;
  }>;
  syncPendingQueue: () => Promise<{
    processed: number;
    synced: number;
    conflicts: number;
  }>;
}

const OfflineSyncContext = createContext<OfflineSyncContextType>({} as any);

export const OfflineSyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [deviceId] = useState(() => Crypto.randomUUID());

  const refreshPendingCount = useCallback(async () => {
    const count = await offlineDb.getPendingCount();
    setPendingCount(count);
  }, []);

  useEffect(() => {
    async function init() {
      await offlineDb.init();
      const online = await networkService.isOnline();
      setIsOnline(online);
      await refreshPendingCount();
    }
    init();

    const interval = setInterval(async () => {
      const online = await networkService.isOnline();
      setIsOnline(online);
      await refreshPendingCount();
    }, 5000);

    return () => clearInterval(interval);
  }, [refreshPendingCount]);

  const downloadCache = async (eventId: string) => {
    const res = await api.getEventCache(eventId);
    if (res?.tickets) {
      await offlineDb.saveTicketsToCache(res.tickets);
      return { count: res.tickets.length };
    }
    return { count: 0 };
  };

  const processOfflineScan = async (ticketId: string) => {
    const cachedTicket = await offlineDb.getCachedTicket(ticketId);
    const scannedAt = new Date().toISOString();

    if (!cachedTicket) {
      // Not in local cache
      await offlineDb.enqueueOfflineScan(ticketId, scannedAt, deviceId);
      await refreshPendingCount();
      return {
        status: "NOT_FOUND" as const,
        message: "Vé không có trong bộ nhớ đệm ngoại tuyến",
      };
    }

    if (cachedTicket.status === "CHECKED_IN") {
      // Duplicate local scan!
      await offlineDb.enqueueOfflineScan(ticketId, scannedAt, deviceId);
      await refreshPendingCount();
      return {
        status: "ALREADY_CHECKED_IN" as const,
        ticket: cachedTicket,
        message: "VÉ ĐÃ QUÉT TRƯỚC ĐÓ (Offline Cache)",
      };
    }

    // Mark as checked in locally
    await offlineDb.markTicketCheckedIn(ticketId, scannedAt);
    await offlineDb.enqueueOfflineScan(ticketId, scannedAt, deviceId);
    await refreshPendingCount();

    return {
      status: "VALID" as const,
      ticket: cachedTicket,
      message: "Check-in ngoại tuyến thành công (Đã lưu vào queue)",
    };
  };

  const syncPendingQueue = async () => {
    setIsSyncing(true);
    try {
      const pending = await offlineDb.getPendingScans();
      if (pending.length === 0) {
        return { processed: 0, synced: 0, conflicts: 0 };
      }

      const logs = pending.map((p) => ({
        ticketId: p.ticketId,
        scannedAt: p.scannedAt,
        deviceId: p.deviceId,
      }));

      const res = await api.syncOfflineScans(logs);

      // Mark local scans synced
      const syncedIds = pending.map((p) => p.id);
      await offlineDb.markScansSynced(syncedIds);
      await offlineDb.clearPendingQueue();
      await refreshPendingCount();

      return {
        processed: res.processed,
        synced: res.synced,
        conflicts: res.conflicts,
      };
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <OfflineSyncContext.Provider
      value={{
        isOnline,
        pendingCount,
        isSyncing,
        refreshPendingCount,
        downloadCache,
        processOfflineScan,
        syncPendingQueue,
      }}
    >
      {children}
    </OfflineSyncContext.Provider>
  );
};

export const useOfflineSync = () => useContext(OfflineSyncContext);
