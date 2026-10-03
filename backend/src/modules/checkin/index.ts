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
  .get("/stats/:eventId", async ({ params, currentUser, set }) => {
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
  .post(
    "/verify",
    async ({ body, currentUser, set }) => {
      if (!currentUser) {
        set.status = 401;
        return { error: "Unauthorized: Staff login required" };
      }

      const { qrToken, deviceId } = body;
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

      // Check TOTP validity
      const isTotpValid = verifyTOTP(ticket.totpSecret, code);
      if (!isTotpValid) {
        set.status = 400;
        return {
          status: "INVALID",
          code: "INVALID_TICKET",
          message: "Mã QR đã hết hạn (quá 30s-60s)",
        };
      }

      // Check if already checked in (Duplicate check-in)
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

      // Log checkin
      const log = await prisma.checkinLog.create({
        data: {
          ticketId: ticket.id,
          staffId: currentUser.id,
          scannedAt: now,
          deviceId: deviceId || "unknown_device",
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
        deviceId: t.String(),
      }),
    }
  )
  .post(
    "/sync",
    async ({ body, currentUser, set }) => {
      if (!currentUser) {
        set.status = 401;
        return { error: "Unauthorized: Staff login required" };
      }

      const { logs } = body;
      if (!logs || !Array.isArray(logs) || logs.length === 0) {
        return { processed: 0, synced: 0, conflicts: 0, results: [] };
      }

      // Sort logs chronologically by scannedAt asc
      const sortedLogs = [...logs].sort(
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

        // Check if ticket is already checked in before this scan
        if (ticket.status === "CHECKED_IN") {
          // Conflict detected!
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
          // Valid first check-in
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
    },
    {
      body: t.Object({
        logs: t.Array(
          t.Object({
            ticketId: t.String(),
            scannedAt: t.String(),
            deviceId: t.String(),
          })
        ),
      }),
    }
  );
