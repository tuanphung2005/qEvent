import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
import crypto from "node:crypto";
import { prisma } from "../../../plugins/prisma";
import { checkIsEventLive } from "../../tickets";
import { verifyDynamicQRToken, verifyTOTP } from "../services/verification.service";
import { scanJoinBody, verifyBody } from "../schemas";

export const checkinRoutes = new Elysia({ prefix: "/api/checkin" })
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
      body: scanJoinBody,
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
      body: verifyBody,
    }
  );
