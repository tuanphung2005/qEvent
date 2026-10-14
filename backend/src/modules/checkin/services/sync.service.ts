import { prisma } from "../../../plugins/prisma";

export async function handleSync(body: any, currentUser: any, set: any) {
  if (!currentUser) {
    set.status = 401;
    return { error: "Unauthorized: Staff login required" };
  }

  // Accept logs array either as `body.logs` or `body.scans`
  const rawList = body?.logs || body?.scans || [];
  if (!Array.isArray(rawList) || rawList.length === 0) {
    return { processed: 0, synced: 0, conflicts: 0, results: [] };
  }

  // Normalize structure: ticketId, scannedAt, deviceId
  const normalizedLogs = rawList.map((item: any) => ({
    ticketId: item.ticketId || item.id,
    scannedAt: item.scannedAt || (item.timestamp ? new Date(item.timestamp).toISOString() : new Date().toISOString()),
    deviceId: item.deviceId || item.gate || "offline_device",
  }));

  // Sort chronologically ascending
  const sortedLogs = [...normalizedLogs].sort(
    (a, b) => new Date(a.scannedAt).getTime() - new Date(b.scannedAt).getTime()
  );

  const results = [];
  let syncedCount = 0;
  let conflictCount = 0;

  for (const item of sortedLogs) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: item.ticketId },
      include: { user: true, ticketType: true },
    });

    if (!ticket) {
      results.push({
        ticketId: item.ticketId,
        status: "ERROR",
        reason: "Ticket not found",
      });
      continue;
    }

    const scanDate = new Date(item.scannedAt);

    // Conflict detection: if ticket already CHECKED_IN
    if (ticket.status === "CHECKED_IN") {
      const log = await prisma.checkinLog.create({
        data: {
          ticketId: ticket.id,
          staffId: currentUser.id,
          scannedAt: scanDate,
          deviceId: item.deviceId,
          isOffline: true,
          syncStatus: "CONFLICT",
        },
      });

      conflictCount++;
      results.push({
        ticketId: ticket.id,
        status: "CONFLICT",
        syncStatus: "CONFLICT",
        message: "Vé đã được check-in trước thời điểm quét này",
        logId: log.id,
      });
    } else {
      // First valid check-in
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          status: "CHECKED_IN",
          checkedInAt: scanDate,
        },
      });

      const log = await prisma.checkinLog.create({
        data: {
          ticketId: ticket.id,
          staffId: currentUser.id,
          scannedAt: scanDate,
          deviceId: item.deviceId,
          isOffline: true,
          syncStatus: "SYNCED",
        },
      });

      syncedCount++;
      results.push({
        ticketId: ticket.id,
        status: "SYNCED",
        syncStatus: "SYNCED",
        attendeeName: ticket.user.fullName,
        logId: log.id,
      });
    }
  }

  return {
    processed: sortedLogs.length,
    synced: syncedCount,
    conflicts: conflictCount,
    results,
  };
}
