import { Prisma } from "@prisma/client";
import type { Deps } from "../deps";
import type { ServiceResult } from "../lib/result";

export type ReservationInput = {
  operationId: string;
  eventId: string;
  ticketTypeId: string;
  quantity: number;
};

const reservationInclude = { ticketType: { select: { price: true } } } as const;
type ReservationWithType = Prisma.ReservationGetPayload<{ include: typeof reservationInclude }>;

class SoldOutError extends Error {}

function soldOut(): ServiceResult {
  return {
    status: 409,
    body: {
      code: "SOLD_OUT",
      message: "Ticket type or event capacity is exhausted",
    },
  };
}

export function serializeReservation(reservation: ReservationWithType) {
  return {
    id: reservation.id,
    operationId: reservation.operationId,
    eventId: reservation.eventId,
    ticketTypeId: reservation.ticketTypeId,
    quantity: reservation.quantity,
    status: reservation.status,
    expiresAt: reservation.expiresAt,
    createdAt: reservation.createdAt,
    unitPrice: reservation.ticketType.price,
  };
}

function replay(reservation: ReservationWithType, input: ReservationInput): ServiceResult {
  if (
    reservation.eventId !== input.eventId ||
    reservation.ticketTypeId !== input.ticketTypeId ||
    reservation.quantity !== input.quantity
  ) {
    return {
      status: 409,
      body: {
        code: "IDEMPOTENCY_CONFLICT",
        message: "operationId reused with a different payload",
      },
    };
  }

  if (reservation.status === "RELEASED") {
    return {
      status: 409,
      body: {
        code: "RESERVATION_RELEASED",
        message: "Reservation was already released and cannot be reused",
      },
    };
  }

  return { status: 200, body: { reservation: serializeReservation(reservation) } };
}

export async function createReservation(
  deps: Deps,
  input: ReservationInput
): Promise<ServiceResult> {
  const existing = await deps.prisma.reservation.findUnique({
    where: { operationId: input.operationId },
    include: reservationInclude,
  });
  if (existing) return replay(existing, input);

  const ticketType = await deps.prisma.ticketType.findUnique({
    where: { id: input.ticketTypeId },
    select: { id: true, eventId: true },
  });
  if (!ticketType) {
    return {
      status: 404,
      body: { code: "TICKET_TYPE_NOT_FOUND", message: "Ticket type was not found" },
    };
  }
  if (ticketType.eventId !== input.eventId) {
    return {
      status: 409,
      body: {
        code: "TICKET_TYPE_EVENT_MISMATCH",
        message: "Ticket type does not belong to the event",
      },
    };
  }

  const expiresAt = new Date(deps.now().getTime() + deps.reservationTtlMs);

  try {
    const reservation = await deps.prisma.$transaction(async (tx) => {
      const heldSeats = await tx.$executeRaw`
        UPDATE "Event"
        SET "reservedCount" = "reservedCount" + ${input.quantity}
        WHERE "id" = ${input.eventId}
          AND "reservedCount" + ${input.quantity} <= "maxCapacity"
      `;
      if (heldSeats === 0) throw new SoldOutError();

      const heldQuota = await tx.$executeRaw`
        UPDATE "TicketType"
        SET "soldCount" = "soldCount" + ${input.quantity}
        WHERE "id" = ${input.ticketTypeId}
          AND "soldCount" + ${input.quantity} <= "quota"
      `;
      if (heldQuota === 0) throw new SoldOutError();

      return tx.reservation.create({
        data: {
          operationId: input.operationId,
          eventId: input.eventId,
          ticketTypeId: input.ticketTypeId,
          quantity: input.quantity,
          status: "CONFIRMED",
          expiresAt,
        },
        include: reservationInclude,
      });
    });

    return { status: 201, body: { reservation: serializeReservation(reservation) } };
  } catch (error) {
    if (error instanceof SoldOutError) return soldOut();

    if ((error as { code?: string } | null)?.code === "P2002") {
      const raced = await deps.prisma.reservation.findUnique({
        where: { operationId: input.operationId },
        include: reservationInclude,
      });
      if (raced) return replay(raced, input);
    }

    throw error;
  }
}

export async function releaseReservation(
  deps: Deps,
  operationId: string
): Promise<ServiceResult> {
  const existing = await deps.prisma.reservation.findUnique({
    where: { operationId },
    include: reservationInclude,
  });
  if (!existing) {
    return {
      status: 404,
      body: { code: "RESERVATION_NOT_FOUND", message: "Reservation was not found" },
    };
  }
  if (existing.status === "RELEASED") {
    return { status: 200, body: { reservation: serializeReservation(existing) } };
  }

  const released = await deps.prisma.$transaction(async (tx) => {
    const claimed = await tx.reservation.updateMany({
      where: { id: existing.id, status: { not: "RELEASED" } },
      data: { status: "RELEASED" },
    });
    if (claimed.count === 0) {
      return tx.reservation.findUniqueOrThrow({
        where: { id: existing.id },
        include: reservationInclude,
      });
    }

    await tx.$executeRaw`
      UPDATE "Event"
      SET "reservedCount" = GREATEST("reservedCount" - ${existing.quantity}, 0)
      WHERE "id" = ${existing.eventId}
    `;
    await tx.$executeRaw`
      UPDATE "TicketType"
      SET "soldCount" = GREATEST("soldCount" - ${existing.quantity}, 0)
      WHERE "id" = ${existing.ticketTypeId}
    `;

    return tx.reservation.findUniqueOrThrow({
      where: { id: existing.id },
      include: reservationInclude,
    });
  });

  return { status: 200, body: { reservation: serializeReservation(released) } };
}
