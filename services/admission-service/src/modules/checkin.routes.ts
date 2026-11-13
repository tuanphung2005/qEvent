import { Elysia, t } from "elysia";
import { Prisma } from "@prisma/client";
import type { Deps } from "../deps";
import { createJwtAuth, deriveCurrentUser, isStaffOrOrganizer } from "../lib/auth";
import { fail } from "../lib/http";
import { pageResult, pageSize, parseSince } from "../lib/pagination";
import { checkIn, syncOffline } from "../services/checkin.service";

export function checkinRoutes(deps: Deps, secret: string) {
  return new Elysia({ prefix: "/api", tags: ["checkins"] })
    .use(createJwtAuth(secret))
    .derive(deriveCurrentUser)
    .post(
      "/checkins",
      async ({ body, currentUser, set }) => {
        const result = await checkIn(deps, currentUser, {
          qrToken: body.qrToken,
          deviceId: body.deviceId,
          gate: body.gate,
        });
        set.status = result.status as typeof set.status;
        return result.body;
      },
      {
        body: t.Object({
          qrToken: t.String({ minLength: 1 }),
          deviceId: t.Optional(t.String()),
          gate: t.Optional(t.String()),
        }),
      }
    )
    .post(
      "/checkins/sync-offline",
      async ({ body, currentUser, set }) => {
        const result = await syncOffline(deps, currentUser, body.logs);
        set.status = result.status as typeof set.status;
        return result.body;
      },
      {
        body: t.Object({
          logs: t.Array(
            t.Object({
              ticketId: t.String({ minLength: 1 }),
              scannedAt: t.String({ minLength: 1 }),
              deviceId: t.Optional(t.String()),
            }),
            { minItems: 1 }
          ),
        }),
      }
    )
    .get(
      "/checkins/stats",
      async ({ query, currentUser, set }) => {
        if (!currentUser) {
          return fail(set, 401, "UNAUTHORIZED", "Authentication is required");
        }
        if (!isStaffOrOrganizer(currentUser)) {
          return fail(set, 403, "FORBIDDEN", "Staff or organizer role is required");
        }

        const eventId = query.eventId;
        const [totalTickets, checkedIn, orderGroups, gateGroups, lastCheckin] =
          await Promise.all([
            deps.prisma.ticket.count({ where: { eventId } }),
            deps.prisma.ticket.count({ where: { eventId, status: "CHECKED_IN" } }),
            deps.prisma.order.groupBy({
              by: ["status"],
              where: { eventId },
              _count: { _all: true },
              _sum: { quantity: true },
            }),
            deps.prisma.checkinLog.groupBy({
              by: ["deviceId"],
              where: { ticket: { eventId } },
              _count: { _all: true },
            }),
            deps.prisma.checkinLog.findFirst({
              where: { ticket: { eventId } },
              orderBy: { scannedAt: "desc" },
              select: { scannedAt: true },
            }),
          ]);

        const orders = {
          total: 0,
          confirmed: 0,
          pending: 0,
          failed: 0,
          soldTickets: 0,
        };
        for (const group of orderGroups) {
          orders.total += group._count._all;
          if (group.status === "CONFIRMED") {
            orders.confirmed += group._count._all;
            orders.soldTickets += group._sum.quantity ?? 0;
          } else if (
            group.status === "PENDING" ||
            group.status === "PENDING_RECONCILIATION" ||
            group.status === "COMPENSATING"
          ) {
            orders.pending += group._count._all;
          } else if (group.status === "FAILED") {
            orders.failed += group._count._all;
          }
        }

        return {
          eventId,
          tickets: {
            total: totalTickets,
            checkedIn,
            remaining: Math.max(totalTickets - checkedIn, 0),
          },
          orders,
          byGate: gateGroups
            .map((group) => ({
              gate: group.deviceId ?? "unknown",
              count: group._count._all,
            }))
            .sort((a, b) => b.count - a.count),
          lastCheckinAt: lastCheckin?.scannedAt ?? null,
        };
      },
      {
        query: t.Object({
          eventId: t.String({ minLength: 1 }),
        }),
      }
    )
    .get(
      "/checkins",
      async ({ query, currentUser, set }) => {
        if (!currentUser) {
          return fail(set, 401, "UNAUTHORIZED", "Authentication is required");
        }
        if (!isStaffOrOrganizer(currentUser)) {
          return fail(set, 403, "FORBIDDEN", "Staff or organizer role is required");
        }

        const since = parseSince(query.since);
        if (query.since && !since) {
          return fail(set, 422, "INVALID_SINCE", "since must be an ISO date-time");
        }

        const limit = pageSize(query);
        const where: Prisma.CheckinLogWhereInput = { ticket: { eventId: query.eventId } };
        if (since) where.scannedAt = { gte: since };
        if (query.gate) where.deviceId = query.gate;

        const rows = await deps.prisma.checkinLog.findMany({
          where,
          include: {
            ticket: {
              select: {
                id: true,
                status: true,
                user: { select: { id: true, email: true, fullName: true } },
              },
            },
          },
          orderBy: [{ scannedAt: "desc" }, { id: "desc" }],
          take: limit + 1,
          ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
        });

        const { items, nextCursor } = pageResult(rows, limit);
        return {
          checkins: items.map((log) => ({
            id: log.id,
            ticketId: log.ticketId,
            scannedAt: log.scannedAt,
            isOffline: log.isOffline,
            syncStatus: log.syncStatus,
            deviceId: log.deviceId,
            attendee: log.ticket.user,
            ticketStatus: log.ticket.status,
          })),
          nextCursor,
        };
      },
      {
        query: t.Object({
          eventId: t.String({ minLength: 1 }),
          since: t.Optional(t.String({ minLength: 1 })),
          gate: t.Optional(t.String({ minLength: 1 })),
          cursor: t.Optional(t.String({ minLength: 1 })),
          limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
        }),
      }
    );
}
