import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { prisma } from "../../plugins/prisma";
import { verifyDynamicQRToken, verifyTOTP } from "../../config/keys";

export const checkinModule = new Elysia({ prefix: "/api/checkin" })
  .use(
    jwt({
      name: "jwtAuth",
      secret: process.env.JWT_SECRET || "qcheck_super_secret_jwt_key_2026_production_grade",
    })
  )
  .derive(async ({ headers, jwtAuth }) => {
    const authHeader = headers["authorization"];
    if (!authHeader?.startsWith("Bearer ")) {
      return { currentUser: null };
    }
    const token = authHeader.slice(7);
    const payload = await jwtAuth.verify(token);
    if (!payload || typeof payload !== "object" || !("id" in payload)) {
      return { currentUser: null };
    }
    return {
      currentUser: {
        id: payload.id as string,
        email: payload.email as string,
        role: payload.role as string,
      },
    };
  })
  // Check attendance status for the current attendee in an event
  .get("/status/:eventId", async ({ params, currentUser, set }) => {
    if (!currentUser) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    const { eventId } = params;
    const ticket = await prisma.ticket.findFirst({
      where: {
        eventId,
        userId: currentUser.id,
      },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            startTime: true,
            endTime: true,
            isLive: true,
          },
        },
        ticketType: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!ticket) {
      return {
        eventId,
        userId: currentUser.id,
        isRegistered: false,
        isCheckedIn: false,
        status: null,
        checkedInAt: null,
        ticket: null,
      };
    }

    return {
      eventId,
      userId: currentUser.id,
      isRegistered: true,
      isCheckedIn: ticket.status === "CHECKED_IN",
      status: ticket.status,
      checkedInAt: ticket.checkedInAt ? ticket.checkedInAt.toISOString() : null,
      ticket: {
        id: ticket.id,
        status: ticket.status,
        ticketType: ticket.ticketType.name,
        eventName: ticket.event.name,
        checkedInAt: ticket.checkedInAt,
      },
    };
  })
  // Get offline SQLite cache data
  .get("/cache/:eventId", async ({ params, currentUser, set }) => {
    if (!currentUser) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    const { eventId } = params;
    const tickets = await prisma.ticket.findMany({
      where: { eventId },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        ticketType: { select: { id: true, name: true, price: true } },
      },
    });

    const cacheData = tickets.map((t) => ({
      id: t.id,
      eventId: t.eventId,
      userId: t.userId,
      attendeeName: t.user.fullName,
      attendeeEmail: t.user.email,
      ticketTypeName: t.ticketType.name,
      status: t.status,
      totpSecret: t.totpSecret,
      checkedInAt: t.checkedInAt ? t.checkedInAt.toISOString() : null,
    }));

    return {
      eventId,
      count: cacheData.length,
      tickets: cacheData,
      timestamp: new Date().toISOString(),
    };
  })
  .get("/event-cache/:eventId", async ({ params, currentUser, set }) => {
    if (!currentUser) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    const { eventId } = params;
    const tickets = await prisma.ticket.findMany({
      where: { eventId },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        ticketType: { select: { id: true, name: true, price: true } },
      },
    });

    const cacheData = tickets.map((t) => ({
      id: t.id,
      eventId: t.eventId,
      userId: t.userId,
      attendeeName: t.user.fullName,
      attendeeEmail: t.user.email,
      ticketTypeName: t.ticketType.name,
      status: t.status,
      totpSecret: t.totpSecret,
      checkedInAt: t.checkedInAt ? t.checkedInAt.toISOString() : null,
    }));

    return {
      eventId,
      count: cacheData.length,
      tickets: cacheData,
      timestamp: new Date().toISOString(),
    };
  })
  // Check-in stats
  .get("/stats/:eventId", async ({ params }) => {
    const { eventId } = params;
    const total = await prisma.ticket.count({ where: { eventId } });
    const checkedIn = await prisma.ticket.count({
      where: { eventId, status: "CHECKED_IN" },
    });
    return {
      eventId,
      total,
      checkedIn,
      remaining: Math.max(0, total - checkedIn),
    };
  })
  // Online Dynamic QR Verification
  .post(
    "/verify",
    async ({ body, currentUser, set }) => {
      if (!currentUser) {
        set.status = 401;
        return { error: "Unauthorized: Staff login required" };
      }

      const { qrToken, deviceId, gate } = body as any;
      const verification = verifyDynamicQRToken(qrToken);

      if (!verification.valid || !verification.payload) {
        set.status = 400;
        return {
          status: "INVALID",
          code: "INVALID_TICKET",
          message: verification.error || "Mã không hợp lệ hoặc chữ ký giả mạo",
        };
      }

      const { tid, code } = verification.payload;

      const ticket = await prisma.ticket.findUnique({
        where: { id: tid },
        include: {
          user: true,
          ticketType: true,
          event: true,
        },
      });

      if (!ticket) {
        set.status = 400;
        return {
          status: "INVALID",
          code: "INVALID_TICKET",
          message: "Không tìm thấy vé trong hệ thống",
        };
      }

      // Check TOTP validity (30s window + tolerance)
      const isTotpValid = verifyTOTP(ticket.totpSecret, code);
      if (!isTotpValid) {
        set.status = 400;
        return {
          status: "INVALID",
          code: "INVALID_TICKET",
          message: "Mã QR đã hết hạn (quá 30s-60s)",
        };
      }

      // Check if already checked in (Duplicate check-in - Screen AMBER)
      if (ticket.status === "CHECKED_IN") {
        set.status = 409;
        return {
          status: "ALREADY_CHECKED_IN",
          code: "ALREADY_CHECKED_IN",
          message: "VÉ ĐÃ QUÉT TRƯỚC ĐÓ",
          ticket: {
            id: ticket.id,
            attendeeName: ticket.user.fullName,
            ticketType: ticket.ticketType.name,
            checkedInAt: ticket.checkedInAt,
          },
        };
      }

      if (ticket.status !== "PAID") {
        set.status = 400;
        return {
          status: "INVALID",
          code: "INVALID_STATUS",
          message: `Trạng thái vé không hợp lệ: ${ticket.status}`,
        };
      }

      const now = new Date();
      // Update ticket to CHECKED_IN
      const updatedTicket = await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          status: "CHECKED_IN",
          checkedInAt: now,
        },
      });

      // Log check-in
      const log = await prisma.checkinLog.create({
        data: {
          ticketId: ticket.id,
          staffId: currentUser.id,
          scannedAt: now,
          deviceId: deviceId || gate || "gate_scanner",
          isOffline: false,
          syncStatus: "SYNCED",
        },
      });

      set.status = 200;
      return {
        status: "SUCCESS",
        code: "CHECKIN_SUCCESS",
        message: "Check-in thành công",
        ticket: {
          id: updatedTicket.id,
          attendeeName: ticket.user.fullName,
          ticketType: ticket.ticketType.name,
          eventName: ticket.event.name,
          checkedInAt: updatedTicket.checkedInAt,
        },
        logId: log.id,
      };
    },
    {
      body: t.Object({
        qrToken: t.String(),
        deviceId: t.Optional(t.String()),
        gate: t.Optional(t.String()),
      }),
    }
  )
  // Offline Sync & Conflict Resolution (supports both /sync and /sync-offline)
  .post(
    "/sync",
    async ({ body, currentUser, set }) => {
      return handleSync(body, currentUser, set);
    },
    {
      body: t.Any(),
    }
  )
  .post(
    "/sync-offline",
    async ({ body, currentUser, set }) => {
      return handleSync(body, currentUser, set);
    },
    {
      body: t.Any(),
    }
  );

async function handleSync(body: any, currentUser: any, set: any) {
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
