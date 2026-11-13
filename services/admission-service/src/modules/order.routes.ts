import { Elysia, t } from "elysia";
import type { Deps } from "../deps";
import { createJwtAuth, deriveCurrentUser, isStaffOrOrganizer } from "../lib/auth";
import { fail } from "../lib/http";
import { pageSize } from "../lib/pagination";
import { listOrders, placeOrder, serializeOrder } from "../services/order.service";

export function orderRoutes(deps: Deps, secret: string) {
  return new Elysia({ prefix: "/api", tags: ["orders"] })
    .use(createJwtAuth(secret))
    .derive(deriveCurrentUser)
    .post(
      "/orders",
      async ({ body, headers, currentUser, set }) => {
        if (!currentUser) {
          return fail(set, 401, "UNAUTHORIZED", "Authentication is required");
        }

        const result = await placeOrder(deps, currentUser, headers["idempotency-key"], {
          eventId: body.eventId,
          ticketTypeId: body.ticketTypeId,
          quantity: body.quantity ?? 1,
        });

        set.status = result.status as typeof set.status;
        if (result.location) set.headers.location = result.location;
        return result.body;
      },
      {
        body: t.Object({
          eventId: t.String({ minLength: 1 }),
          ticketTypeId: t.String({ minLength: 1 }),
          quantity: t.Optional(t.Integer({ minimum: 1, maximum: 10 })),
        }),
      }
    )
    .get(
      "/orders",
      async ({ query, currentUser, set }) => {
        if (!currentUser) {
          return fail(set, 401, "UNAUTHORIZED", "Authentication is required");
        }
        if (!isStaffOrOrganizer(currentUser)) {
          return fail(set, 403, "FORBIDDEN", "Staff or organizer role is required");
        }

        const result = await listOrders(deps, {
          eventId: query.eventId,
          status: query.status,
          q: query.q,
          cursor: query.cursor,
          limit: pageSize(query),
        });
        return result;
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
    .get("/orders/:id", async ({ params, currentUser, set }) => {
      if (!currentUser) {
        return fail(set, 401, "UNAUTHORIZED", "Authentication is required");
      }

      const order = await deps.prisma.order.findUnique({
        where: { id: params.id },
        include: {
          tickets: true,
          user: { select: { id: true, email: true, fullName: true } },
        },
      });

      if (!order) {
        return fail(set, 404, "ORDER_NOT_FOUND", "Order was not found");
      }

      const privileged = currentUser.role === "STAFF" || currentUser.role === "ORGANIZER";
      if (!privileged && order.userId !== currentUser.id) {
        return fail(set, 404, "ORDER_NOT_FOUND", "Order was not found");
      }

      return {
        order: serializeOrder(order),
        ...(privileged ? { attendee: order.user } : {}),
      };
    });
}
