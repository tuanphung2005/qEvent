import crypto from "node:crypto";
import type { Deps } from "../deps";
import { InfraError } from "../lib/resilient-fetch";
import type { CurrentUser } from "../lib/auth";
import type { ServiceResult } from "../lib/result";

export type OrderInput = { eventId: string; ticketTypeId: string; quantity: number };

type OrderWithTickets = {
  id: string;
  userId: string;
  eventId: string;
  ticketTypeId: string;
  idempotencyKey: string;
  operationId: string;
  status: string;
  quantity: number;
  totalAmount: number;
  failureCode: string | null;
  createdAt: Date;
  tickets: Array<{
    id: string;
    status: string;
    eventId: string;
    ticketTypeId: string;
    checkedInAt: Date | null;
    createdAt: Date;
  }>;
};

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function fingerprintOf(input: OrderInput): string {
  return sha256(
    JSON.stringify({
      eventId: input.eventId,
      ticketTypeId: input.ticketTypeId,
      quantity: input.quantity,
    })
  );
}

export function serializeOrder(order: OrderWithTickets) {
  return {
    id: order.id,
    userId: order.userId,
    eventId: order.eventId,
    ticketTypeId: order.ticketTypeId,
    status: order.status,
    quantity: order.quantity,
    totalAmount: order.totalAmount,
    failureCode: order.failureCode,
    createdAt: order.createdAt,
    tickets: order.tickets.map((ticket) => ({
      id: ticket.id,
      status: ticket.status,
      eventId: ticket.eventId,
      ticketTypeId: ticket.ticketTypeId,
      checkedInAt: ticket.checkedInAt,
      createdAt: ticket.createdAt,
    })),
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "P2002";
}

function pickNumber(body: unknown, key: string): number | undefined {
  const record = body as Record<string, unknown> | null;
  const nested = record?.reservation as Record<string, unknown> | undefined;
  const value = record?.[key] ?? nested?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function pickString(body: unknown, key: string): string | undefined {
  const record = body as Record<string, unknown> | null;
  const nested = record?.reservation as Record<string, unknown> | undefined;
  const value = record?.[key] ?? nested?.[key];
  return typeof value === "string" ? value : undefined;
}

const includeTickets = { tickets: true } as const;

export async function placeOrder(
  deps: Deps,
  user: CurrentUser,
  rawKey: string | undefined,
  input: OrderInput
): Promise<ServiceResult> {
  const key = rawKey?.trim();
  if (!key) {
    return {
      status: 400,
      body: { code: "IDEMPOTENCY_KEY_REQUIRED", message: "Idempotency-Key header is required" },
    };
  }

  const fingerprint = fingerprintOf(input);
  const existing = await deps.prisma.idempotencyLog.findUnique({
    where: { userId_key: { userId: user.id, key } },
    include: { order: { include: includeTickets } },
  });
  if (existing) return replay(existing, fingerprint);

  let orderId: string;
  let operationId: string;
  try {
    const created = await deps.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          userId: user.id,
          eventId: input.eventId,
          ticketTypeId: input.ticketTypeId,
          idempotencyKey: key,
          operationId: crypto.randomUUID(),
          quantity: input.quantity,
          status: "PENDING",
        },
      });
      await tx.idempotencyLog.create({
        data: { userId: user.id, key, fingerprint, orderId: order.id },
      });
      return order;
    });
    orderId = created.id;
    operationId = created.operationId;
  } catch (error) {
    if (isUniqueViolation(error)) {
      const raced = await deps.prisma.idempotencyLog.findUnique({
        where: { userId_key: { userId: user.id, key } },
        include: { order: { include: includeTickets } },
      });
      if (raced) return replay(raced, fingerprint);
    }
    throw error;
  }

  return continueOrder(deps, {
    orderId,
    operationId,
    userId: user.id,
    key,
  });
}

type ReplayLog = {
  fingerprint: string;
  status: string;
  orderId: string | null;
  responseStatus: number | null;
  responseBody: string | null;
  order: OrderWithTickets | null;
};

function replay(log: ReplayLog, fingerprint: string): ServiceResult {
  if (log.fingerprint !== fingerprint) {
    return {
      status: 409,
      body: {
        code: "IDEMPOTENCY_CONFLICT",
        message: "Idempotency key reused with a different payload",
      },
    };
  }

  if (log.status === "COMPLETED" && log.responseStatus !== null && log.responseBody) {
    return { status: log.responseStatus, body: JSON.parse(log.responseBody) };
  }

  if (log.order) {
    return {
      status: 202,
      body: { order: serializeOrder(log.order) },
      location: `/api/orders/${log.order.id}`,
    };
  }

  return { status: 202, body: { status: "PENDING" } };
}

async function continueOrder(
  deps: Deps,
  ctx: { orderId: string; operationId: string; userId: string; key: string }
): Promise<ServiceResult> {
  const order = await deps.prisma.order.findUniqueOrThrow({
    where: { id: ctx.orderId },
    include: includeTickets,
  });

  let reservation: { status: number; body: unknown };
  try {
    reservation = await deps.eventClient.createReservation({
      operationId: ctx.operationId,
      eventId: order.eventId,
      ticketTypeId: order.ticketTypeId,
      quantity: order.quantity,
    });
  } catch (error) {
    if (!(error instanceof InfraError)) throw error;
    const pending = await markPending(deps, ctx.orderId, "PENDING_RECONCILIATION");
    await setPending(deps, ctx.userId, ctx.key);
    return {
      status: 202,
      body: { order: serializeOrder(pending) },
      location: `/api/orders/${ctx.orderId}`,
    };
  }

  if (reservation.status >= 200 && reservation.status < 300) {
    try {
      const confirmed = await issueTickets(deps, ctx.orderId, reservation.body);
      const body = { order: serializeOrder(confirmed) };
      await complete(deps, ctx.userId, ctx.key, 201, body);
      return { status: 201, body };
    } catch {
      await deps.prisma.order.updateMany({
        where: { id: ctx.orderId, status: { in: ["PENDING", "PENDING_RECONCILIATION"] } },
        data: { status: "COMPENSATING", failureCode: "TICKET_ISSUE_FAILED" },
      });
      try {
        const released = await deps.eventClient.releaseReservation(ctx.operationId);
        if (released.status < 300) {
          await markFailed(deps, ctx.orderId, "TICKET_ISSUE_FAILED");
          const body = {
            code: "TICKET_ISSUE_FAILED",
            message: "Ticket issuance failed; reservation was released",
          };
          await complete(deps, ctx.userId, ctx.key, 502, body);
          return { status: 502, body };
        }
      } catch {
        // The reconciler retries compensation until the reservation is released.
      }
      const compensating = await markPending(deps, ctx.orderId, "COMPENSATING");
      await setPending(deps, ctx.userId, ctx.key);
      return {
        status: 202,
        body: { order: serializeOrder(compensating) },
        location: `/api/orders/${ctx.orderId}`,
      };
    }
  }

  if (reservation.status >= 500) {
    const pending = await markPending(deps, ctx.orderId, "PENDING_RECONCILIATION");
    await setPending(deps, ctx.userId, ctx.key);
    return {
      status: 202,
      body: { order: serializeOrder(pending) },
      location: `/api/orders/${ctx.orderId}`,
    };
  }

  const code = pickString(reservation.body, "code") ?? "RESERVATION_REJECTED";
  const message = pickString(reservation.body, "message") ?? "Reservation was rejected";
  await markFailed(deps, ctx.orderId, code);
  const body = { code, message };
  await complete(deps, ctx.userId, ctx.key, reservation.status, body);
  return { status: reservation.status, body };
}

async function issueTickets(
  deps: Deps,
  orderId: string,
  reservationBody: unknown
): Promise<OrderWithTickets> {
  const unitPrice = pickNumber(reservationBody, "unitPrice") ?? pickNumber(reservationBody, "price") ?? 0;

  return deps.prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    if (order.status === "CONFIRMED") {
      return tx.order.findUniqueOrThrow({ where: { id: orderId }, include: includeTickets });
    }

    const claimed = await tx.order.updateMany({
      where: {
        id: orderId,
        status: { in: ["PENDING", "PENDING_RECONCILIATION"] },
      },
      data: {
        status: "CONFIRMED",
        failureCode: null,
        leaseUntil: null,
        totalAmount: unitPrice * order.quantity,
      },
    });

    if (claimed.count === 0) {
      const current = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: includeTickets,
      });
      if (current.status === "CONFIRMED") return current;
      throw new Error("ORDER_NOT_CONFIRMABLE");
    }

    for (let index = 0; index < order.quantity; index++) {
      await tx.ticket.create({
        data: {
          orderId: order.id,
          userId: order.userId,
          eventId: order.eventId,
          ticketTypeId: order.ticketTypeId,
          status: "PAID",
          qrSecret: crypto.randomBytes(20).toString("hex"),
        },
      });
    }

    return tx.order.findUniqueOrThrow({ where: { id: orderId }, include: includeTickets });
  });
}

async function markPending(deps: Deps, orderId: string, status: string): Promise<OrderWithTickets> {
  return deps.prisma.order.update({
    where: { id: orderId },
    data: { status, leaseUntil: null },
    include: includeTickets,
  });
}

async function markFailed(deps: Deps, orderId: string, code: string): Promise<OrderWithTickets> {
  return deps.prisma.order.update({
    where: { id: orderId },
    data: { status: "FAILED", failureCode: code, leaseUntil: null },
    include: includeTickets,
  });
}

async function setPending(deps: Deps, userId: string, key: string): Promise<void> {
  await deps.prisma.idempotencyLog.updateMany({
    where: { userId, key },
    data: { status: "PENDING" },
  });
}

async function complete(
  deps: Deps,
  userId: string,
  key: string,
  status: number,
  body: unknown
): Promise<void> {
  await deps.prisma.idempotencyLog.updateMany({
    where: { userId, key },
    data: {
      status: "COMPLETED",
      responseStatus: status,
      responseBody: JSON.stringify(body),
    },
  });
}

export async function reconcileOnce(deps: Deps, limit = 10): Promise<number> {
  const now = deps.now();
  const candidates = await deps.prisma.order.findMany({
    where: {
      status: { in: ["PENDING_RECONCILIATION", "COMPENSATING"] },
      OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let processed = 0;
  for (const candidate of candidates) {
    const claimed = await deps.prisma.order.updateMany({
      where: {
        id: candidate.id,
        status: candidate.status,
        OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
      },
      data: {
        leaseUntil: new Date(now.getTime() + deps.reconcileLeaseMs),
        attempts: { increment: 1 },
      },
    });
    if (claimed.count === 0) continue;

    processed++;
    try {
      await reconcileOrder(deps, candidate);
    } catch {
      // Lease expires and the next tick retries; no order or ticket is lost.
    }
  }
  return processed;
}

async function reconcileOrder(
  deps: Deps,
  order: {
    id: string;
    userId: string;
    eventId: string;
    ticketTypeId: string;
    operationId: string;
    idempotencyKey: string;
    status: string;
    quantity: number;
    failureCode: string | null;
  }
): Promise<void> {
  if (order.status === "COMPENSATING") {
    const released = await deps.eventClient.releaseReservation(order.operationId);
    if (released.status >= 300) return;
    await markFailed(deps, order.id, order.failureCode ?? "COMPENSATION_COMPLETE");
    await complete(deps, order.userId, order.idempotencyKey, 409, {
      code: order.failureCode ?? "ORDER_FAILED",
      message: "Order failed and the reservation was released",
    });
    return;
  }

  const reservation = await deps.eventClient.createReservation({
    operationId: order.operationId,
    eventId: order.eventId,
    ticketTypeId: order.ticketTypeId,
    quantity: order.quantity,
  });

  if (reservation.status >= 200 && reservation.status < 300) {
    const confirmed = await issueTickets(deps, order.id, reservation.body);
    await complete(deps, order.userId, order.idempotencyKey, 201, {
      order: serializeOrder(confirmed),
    });
    return;
  }

  if (reservation.status >= 400 && reservation.status < 500) {
    const code = pickString(reservation.body, "code") ?? "RESERVATION_REJECTED";
    const message = pickString(reservation.body, "message") ?? "Reservation was rejected";
    await markFailed(deps, order.id, code);
    await complete(deps, order.userId, order.idempotencyKey, reservation.status, { code, message });
  }
}
