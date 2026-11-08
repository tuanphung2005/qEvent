import { Elysia } from "elysia";
import type { Deps } from "../deps";
import { createJwtAuth, deriveCurrentUser, isStaffOrOrganizer } from "../lib/auth";
import { fail } from "../lib/http";
import { buildQrToken } from "../lib/qr";

export function ticketRoutes(deps: Deps, secret: string) {
  return new Elysia({ prefix: "/api", tags: ["tickets"] })
    .use(createJwtAuth(secret))
    .derive(deriveCurrentUser)
    .get("/tickets", async ({ currentUser, set }) => {
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
