import { Elysia, t } from "elysia";
import { Prisma, TicketStatus } from "@prisma/client";
import type { Deps } from "../deps";
import { createJwtAuth, deriveCurrentUser, isStaffOrOrganizer } from "../lib/auth";
import { fail } from "../lib/http";
import { pageResult, pageSize } from "../lib/pagination";
import { buildQrToken } from "../lib/qr";

export function ticketRoutes(deps: Deps, secret: string) {
  return new Elysia({ prefix: "/api", tags: ["tickets"] })
    .use(createJwtAuth(secret))
    .derive(deriveCurrentUser)
    .get(
      "/tickets",
      async ({ query, currentUser, set }) => {
        if (!currentUser) {
          return fail(set, 401, "UNAUTHORIZED", "Authentication is required");
        }
        if (!isStaffOrOrganizer(currentUser)) {
          return fail(set, 403, "FORBIDDEN", "Staff or organizer role is required");
        }

        const limit = pageSize(query);
        const where: Prisma.TicketWhereInput = { eventId: query.eventId };
        if (query.status) where.status = query.status as TicketStatus;
        if (query.q) {
          where.OR = [
            { id: { contains: query.q } },
            { user: { email: { contains: query.q, mode: "insensitive" } } },
            { user: { fullName: { contains: query.q, mode: "insensitive" } } },
          ];
        }

        const rows = await deps.prisma.ticket.findMany({
          where,
          include: {
            user: { select: { id: true, email: true, fullName: true } },
            order: { select: { status: true } },
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: limit + 1,
          ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
        });

        const { items, nextCursor } = pageResult(rows, limit);
        return {
          tickets: items.map((ticket) => ({
            id: ticket.id,
            eventId: ticket.eventId,
            ticketTypeId: ticket.ticketTypeId,
            orderId: ticket.orderId,
            status: ticket.status,
            orderStatus: ticket.order.status,
            checkedInAt: ticket.checkedInAt,
            createdAt: ticket.createdAt,
            attendee: ticket.user,
          })),
          nextCursor,
        };
      },
      {
        query: t.Object({
          eventId: t.String({ minLength: 1 }),
          status: t.Optional(t.String({ minLength: 1 })),
          q: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
          cursor: t.Optional(t.String({ minLength: 1 })),
          limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
        }),
      }
    )
    .get("/tickets/my", async ({ currentUser, set }) => {
      if (!currentUser) {
        return fail(set, 401, "UNAUTHORIZED", "Authentication is required");
      }

      const tickets = await deps.prisma.ticket.findMany({
        where: { userId: currentUser.id },
        include: { order: { select: { status: true } } },
        orderBy: { createdAt: "desc" },
      });

      return {
        tickets: tickets.map((ticket) => ({
          id: ticket.id,
          eventId: ticket.eventId,
          ticketTypeId: ticket.ticketTypeId,
          status: ticket.status,
          orderStatus: ticket.order.status,
          checkedInAt: ticket.checkedInAt,
          createdAt: ticket.createdAt,
        })),
      };
    })
    .get(
      "/tickets/:id",
      async ({ params, currentUser, set }) => {
        if (!currentUser) {
          return fail(set, 401, "UNAUTHORIZED", "Authentication is required");
        }
        if (!isStaffOrOrganizer(currentUser)) {
          return fail(set, 403, "FORBIDDEN", "Staff or organizer role is required");
        }

        const ticket = await deps.prisma.ticket.findUnique({
          where: { id: params.id },
          include: {
            user: { select: { id: true, email: true, fullName: true } },
            order: {
              select: {
                id: true,
                status: true,
                quantity: true,
                totalAmount: true,
                createdAt: true,
              },
            },
            checkinLogs: { orderBy: { scannedAt: "desc" } },
          },
        });
        if (!ticket) {
          return fail(set, 404, "TICKET_NOT_FOUND", "Ticket was not found");
        }

        return {
          ticket: {
            id: ticket.id,
            eventId: ticket.eventId,
            ticketTypeId: ticket.ticketTypeId,
            orderId: ticket.orderId,
            status: ticket.status,
            checkedInAt: ticket.checkedInAt,
            createdAt: ticket.createdAt,
            attendee: ticket.user,
          },
          order: ticket.order,
          checkinLogs: ticket.checkinLogs.map((log) => ({
            id: log.id,
            scannedBy: log.scannedBy,
            scannedAt: log.scannedAt,
            isOffline: log.isOffline,
            deviceId: log.deviceId,
            syncStatus: log.syncStatus,
          })),
        };
      },
      { params: t.Object({ id: t.String({ minLength: 1 }) }) }
    )
    .get("/tickets/:id/qr-token", async ({ params, currentUser, set }) => {
      if (!currentUser) {
        return fail(set, 401, "UNAUTHORIZED", "Authentication is required");
      }

      const ticket = await deps.prisma.ticket.findUnique({
        where: { id: params.id },
        include: { order: { select: { status: true } } },
      });

      if (!ticket) {
        return fail(set, 404, "TICKET_NOT_FOUND", "Ticket was not found");
      }

      if (ticket.userId !== currentUser.id && !isStaffOrOrganizer(currentUser)) {
        return fail(set, 403, "FORBIDDEN", "Ticket belongs to another attendee");
      }

      if (ticket.status === "CANCELLED") {
        return fail(set, 409, "TICKET_CANCELLED", "Ticket has been cancelled");
      }

      if (ticket.order.status !== "CONFIRMED") {
        return fail(set, 409, "ORDER_NOT_CONFIRMED", "Ticket order is not confirmed");
      }

      const { qrToken, expiresIn } = buildQrToken(
        { id: ticket.id, eventId: ticket.eventId, qrSecret: ticket.qrSecret },
        deps.keys.privateKey,
        deps.now().getTime()
      );

      return {
        ticketId: ticket.id,
        qrToken,
        expiresIn,
        status: ticket.status,
        checkedInAt: ticket.checkedInAt,
      };
    });
}
