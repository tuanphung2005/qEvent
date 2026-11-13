import { Prisma } from "@prisma/client";
import type { Deps } from "../deps";
import type { ServiceResult } from "../lib/result";

export type RoomInput = { name: string; capacity: number };
export type SessionInput = {
  title: string;
  speaker: string;
  startTime: string;
  endTime: string;
  isLive?: boolean;
};
export type TicketTypeInput = { name: string; price: number; quota: number };

export type EventInput = {
  name: string;
  venue: string;
  startTime: string;
  endTime: string;
  maxCapacity: number;
  rooms?: RoomInput[];
  sessions?: SessionInput[];
  ticketTypes?: TicketTypeInput[];
};

export type EventUpdateInput = Partial<Omit<EventInput, "rooms" | "sessions" | "ticketTypes">>;

const eventInclude = { rooms: true, sessions: true, ticketTypes: true } as const;
type EventWithRelations = Prisma.EventGetPayload<{ include: typeof eventInclude }>;

function parseTime(value: string): Date | null {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms) : null;
}

function invalidEventTime(): ServiceResult {
  return {
    status: 422,
    body: { code: "INVALID_EVENT_TIME", message: "Start time must be before end time" },
  };
}

function invalidSessionTime(): ServiceResult {
  return {
    status: 422,
    body: {
      code: "INVALID_SESSION_TIME",
      message: "Session start time must be before end time",
    },
  };
}

function eventNotFound(): ServiceResult {
  return { status: 404, body: { code: "EVENT_NOT_FOUND", message: "Event was not found" } };
}

export function serializeEvent(event: EventWithRelations) {
  return {
    id: event.id,
    name: event.name,
    venue: event.venue,
    startTime: event.startTime,
    endTime: event.endTime,
    maxCapacity: event.maxCapacity,
    reservedCount: event.reservedCount,
    createdAt: event.createdAt,
    rooms: event.rooms.map((room) => ({
      id: room.id,
      name: room.name,
      capacity: room.capacity,
    })),
    sessions: event.sessions.map((session) => ({
      id: session.id,
      title: session.title,
      speaker: session.speaker,
      startTime: session.startTime,
      endTime: session.endTime,
      isLive: session.isLive,
    })),
    ticketTypes: event.ticketTypes.map((type) => ({
      id: type.id,
      name: type.name,
      price: type.price,
      quota: type.quota,
      soldCount: type.soldCount,
      available: type.quota - type.soldCount,
    })),
  };
}

function validateSessions(sessions: SessionInput[]): ServiceResult | null {
  for (const session of sessions) {
    const startTime = parseTime(session.startTime);
    const endTime = parseTime(session.endTime);
    if (!startTime || !endTime || startTime >= endTime) return invalidSessionTime();
  }
  return null;
}

function toSessionData(session: SessionInput) {
  return {
    title: session.title,
    speaker: session.speaker,
    startTime: parseTime(session.startTime)!,
    endTime: parseTime(session.endTime)!,
    isLive: session.isLive ?? false,
  };
}

export async function listEvents(deps: Deps) {
  const events = await deps.prisma.event.findMany({
    include: eventInclude,
    orderBy: { startTime: "asc" },
  });
  return events.map(serializeEvent);
}

export async function getEvent(deps: Deps, id: string): Promise<ServiceResult> {
  const event = await deps.prisma.event.findUnique({ where: { id }, include: eventInclude });
  if (!event) return eventNotFound();
  return { status: 200, body: { event: serializeEvent(event) } };
}

export async function createEvent(deps: Deps, input: EventInput): Promise<ServiceResult> {
  const startTime = parseTime(input.startTime);
  const endTime = parseTime(input.endTime);
  if (!startTime || !endTime || startTime >= endTime || startTime.getTime() < deps.now().getTime()) {
    return invalidEventTime();
  }

  if (input.sessions?.length) {
    const invalid = validateSessions(input.sessions);
    if (invalid) return invalid;
  }

  const event = await deps.prisma.event.create({
    data: {
      name: input.name,
      venue: input.venue,
      startTime,
      endTime,
      maxCapacity: input.maxCapacity,
      rooms: input.rooms?.length ? { create: input.rooms } : undefined,
      sessions: input.sessions?.length
        ? { create: input.sessions.map(toSessionData) }
        : undefined,
      ticketTypes: input.ticketTypes?.length ? { create: input.ticketTypes } : undefined,
    },
    include: eventInclude,
  });

  return { status: 201, body: { event: serializeEvent(event) } };
}

export async function updateEvent(
  deps: Deps,
  id: string,
  input: EventUpdateInput
): Promise<ServiceResult> {
  const current = await deps.prisma.event.findUnique({ where: { id } });
  if (!current) return eventNotFound();

  const startTime = input.startTime === undefined ? current.startTime : parseTime(input.startTime);
  const endTime = input.endTime === undefined ? current.endTime : parseTime(input.endTime);
  const startChanged = input.startTime !== undefined;

  if (
    !startTime ||
    !endTime ||
    startTime >= endTime ||
    (startChanged && startTime.getTime() < deps.now().getTime())
  ) {
    return invalidEventTime();
  }

  if (input.maxCapacity !== undefined) {
    // Check and write in one atomic statement. A read-then-write would race
    // with a concurrent reservation and could leave maxCapacity < reservedCount.
    const applied = await deps.prisma.$executeRaw`
      UPDATE "Event"
      SET "maxCapacity" = ${input.maxCapacity}
      WHERE "id" = ${id}
        AND "reservedCount" <= ${input.maxCapacity}
    `;

    if (applied === 0) {
      return {
        status: 409,
        body: {
          code: "CAPACITY_BELOW_RESERVED",
          message: "maxCapacity cannot be lower than the number of reserved seats",
        },
      };
    }
  }

  const event = await deps.prisma.event.update({
    where: { id },
    data: {
      name: input.name,
      venue: input.venue,
      maxCapacity: input.maxCapacity,
      startTime: input.startTime === undefined ? undefined : startTime,
      endTime: input.endTime === undefined ? undefined : endTime,
    },
    include: eventInclude,
  });

  return { status: 200, body: { event: serializeEvent(event) } };
}

async function eventExists(deps: Deps, id: string): Promise<boolean> {
  const found = await deps.prisma.event.findUnique({ where: { id }, select: { id: true } });
  return Boolean(found);
}

export async function addRoom(
  deps: Deps,
  eventId: string,
  input: RoomInput
): Promise<ServiceResult> {
  if (!(await eventExists(deps, eventId))) return eventNotFound();
  const room = await deps.prisma.room.create({ data: { ...input, eventId } });
  return { status: 201, body: { room } };
}

export async function addSession(
  deps: Deps,
  eventId: string,
  input: SessionInput
): Promise<ServiceResult> {
  if (!(await eventExists(deps, eventId))) return eventNotFound();
  const invalid = validateSessions([input]);
  if (invalid) return invalid;
  const session = await deps.prisma.session.create({
    data: { ...toSessionData(input), eventId },
  });
  return { status: 201, body: { session } };
}

export async function updateRoom(
  deps: Deps,
  eventId: string,
  roomId: string,
  input: Partial<RoomInput>
): Promise<ServiceResult> {
  const room = await deps.prisma.room.findFirst({ where: { id: roomId, eventId } });
  if (!room) {
    return { status: 404, body: { code: "ROOM_NOT_FOUND", message: "Room was not found" } };
  }
  const updated = await deps.prisma.room.update({ where: { id: room.id }, data: input });
  return { status: 200, body: { room: updated } };
}

export async function updateSession(
  deps: Deps,
  eventId: string,
  sessionId: string,
  input: Partial<SessionInput>
): Promise<ServiceResult> {
  const session = await deps.prisma.session.findFirst({ where: { id: sessionId, eventId } });
  if (!session) {
    return {
      status: 404,
      body: { code: "SESSION_NOT_FOUND", message: "Session was not found" },
    };
  }

  const startTime =
    input.startTime === undefined ? session.startTime : parseTime(input.startTime);
  const endTime = input.endTime === undefined ? session.endTime : parseTime(input.endTime);
  if (!startTime || !endTime || startTime >= endTime) return invalidSessionTime();

  const updated = await deps.prisma.session.update({
    where: { id: session.id },
    data: {
      title: input.title,
      speaker: input.speaker,
      startTime,
      endTime,
      isLive: input.isLive,
    },
  });
  return { status: 200, body: { session: updated } };
}

export async function updateTicketType(
  deps: Deps,
  eventId: string,
  ticketTypeId: string,
  input: Partial<TicketTypeInput>
): Promise<ServiceResult> {
  const ticketType = await deps.prisma.ticketType.findFirst({
    where: { id: ticketTypeId, eventId },
  });
  if (!ticketType) {
    return {
      status: 404,
      body: { code: "TICKET_TYPE_NOT_FOUND", message: "Ticket type was not found" },
    };
  }
  if (input.quota !== undefined && input.quota < ticketType.soldCount) {
    return {
      status: 409,
      body: {
        code: "QUOTA_BELOW_SOLD",
        message: "quota cannot be lower than the number of sold tickets",
      },
    };
  }

  const updated = await deps.prisma.ticketType.update({
    where: { id: ticketType.id },
    data: input,
  });
  return {
    status: 200,
    body: {
      ticketType: {
        ...updated,
        available: updated.quota - updated.soldCount,
      },
    },
  };
}

export async function addTicketType(
  deps: Deps,
  eventId: string,
  input: TicketTypeInput
): Promise<ServiceResult> {
  if (!(await eventExists(deps, eventId))) return eventNotFound();
  const ticketType = await deps.prisma.ticketType.create({ data: { ...input, eventId } });
  return {
    status: 201,
    body: {
      ticketType: {
        ...ticketType,
        available: ticketType.quota - ticketType.soldCount,
      },
    },
  };
}

export async function getInternalEvent(deps: Deps, id: string): Promise<ServiceResult> {
  return getEvent(deps, id);
}

export async function getInternalSession(deps: Deps, id: string): Promise<ServiceResult> {
  const session = await deps.prisma.session.findUnique({
    where: { id },
    include: { event: { select: { id: true, name: true, startTime: true, endTime: true } } },
  });
  if (!session) {
    return { status: 404, body: { code: "SESSION_NOT_FOUND", message: "Session was not found" } };
  }
  return {
    status: 200,
    body: {
      session: {
        id: session.id,
        title: session.title,
        speaker: session.speaker,
        startTime: session.startTime,
        endTime: session.endTime,
        isLive: session.isLive,
        event: session.event,
      },
    },
  };
}
