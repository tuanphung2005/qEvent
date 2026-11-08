import { Elysia, t } from "elysia";
import type { Deps } from "../deps";
import { fail } from "../lib/http";

export function internalRoutes(deps: Deps) {
  return new Elysia({ prefix: "/internal", tags: ["internal"] }).get(
    "/tickets/verify-access",
    async ({ query, headers, set }) => {
      if (headers["x-service-token"] !== deps.internalToken) {
        return fail(set, 401, "UNAUTHORIZED_SERVICE", "Valid service token is required");
      }

      const ticket = await deps.prisma.ticket.findFirst({
        where: { userId: query.userId, eventId: query.eventId, status: "CHECKED_IN" },
        select: { id: true },
      });

      return {
        userId: query.userId,
        eventId: query.eventId,
        checkedIn: Boolean(ticket),
        hasAccess: Boolean(ticket),
        ticketId: ticket?.id ?? null,
      };
    },
    {
      query: t.Object({
        userId: t.String({ minLength: 1 }),
        eventId: t.String({ minLength: 1 }),
      }),
    }
  );
}
