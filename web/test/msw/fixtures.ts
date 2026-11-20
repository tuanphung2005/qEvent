import type {
  AdmissionStats,
  Attendee,
  CheckinListItem,
  EventSummary,
  ListResponse,
  OrderListItem,
  Session,
  TicketListItem,
  User,
} from "@/lib/api/types";

/** Shared fixtures. Only the foundation owner edits this file (team split §4.6). */

export const attendee: Attendee = {
  id: "a3f1c2d4-0000-4000-8000-000000000001",
  email: "attendee@qevent.com",
  fullName: "Nguyễn Văn An",
};

export const organizer: User = {
  id: "0f7a1b2c-0000-4000-8000-000000000001",
  email: "organizer@qevent.com",
  fullName: "Trần Minh Tuấn",
  role: "ORGANIZER",
};

export const staff: User = {
  id: "0f7a1b2c-0000-4000-8000-000000000002",
  email: "staff1@qevent.com",
  fullName: "Lê Thị Hồng",
  role: "STAFF",
};

export const attendeeUser: User = {
  id: "0f7a1b2c-0000-4000-8000-000000000003",
  email: "attendee@qevent.com",
  fullName: "Nguyễn Văn An",
  role: "ATTENDEE",
};

export const sessionFixture: Session = {
  id: "5c2b9a10-0000-4000-8000-000000000001",
  title: "Opening Keynote",
  speaker: "Alex Nguyen",
  startTime: "2026-11-20T01:00:00.000Z",
  endTime: "2026-11-20T02:00:00.000Z",
  isLive: true,
};

export const eventFixture: EventSummary = {
  id: "7c1e9a3d-0000-4000-8000-000000000001",
  name: "Tech Summit Vietnam 2026",
  venue: "Saigon Exhibition and Convention Center",
  startTime: "2026-11-20T00:00:00.000Z",
  endTime: "2026-11-20T10:00:00.000Z",
  maxCapacity: 500,
  reservedCount: 12,
  createdAt: "2026-11-01T00:00:00.000Z",
  rooms: [{ id: "room-1", name: "Main Hall", capacity: 500 }],
  sessions: [sessionFixture],
  ticketTypes: [
    { id: "tt-1", name: "Standard", price: 500000, quota: 500, soldCount: 120, available: 380 },
  ],
};

export const orderFixture: OrderListItem = {
  id: "9b8c7d6e-0000-4000-8000-000000000001",
  attendee,
  status: "CONFIRMED",
  quantity: 2,
  totalAmount: 1000000,
  failureCode: null,
  createdAt: "2026-11-10T03:00:00.000Z",
  updatedAt: "2026-11-10T03:01:00.000Z",
  ticketsCount: 2,
};

export const ticketFixture: TicketListItem = {
  id: "1a2b3c4d-0000-4000-8000-000000000001",
  eventId: eventFixture.id,
  ticketTypeId: "tt-1",
  orderId: orderFixture.id,
  status: "PAID",
  orderStatus: "CONFIRMED",
  checkedInAt: null,
  createdAt: "2026-11-10T03:00:00.000Z",
  updatedAt: "2026-11-10T03:00:00.000Z",
  attendee,
};

export const checkinFixture: CheckinListItem = {
  id: "2b3c4d5e-0000-4000-8000-000000000001",
  ticketId: ticketFixture.id,
  scannedAt: "2026-11-20T01:15:00.000Z",
  isOffline: false,
  syncStatus: "SYNCED",
  deviceId: "gate-1",
  attendee,
  ticketStatus: "CHECKED_IN",
};

export const admissionStatsFixture: AdmissionStats = {
  eventId: eventFixture.id,
  tickets: { total: 120, checkedIn: 42, remaining: 78 },
  orders: { total: 80, confirmed: 75, pending: 3, failed: 2, soldTickets: 120 },
  byGate: [
    { gate: "gate-1", count: 30 },
    { gate: "gate-2", count: 12 },
  ],
  lastCheckinAt: "2026-11-20T01:15:00.000Z",
};

export function makeList<T>(items: T[], nextCursor: string | null = null): ListResponse<T> {
  return { items, nextCursor };
}
