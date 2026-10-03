import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import crypto from "node:crypto";
import { prisma } from "../../plugins/prisma";
import { generateTOTP, signDynamicQRPayload } from "../../config/keys";

export const ticketsModule = new Elysia({ prefix: "/api/tickets" })
  .use(
    jwt({
      name: "jwtAuth",
      secret: process.env.JWT_SECRET || "qcheck_super_secret_jwt_key_2026_production_grade",
    })
  )
  .derive(async ({ headers, jwtAuth, set }) => {
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
  // Get all active events with sessions & ticket types
  .get("/events", async () => {
    const events = await prisma.event.findMany({
      include: {
        ticketTypes: true,
        sessions: {
          include: {
            room: true,
          },
        },
      },
      orderBy: { startTime: "asc" },
    });
    return { events };
  })
  // Get current user tickets (supports both /my and /my-tickets)
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
  // Purchase sandbox ticket (supports both /sandbox-purchase and /purchase-sandbox)
  .post(
    "/sandbox-purchase",
    async ({ body, currentUser, set }) => {
      if (!currentUser) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      let { eventId, ticketTypeId, quantity } = body;
      const count = quantity || 1;

      // Auto-fallback to first event if not provided
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
