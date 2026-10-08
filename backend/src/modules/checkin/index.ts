import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import crypto from "node:crypto";
import { prisma } from "../../plugins/prisma";
import { verifyDynamicQRToken, verifyTOTP, generateTOTP, signDynamicQRPayload } from "../../config/keys";
import { checkIsEventLive } from "../tickets";

export const checkinModule = new Elysia({ prefix: "/api/checkin" })
  .use(
    jwt({
      name: "jwtAuth",
      secret: process.env.JWT_SECRET || "qevent_super_secret_jwt_key_2026_production_grade",
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
  // Attendee self-scan event QR to check-in & join if within event active time
  .post(
    "/scan-join",
    async ({ body, currentUser, set }) => {
      if (!currentUser) {
        set.status = 401;
        return { error: "Vui lòng đăng nhập để quét mã tham gia sự kiện" };
      }

      const { eventId, qrData, eventCode } = body;
      const targetQuery = eventId || qrData || eventCode;

      if (!targetQuery) {
        set.status = 400;
        return { error: "Vui lòng cung cấp mã QR hoặc ID sự kiện" };
      }

      // Find event by id or inviteCode
      const event = await prisma.event.findFirst({
        where: {
          OR: [
            { id: targetQuery },
            { inviteCode: targetQuery.trim().toUpperCase() },
          ],
        },
        include: {
          ticketTypes: true,
          sessions: {
            where: { isLive: true },
            take: 1,
          },
        },
      });

      if (!event) {
        set.status = 404;
        return {
          status: "NOT_FOUND",
          code: "EVENT_NOT_FOUND",
          message: "Không tìm thấy sự kiện tương ứng với mã quét",
        };
      }

      // Validate Time Window: "nếu đang trong thời gian sự kiện được tổ chức, allow user quét mã và tham gia"
      const isLiveNow = checkIsEventLive(event);
      if (!isLiveNow) {
        set.status = 403;
        return {
          status: "NOT_IN_EVENT_TIME",
          code: "NOT_IN_EVENT_TIME",
          message: "Sự kiện chưa bắt đầu hoặc đã kết thúc. Bạn chỉ có thể quét mã tham gia trong thời gian sự kiện diễn ra.",
          event: {
            id: event.id,
            name: event.name,
            startTime: event.startTime,
            endTime: event.endTime,
            isLive: event.isLive,
          },
        };
      }

      // Check user ticket
      const existingTicket = await prisma.ticket.findFirst({
        where: {
          eventId: event.id,
          userId: currentUser.id,
        },
        include: { ticketType: true },
      });

      const now = new Date();

      if (existingTicket) {
        if (existingTicket.status === "CHECKED_IN") {
          return {
            status: "ALREADY_CHECKED_IN",
            code: "ALREADY_CHECKED_IN",
            message: "Bạn đã điểm danh tham gia sự kiện này rồi",
            ticket: {
              id: existingTicket.id,
              status: existingTicket.status,
              checkedInAt: existingTicket.checkedInAt,
              ticketType: existingTicket.ticketType.name,
            },
            event: {
              id: event.id,
              name: event.name,
              venue: event.venue,
              activeSessionId: event.sessions[0]?.id || null,
            },
          };
        }

        // Ticket is PAID, update to CHECKED_IN
        const updatedTicket = await prisma.ticket.update({
          where: { id: existingTicket.id },
          data: {
            status: "CHECKED_IN",
            checkedInAt: now,
          },
        });

        const log = await prisma.checkinLog.create({
          data: {
            ticketId: updatedTicket.id,
            staffId: currentUser.id,
            scannedAt: now,
            deviceId: "attendee_self_scan",
            isOffline: false,
            syncStatus: "SYNCED",
          },
        });

        return {
          status: "SUCCESS",
          code: "CHECKIN_SUCCESS",
          message: "Quét mã điểm danh tham gia sự kiện thành công! Chào mừng bạn.",
          ticket: {
            id: updatedTicket.id,
            status: updatedTicket.status,
            checkedInAt: updatedTicket.checkedInAt,
            ticketType: existingTicket.ticketType.name,
          },
          event: {
            id: event.id,
            name: event.name,
            venue: event.venue,
            activeSessionId: event.sessions[0]?.id || null,
          },
          logId: log.id,
        };
      }

      // User has no ticket yet -> Auto register & check-in directly if during live event
      let ticketTypeId = event.ticketTypes[0]?.id;
      if (!ticketTypeId) {
        const defaultType = await prisma.ticketType.create({
          data: {
            eventId: event.id,
            name: "Vé vào cửa trực tiếp",
            price: 0,
            totalQuantity: 1000,
            soldQuantity: 1,
          },
        });
        ticketTypeId = defaultType.id;
      } else {
        await prisma.ticketType.update({
          where: { id: ticketTypeId },
          data: { soldQuantity: { increment: 1 } },
        });
      }

      const totpSecret = crypto.randomUUID();
      const newTicket = await prisma.ticket.create({
        data: {
          eventId: event.id,
          userId: currentUser.id,
          ticketTypeId,
          status: "CHECKED_IN",
          totpSecret,
          checkedInAt: now,
        },
        include: { ticketType: true },
      });

      const log = await prisma.checkinLog.create({
        data: {
          ticketId: newTicket.id,
          staffId: currentUser.id,
          scannedAt: now,
          deviceId: "attendee_self_scan",
          isOffline: false,
          syncStatus: "SYNCED",
        },
      });

      return {
        status: "SUCCESS",
        code: "REGISTER_AND_JOIN_SUCCESS",
        message: "Đăng ký và điểm danh tham gia sự kiện thành công! Chào mừng bạn.",
        ticket: {
          id: newTicket.id,
          status: newTicket.status,
          checkedInAt: newTicket.checkedInAt,
          ticketType: newTicket.ticketType.name,
        },
        event: {
          id: event.id,
          name: event.name,
          venue: event.venue,
          activeSessionId: event.sessions[0]?.id || null,
        },
        logId: log.id,
      };
    },
    {
      body: t.Object({
        eventId: t.Optional(t.String()),
        qrData: t.Optional(t.String()),
        eventCode: t.Optional(t.String()),
      }),
    }
  )
  // Staff Gate Scanner: Online Dynamic QR Verification
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
  // Staff Monitoring Dashboard / Surveillance
  .get("/monitor/:eventId", async ({ params, currentUser, set }) => {
    if (!currentUser || (currentUser.role !== "STAFF" && currentUser.role !== "ORGANIZER")) {
      set.status = 403;
      return { error: "Chỉ nhân viên hoặc ban tổ chức mới có quyền truy cập giám sát sự kiện" };
    }

    const { eventId } = params;
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        ticketTypes: true,
        sessions: {
          include: {
            _count: {
              select: {
                questions: true,
                polls: true,
                quizGames: true,
              },
            },
          },
          orderBy: { startTime: "asc" },
        },
      },
    });

    if (!event) {
      set.status = 404;
      return { error: "Event not found" };
    }

    const totalRegistered = await prisma.ticket.count({ where: { eventId } });
    const totalCheckedIn = await prisma.ticket.count({
      where: { eventId, status: "CHECKED_IN" },
    });

    const now = new Date();
    const min5Ago = new Date(now.getTime() - 5 * 60 * 1000);
    const min15Ago = new Date(now.getTime() - 15 * 60 * 1000);
    const min30Ago = new Date(now.getTime() - 30 * 60 * 1000);
    const min60Ago = new Date(now.getTime() - 60 * 60 * 1000);

    const [velocity5m, velocity15m, velocity30m, velocity60m] = await Promise.all([
      prisma.checkinLog.count({
        where: { ticket: { eventId }, scannedAt: { gte: min5Ago } },
      }),
      prisma.checkinLog.count({
        where: { ticket: { eventId }, scannedAt: { gte: min15Ago } },
      }),
      prisma.checkinLog.count({
        where: { ticket: { eventId }, scannedAt: { gte: min30Ago } },
      }),
      prisma.checkinLog.count({
        where: { ticket: { eventId }, scannedAt: { gte: min60Ago } },
      }),
    ]);

    // Latest 30 check-in logs
    const recentLogs = await prisma.checkinLog.findMany({
      where: { ticket: { eventId } },
      include: {
        ticket: {
          include: {
            user: { select: { fullName: true, email: true } },
            ticketType: { select: { name: true } },
          },
        },
        staff: { select: { fullName: true, email: true } },
      },
      orderBy: { scannedAt: "desc" },
      take: 30,
    });

    // Conflict logs (duplicate attempts)
    const conflictLogs = await prisma.checkinLog.findMany({
      where: { ticket: { eventId }, syncStatus: "CONFLICT" },
      include: {
        ticket: {
          include: {
            user: { select: { fullName: true } },
            ticketType: { select: { name: true } },
          },
        },
      },
      orderBy: { scannedAt: "desc" },
      take: 10,
    });

    const checkInRatePct = totalRegistered > 0 ? Math.round((totalCheckedIn / totalRegistered) * 100) : 0;
    const occupancyRatePct = event.maxCapacity > 0 ? Math.round((totalCheckedIn / event.maxCapacity) * 100) : 0;

    return {
      eventId: event.id,
      eventName: event.name,
      venue: event.venue,
      isLive: checkIsEventLive(event),
      summary: {
        totalRegistered,
        totalCheckedIn,
        checkInRatePct,
        remainingNotCheckedIn: Math.max(0, totalRegistered - totalCheckedIn),
        maxCapacity: event.maxCapacity,
        occupancyRatePct,
      },
      velocity: {
        last5MinCount: velocity5m,
        last15MinCount: velocity15m,
        last30MinCount: velocity30m,
        last60MinCount: velocity60m,
      },
      recentLogs: recentLogs.map((l) => ({
        id: l.id,
        attendeeName: l.ticket.user.fullName,
        attendeeEmail: l.ticket.user.email,
        ticketType: l.ticket.ticketType.name,
        scannedAt: l.scannedAt,
        deviceId: l.deviceId,
        isOffline: l.isOffline,
        syncStatus: l.syncStatus,
        staffName: l.staff.fullName,
      })),
      conflictsCount: conflictLogs.length,
      conflicts: conflictLogs.map((c) => ({
        id: c.id,
        attendeeName: c.ticket.user.fullName,
        ticketType: c.ticket.ticketType.name,
        scannedAt: c.scannedAt,
        deviceId: c.deviceId,
      })),
      sessions: event.sessions.map((s) => ({
        id: s.id,
        title: s.title,
        startTime: s.startTime,
        endTime: s.endTime,
        isLive: s.isLive,
        questionsCount: s._count.questions,
        pollsCount: s._count.polls,
        quizGamesCount: s._count.quizGames,
      })),
    };
  })
  // Simple check-in stats
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
