import type { EventSummary } from "@/lib/api/types";
import { http, HttpResponse } from "msw";
import { eventFixture } from "../../../test/msw/fixtures";

type SessionBody = {
  title: string;
  speaker: string;
  startTime: string;
  endTime: string;
  isLive?: boolean;
};

type EventBody = {
  name: string;
  venue: string;
  startTime: string;
  endTime: string;
  maxCapacity: number;
  rooms?: Array<{ name: string; capacity: number }>;
  sessions?: SessionBody[];
  ticketTypes?: Array<{ name: string; price: number; quota: number }>;
};

let created = 0;

function withRelations(body: EventBody): EventSummary {
  created += 1;
  return {
    ...eventFixture,
    ...body,
    id: `8d2f0a11-0000-4000-8000-00000000000${created}`,
    reservedCount: 0,
    createdAt: new Date().toISOString(),
    rooms: (body.rooms ?? []).map((room, index) => ({ ...room, id: `room-${created}-${index}` })),
    sessions: (body.sessions ?? []).map((session, index) => ({
      ...session,
      id: `session-${created}-${index}`,
      isLive: session.isLive ?? false,
    })),
    ticketTypes: (body.ticketTypes ?? []).map((type, index) => ({
      ...type,
      id: `tt-${created}-${index}`,
      soldCount: 0,
      available: type.quota,
    })),
  };
}

export const handlers = [
  http.get("/api/events", () => HttpResponse.json({ events: [eventFixture] })),
  http.get("/api/events/:eventId", () => HttpResponse.json({ event: eventFixture })),
  http.post("/api/events", async ({ request }) => {
    const body = (await request.json()) as EventBody;
    return HttpResponse.json({ event: withRelations(body) }, { status: 201 });
  }),
  http.patch("/api/events/:eventId", async ({ request }) => {
    const body = (await request.json()) as Partial<EventBody>;
    return HttpResponse.json({ event: { ...eventFixture, ...body } });
  }),
  http.post("/api/events/:eventId/rooms", async ({ request }) => {
    const body = (await request.json()) as { name: string; capacity: number };
    return HttpResponse.json({ room: { ...body, id: `room-${Date.now()}` } }, { status: 201 });
  }),
  http.patch("/api/events/:eventId/rooms/:roomId", async ({ request, params }) => {
    const body = (await request.json()) as { name?: string; capacity?: number };
    return HttpResponse.json({ room: { ...body, id: String(params.roomId) } });
  }),
  http.post("/api/events/:eventId/sessions", async ({ request }) => {
    const body = (await request.json()) as SessionBody;
    return HttpResponse.json(
      { session: { ...body, id: `session-${Date.now()}`, isLive: body.isLive ?? false } },
      { status: 201 },
    );
  }),
  http.patch("/api/events/:eventId/sessions/:sessionId", async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ session: { ...body, id: String(params.sessionId) } });
  }),
  http.post("/api/events/:eventId/ticket-types", async ({ request }) => {
    const body = (await request.json()) as { name: string; price: number; quota: number };
    return HttpResponse.json(
      {
        ticketType: {
          ...body,
          id: `tt-${Date.now()}`,
          soldCount: 0,
          available: body.quota,
        },
      },
      { status: 201 },
    );
  }),
  http.patch("/api/events/:eventId/ticket-types/:ticketTypeId", async ({ request, params }) => {
    const body = (await request.json()) as { name?: string; price?: number; quota?: number };
    return HttpResponse.json({
      ticketType: {
        name: eventFixture.ticketTypes[0]?.name ?? "Standard",
        price: eventFixture.ticketTypes[0]?.price ?? 0,
        soldCount: 0,
        ...body,
        available: body.quota ?? 0,
        id: String(params.ticketTypeId),
      },
    });
  }),
];
