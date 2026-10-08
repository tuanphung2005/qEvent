import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import crypto from "node:crypto";
import { prisma } from "../../plugins/prisma";
import { generateTOTP, signDynamicQRPayload } from "../../config/keys";

export function checkIsEventLive(event: { isLive: boolean; startTime: Date; endTime: Date }): boolean {
  if (event.isLive) return true;
  const now = new Date();
  return now >= new Date(event.startTime) && now <= new Date(event.endTime);
}

export function checkIsSessionLive(
  session: { isLive: boolean; startTime: Date; endTime: Date },
  event?: { isLive: boolean; startTime: Date; endTime: Date }
): boolean {
  if (session.isLive) return true;
  const now = new Date();
  return now >= new Date(session.startTime) && now <= new Date(session.endTime);
}

export function getSessionStatus(
  session: { isLive: boolean; startTime: Date; endTime: Date }
): "UPCOMING" | "LIVE" | "ENDED" {
  if (session.isLive) return "LIVE";
  const now = new Date();
  const start = new Date(session.startTime);
  const end = new Date(session.endTime);
  if (now < start) return "UPCOMING";
  if (now > end) return "ENDED";
  return "LIVE";
}

export const ticketsModule = new Elysia({ prefix: "/api/tickets" })
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
  // Get all active events with sessions, ticket types, and user attendance status
  .get("/events", async ({ currentUser }) => {
    const events = await prisma.event.findMany({
      include: {
        ticketTypes: true,
        sessions: {
          include: {
            room: true,
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
      orderBy: { startTime: "asc" },
    });

    let userTickets: any[] = [];
    if (currentUser?.id) {
      userTickets = await prisma.ticket.findMany({
        where: { userId: currentUser.id },
      });
    }

    const enrichedEvents = events.map((event) => {
      const isEventLive = checkIsEventLive(event);
      const userTicketForEvent = userTickets.find((t) => t.eventId === event.id);

      const enrichedSessions = event.sessions.map((s) => ({
        ...s,
        isCurrentlyLive: checkIsSessionLive(s, event),
        status: getSessionStatus(s),
      }));

      return {
        ...event,
        isCurrentlyLive: isEventLive,
        sessions: enrichedSessions,
        currentUserStatus: {
          hasRegistered: Boolean(userTicketForEvent),
          ticketId: userTicketForEvent?.id || null,
          ticketStatus: userTicketForEvent?.status || null,
          isCheckedIn: userTicketForEvent?.status === "CHECKED_IN",
          checkedInAt: userTicketForEvent?.checkedInAt || null,
        },
      };
    });

    return { events: enrichedEvents };
  })
  // Get detailed single event with live status and attendance
  .get("/events/:id", async ({ params, currentUser, set }) => {
    const event = await prisma.event.findUnique({
      where: { id: params.id },
      include: {
        ticketTypes: true,
        sessions: {
          include: {
            room: true,
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

    let userTicket = null;
    if (currentUser?.id) {
      userTicket = await prisma.ticket.findFirst({
        where: { eventId: event.id, userId: currentUser.id },
        include: { ticketType: true },
      });
    }

    const isEventLive = checkIsEventLive(event);
    const enrichedSessions = event.sessions.map((s) => ({
      ...s,
      isCurrentlyLive: checkIsSessionLive(s, event),
      status: getSessionStatus(s),
    }));

    return {
      event: {
        ...event,
        isCurrentlyLive: isEventLive,
        sessions: enrichedSessions,
        currentUserStatus: {
          hasRegistered: Boolean(userTicket),
          ticketId: userTicket?.id || null,
          ticketStatus: userTicket?.status || null,
          isCheckedIn: userTicket?.status === "CHECKED_IN",
          checkedInAt: userTicket?.checkedInAt || null,
        },
      },
    };
  })
  // Get Event Schedule / Timeline / Agenda
  .get("/events/:id/schedule", async ({ params, set }) => {
    const event = await prisma.event.findUnique({
      where: { id: params.id },
      include: {
        sessions: {
          include: {
            room: true,
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

    const isEventLive = checkIsEventLive(event);
    const schedule = event.sessions.map((s) => {
      const isCurrentlyLive = checkIsSessionLive(s, event);
      const status = getSessionStatus(s);
      return {
        id: s.id,
        title: s.title,
        description: s.description || null,
        speakerName: s.speakerName || null,
        startTime: s.startTime,
        endTime: s.endTime,
        room: {
          id: s.room.id,
          name: s.room.name,
          capacity: s.room.capacity,
        },
        status,
        isCurrentlyLive,
        interactions: {
          questionsCount: s._count.questions,
          pollsCount: s._count.polls,
          quizGamesCount: s._count.quizGames,
        },
      };
    });

    return {
      eventId: event.id,
      eventName: event.name,
      venue: event.venue,
      startTime: event.startTime,
      endTime: event.endTime,
      isLive: isEventLive,
      schedule,
    };
  })
  // Create Event Invitation(s) (Organizer / Staff)
  .post(
    "/events/:id/invitations",
    async ({ params, body, currentUser, set }) => {
      if (!currentUser || (currentUser.role !== "ORGANIZER" && currentUser.role !== "STAFF")) {
        set.status = 403;
        return { error: "Chỉ ban tổ chức hoặc nhân viên mới có quyền tạo lời mời" };
      }

      const event = await prisma.event.findUnique({
        where: { id: params.id },
      });

      if (!event) {
        set.status = 404;
        return { error: "Event not found" };
      }

      const { email, role, code: customCode } = body;
      const normalizedEmail = email.trim().toLowerCase();
      const inviteCode =
        customCode?.trim().toUpperCase() ||
        `INV-${event.name.slice(0, 3).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

      // Check if invitation with this code exists
      const existing = await prisma.eventInvitation.findUnique({
        where: { code: inviteCode },
      });

      if (existing) {
        set.status = 400;
        return { error: "Mã mời này đã tồn tại, vui lòng chọn mã khác" };
      }

      const invitation = await prisma.eventInvitation.create({
        data: {
          eventId: event.id,
          email: normalizedEmail,
          code: inviteCode,
          role: role === "SPEAKER" || role === "STAFF" ? role : "ATTENDEE",
        },
      });

      set.status = 201;
      return {
        message: "Đã tạo lời mời thành công",
        invitation: {
          id: invitation.id,
          eventId: invitation.eventId,
          email: invitation.email,
          code: invitation.code,
          role: invitation.role,
          isClaimed: invitation.isClaimed,
          createdAt: invitation.createdAt,
        },
      };
    },
    {
      body: t.Object({
        email: t.String(),
        role: t.Optional(t.String()),
        code: t.Optional(t.String()),
      }),
    }
  )
  // List Event Invitations (Organizer / Staff)
  .get("/events/:id/invitations", async ({ params, currentUser, set }) => {
    if (!currentUser || (currentUser.role !== "ORGANIZER" && currentUser.role !== "STAFF")) {
      set.status = 403;
      return { error: "Chỉ ban tổ chức hoặc nhân viên mới có quyền xem danh sách lời mời" };
    }

    const invitations = await prisma.eventInvitation.findMany({
      where: { eventId: params.id },
      orderBy: { createdAt: "desc" },
    });

    return { invitations };
  })
  // Claim Ticket via Invite Code (Attendee)
  .post(
    "/claim-invite",
    async ({ body, currentUser, set }) => {
      if (!currentUser) {
        set.status = 401;
        return { error: "Vui lòng đăng nhập để nhận vé qua mã mời" };
      }

      const rawCode = (body.code || "").trim().toUpperCase();
      if (!rawCode) {
        set.status = 400;
        return { error: "Vui lòng nhập mã mời (invite code)" };
      }

      // Check 1: Match specific EventInvitation
      let targetEventId: string | null = null;
      let invitationRecord = await prisma.eventInvitation.findUnique({
        where: { code: rawCode },
        include: { event: { include: { ticketTypes: true } } },
      });

      if (invitationRecord) {
        if (invitationRecord.isClaimed) {
          set.status = 400;
          return { error: "Mã mời này đã được sử dụng" };
        }
        targetEventId = invitationRecord.eventId;
      } else {
        // Check 2: Match general Event.inviteCode
        const eventByCode = await prisma.event.findFirst({
          where: { inviteCode: rawCode },
          include: { ticketTypes: true },
        });

        if (!eventByCode) {
          set.status = 404;
          return { error: "Mã mời không hợp lệ hoặc không tồn tại" };
        }
        targetEventId = eventByCode.id;
      }

      const event = await prisma.event.findUnique({
        where: { id: targetEventId },
        include: { ticketTypes: true },
      });

      if (!event) {
        set.status = 404;
        return { error: "Không tìm thấy sự kiện tương ứng với mã mời" };
      }

      // Check if user already has ticket for this event
      const existingTicket = await prisma.ticket.findFirst({
        where: { eventId: event.id, userId: currentUser.id },
        include: { event: true, ticketType: true },
      });

      const nowSec = Math.floor(Date.now() / 1000);
      const expiresIn = 30 - (nowSec % 30);

      if (existingTicket) {
        const code = generateTOTP(existingTicket.totpSecret);
        const qrToken = signDynamicQRPayload({
          tid: existingTicket.id,
          eid: existingTicket.eventId,
          code,
          iat: nowSec,
        });

        return {
          message: "Bạn đã có vé tham dự sự kiện này",
          isNew: false,
          ticket: {
            ...existingTicket,
            qrToken,
            expiresIn,
          },
        };
      }

      // Find or assign ticket type
      let ticketTypeId = event.ticketTypes[0]?.id;
      if (!ticketTypeId) {
        // Create a default VIP/Invite Pass if no ticket type exists
        const defaultType = await prisma.ticketType.create({
          data: {
            eventId: event.id,
            name: "Mã mời / Khách mời VIP",
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

      const secret = crypto.randomUUID();
      const ticket = await prisma.ticket.create({
        data: {
          eventId: event.id,
          userId: currentUser.id,
          ticketTypeId,
          status: "PAID",
          totpSecret: secret,
        },
        include: {
          event: true,
          ticketType: true,
        },
      });

      // Mark invitation as claimed if from EventInvitation
      if (invitationRecord) {
        await prisma.eventInvitation.update({
          where: { id: invitationRecord.id },
          data: {
            isClaimed: true,
            claimedAt: new Date(),
            claimedBy: currentUser.id,
          },
        });
      }

      const code = generateTOTP(ticket.totpSecret);
      const qrToken = signDynamicQRPayload({
        tid: ticket.id,
        eid: ticket.eventId,
        code,
        iat: nowSec,
      });

      set.status = 201;
      return {
        message: "Kích hoạt vé sự kiện qua mã mời thành công! Chào mừng bạn tham gia sự kiện.",
        isNew: true,
        ticket: {
          ...ticket,
          qrToken,
          expiresIn,
        },
      };
    },
    {
      body: t.Object({
        code: t.String(),
      }),
    }
  )
  // Toggle live status for an event (for testing or organizer controls)
  .post("/events/:id/toggle-live", async ({ params, body, set }) => {
    const event = await prisma.event.findUnique({ where: { id: params.id } });
    if (!event) {
      set.status = 404;
      return { error: "Event not found" };
    }

    const targetLive = (body as any)?.isLive !== undefined ? Boolean((body as any).isLive) : !event.isLive;
    const updated = await prisma.event.update({
      where: { id: params.id },
      data: { isLive: targetLive },
    });

    return {
      message: `Event live status updated to ${updated.isLive}`,
      eventId: updated.id,
      isLive: updated.isLive,
    };
  })
  // Toggle live status for a session
  .post("/sessions/:id/toggle-live", async ({ params, body, set }) => {
    const session = await prisma.session.findUnique({ where: { id: params.id } });
    if (!session) {
      set.status = 404;
      return { error: "Session not found" };
    }

    const targetLive = (body as any)?.isLive !== undefined ? Boolean((body as any).isLive) : !session.isLive;
    const updated = await prisma.session.update({
      where: { id: params.id },
      data: { isLive: targetLive },
    });

    return {
      message: `Session live status updated to ${updated.isLive}`,
      sessionId: updated.id,
      isLive: updated.isLive,
    };
  })
  // Get current user tickets
  .get("/my", async ({ currentUser, set }) => {
    if (!currentUser) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    const tickets = await prisma.ticket.findMany({
      where: { userId: currentUser.id },
      include: {
        event: {
          include: {
            sessions: { orderBy: { startTime: "asc" } },
          },
        },
        ticketType: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const nowSec = Math.floor(Date.now() / 1000);
    const expiresIn = 30 - (nowSec % 30);

    const enriched = tickets.map((ticket) => {
      const code = generateTOTP(ticket.totpSecret);
      const qrToken = signDynamicQRPayload({
        tid: ticket.id,
        eid: ticket.eventId,
        code,
        iat: nowSec,
      });

      return {
        ...ticket,
        qrToken,
        expiresIn,
      };
    });

    return { tickets: enriched };
  })
  .get("/my-tickets", async ({ currentUser, set }) => {
    if (!currentUser) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    const tickets = await prisma.ticket.findMany({
      where: { userId: currentUser.id },
      include: {
        event: {
          include: {
            sessions: { orderBy: { startTime: "asc" } },
          },
        },
        ticketType: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const nowSec = Math.floor(Date.now() / 1000);
    const expiresIn = 30 - (nowSec % 30);

    const enriched = tickets.map((ticket) => {
      const code = generateTOTP(ticket.totpSecret);
      const qrToken = signDynamicQRPayload({
        tid: ticket.id,
        eid: ticket.eventId,
        code,
        iat: nowSec,
      });

      return {
        ...ticket,
        qrToken,
        expiresIn,
      };
    });

    return { tickets: enriched };
  })
  // Get dynamic QR token for a ticket
  .get("/:id/token", async ({ params, currentUser, set }) => {
    if (!currentUser) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: params.id },
      include: {
        event: {
          include: { sessions: { orderBy: { startTime: "asc" } } },
        },
        ticketType: true,
        checkinLogs: {
          orderBy: { scannedAt: "desc" },
          take: 1,
        },
      },
    });

    if (!ticket) {
      set.status = 404;
      return { error: "Ticket not found" };
    }

    if (ticket.userId !== currentUser.id && currentUser.role !== "STAFF" && currentUser.role !== "ORGANIZER") {
      set.status = 403;
      return { error: "Access denied" };
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const expiresIn = 30 - (nowSec % 30);
    const code = generateTOTP(ticket.totpSecret);
    const qrToken = signDynamicQRPayload({
      tid: ticket.id,
      eid: ticket.eventId,
      code,
      iat: nowSec,
    });

    return {
      ticketId: ticket.id,
      qrToken,
      expiresIn,
      status: ticket.status,
      checkedInAt: ticket.checkedInAt,
      event: ticket.event,
      ticketType: ticket.ticketType,
      latestLog: ticket.checkinLogs[0] || null,
    };
  })
  // Register / Purchase ticket for an event
  .post(
    "/register",
    async ({ body, currentUser, set }) => {
      if (!currentUser) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      let { eventId, ticketTypeId, quantity } = body;
      const count = quantity || 1;

      if (!eventId || !ticketTypeId) {
        const firstEvent = await prisma.event.findFirst({
          include: { ticketTypes: true },
        });
        if (!firstEvent || firstEvent.ticketTypes.length === 0) {
          set.status = 400;
          return { error: "Không tìm thấy sự kiện hoặc loại vé" };
        }
        eventId = firstEvent.id;
        ticketTypeId = firstEvent.ticketTypes[0].id;
      }

      const ticketType = await prisma.ticketType.findUnique({
        where: { id: ticketTypeId },
      });

      if (!ticketType || ticketType.eventId !== eventId) {
        set.status = 404;
        return { error: "Ticket type not found for this event" };
      }

      const createdTickets = [];
      for (let i = 0; i < count; i++) {
        const secret = crypto.randomUUID();
        const ticket = await prisma.ticket.create({
          data: {
            eventId,
            userId: currentUser.id,
            ticketTypeId,
            status: "PAID",
            totpSecret: secret,
          },
          include: {
            event: true,
            ticketType: true,
          },
        });
        createdTickets.push(ticket);
      }

      await prisma.ticketType.update({
        where: { id: ticketTypeId },
        data: { soldQuantity: { increment: count } },
      });

      const nowSec = Math.floor(Date.now() / 1000);
      const enrichedTickets = createdTickets.map((t) => {
        const code = generateTOTP(t.totpSecret);
        const qrToken = signDynamicQRPayload({
          tid: t.id,
          eid: t.eventId,
          code,
          iat: nowSec,
        });
        return {
          ...t,
          qrToken,
          expiresIn: 30 - (nowSec % 30),
        };
      });

      set.status = 201;
      return {
        message: "Đăng ký vé sự kiện thành công",
        tickets: enrichedTickets,
      };
    },
    {
      body: t.Object({
        eventId: t.Optional(t.String()),
        ticketTypeId: t.Optional(t.String()),
        quantity: t.Optional(t.Number()),
      }),
    }
  )
  .post(
    "/sandbox-purchase",
    async ({ body, currentUser, set }) => {
      if (!currentUser) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      let { eventId, ticketTypeId, quantity } = body;
      const count = quantity || 1;

      if (!eventId || !ticketTypeId) {
        const firstEvent = await prisma.event.findFirst({
          include: { ticketTypes: true },
        });
        if (!firstEvent || firstEvent.ticketTypes.length === 0) {
          set.status = 400;
          return { error: "Không tìm thấy sự kiện mẫu" };
        }
        eventId = firstEvent.id;
        ticketTypeId = firstEvent.ticketTypes[0].id;
      }

      const ticketType = await prisma.ticketType.findUnique({
        where: { id: ticketTypeId },
      });

      if (!ticketType || ticketType.eventId !== eventId) {
        set.status = 404;
        return { error: "Ticket type not found for this event" };
      }

      const createdTickets = [];
      for (let i = 0; i < count; i++) {
        const secret = crypto.randomUUID();
        const ticket = await prisma.ticket.create({
          data: {
            eventId,
            userId: currentUser.id,
            ticketTypeId,
            status: "PAID",
            totpSecret: secret,
          },
          include: {
            event: true,
            ticketType: true,
          },
        });
        createdTickets.push(ticket);
      }

      await prisma.ticketType.update({
        where: { id: ticketTypeId },
        data: { soldQuantity: { increment: count } },
      });

      return {
        message: "Sandbox purchase successful",
        tickets: createdTickets,
      };
    },
    {
      body: t.Object({
        eventId: t.Optional(t.String()),
        ticketTypeId: t.Optional(t.String()),
        quantity: t.Optional(t.Number()),
      }),
    }
  )
  .post(
    "/purchase-sandbox",
    async ({ body, currentUser, set }) => {
      if (!currentUser) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      let { eventId, ticketTypeId, quantity } = body;
      const count = quantity || 1;

      if (!eventId || !ticketTypeId) {
        const firstEvent = await prisma.event.findFirst({
          include: { ticketTypes: true },
        });
        if (!firstEvent || firstEvent.ticketTypes.length === 0) {
          set.status = 400;
          return { error: "Không tìm thấy sự kiện mẫu" };
        }
        eventId = firstEvent.id;
        ticketTypeId = firstEvent.ticketTypes[0].id;
      }

      const ticketType = await prisma.ticketType.findUnique({
        where: { id: ticketTypeId },
      });

      if (!ticketType || ticketType.eventId !== eventId) {
        set.status = 404;
        return { error: "Ticket type not found for this event" };
      }

      const createdTickets = [];
      for (let i = 0; i < count; i++) {
        const secret = crypto.randomUUID();
        const ticket = await prisma.ticket.create({
          data: {
            eventId,
            userId: currentUser.id,
            ticketTypeId,
            status: "PAID",
            totpSecret: secret,
          },
          include: {
            event: true,
            ticketType: true,
          },
        });
        createdTickets.push(ticket);
      }

      await prisma.ticketType.update({
        where: { id: ticketTypeId },
        data: { soldQuantity: { increment: count } },
      });

      return {
        message: "Sandbox purchase successful",
        tickets: createdTickets,
      };
    },
    {
      body: t.Object({
        eventId: t.Optional(t.String()),
        ticketTypeId: t.Optional(t.String()),
        quantity: t.Optional(t.Number()),
      }),
    }
  );
