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
    const now = new Date();
    const events = await prisma.event.findMany({
      include: {
        ticketTypes: true,
        sessions: {
          include: {
            room: true,
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
            sessions: true,
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
            sessions: true,
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
          include: { sessions: true },
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
