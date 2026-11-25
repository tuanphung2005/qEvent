import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const hour = 60 * 60 * 1000;
const day = 24 * hour;
const from = (offsetMs: number) => new Date(Date.now() + offsetMs);

type RoomSeed = { id: string; name: string; capacity: number };
type SessionSeed = {
  id: string;
  title: string;
  speaker: string;
  startTime: Date;
  endTime: Date;
  isLive?: boolean;
};
type TicketTypeSeed = {
  id: string;
  name: string;
  price: number;
  quota: number;
  soldCount: number;
};
type EventSeed = {
  id: string;
  name: string;
  venue: string;
  startTime: Date;
  endTime: Date;
  maxCapacity: number;
  reservedCount: number;
  rooms: RoomSeed[];
  sessions: SessionSeed[];
  ticketTypes: TicketTypeSeed[];
};

/**
 * Demo catalogue. Ids are fixed so admission/engagement seeds (and the demo
 * activity script) can point at the same event, session and ticket-type rows.
 * Times are relative to the seed run: one live event, one next week, one next
 * month — the console never shows an empty or all-green list.
 */
const events: EventSeed[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Tech Summit Vietnam 2026",
    venue: "Saigon Exhibition and Convention Center",
    startTime: from(7 * day),
    endTime: from(7 * day + 8 * hour),
    maxCapacity: 500,
    reservedCount: 220,
    rooms: [
      { id: "22222222-2222-4222-8222-222222222222", name: "Main Hall", capacity: 500 },
      { id: "22222222-2222-4222-8222-222222222202", name: "Innovation Stage", capacity: 200 },
      { id: "22222222-2222-4222-8222-222222222203", name: "Workshop Lab", capacity: 80 },
    ],
    sessions: [
      {
        id: "33333333-3333-4333-8333-333333333333",
        title: "Opening Keynote",
        speaker: "Alex Nguyen",
        startTime: from(7 * day),
        endTime: from(7 * day + hour),
        isLive: true,
      },
      {
        id: "33333333-3333-4333-8333-333333333334",
        title: "Scaling check-in to 10k gates",
        speaker: "Minh Tran",
        startTime: from(7 * day + hour),
        endTime: from(7 * day + 2 * hour),
      },
      {
        id: "33333333-3333-4333-8333-333333333335",
        title: "Zero-trust ticketing",
        speaker: "Lan Pham",
        startTime: from(7 * day + 2 * hour),
        endTime: from(7 * day + 3 * hour),
      },
      {
        id: "33333333-3333-4333-8333-333333333336",
        title: "Closing panel: vé số tương lai",
        speaker: "Ha Vu",
        startTime: from(7 * day + 3 * hour),
        endTime: from(7 * day + 4 * hour),
      },
    ],
    ticketTypes: [
      {
        id: "44444444-4444-4444-8444-444444444444",
        name: "Standard",
        price: 250_000,
        quota: 500,
        soldCount: 120,
      },
      {
        id: "44444444-4444-4444-8444-444444444445",
        name: "VIP",
        price: 750_000,
        quota: 100,
        soldCount: 45,
      },
      {
        id: "44444444-4444-4444-8444-444444444446",
        name: "Student",
        price: 150_000,
        quota: 120,
        soldCount: 55,
      },
    ],
  },
  {
    id: "11111111-1111-4111-8111-111111111112",
    name: "Đêm nhạc Indie Sài Gòn 2026",
    venue: "Sân vận động Hoa Lư",
    startTime: from(-2 * hour),
    endTime: from(4 * hour),
    maxCapacity: 1200,
    reservedCount: 675,
    rooms: [
      { id: "22222222-2222-4222-8222-222222222211", name: "Khán đài A", capacity: 600 },
      { id: "22222222-2222-4222-8222-222222222212", name: "Khán đài B", capacity: 600 },
    ],
    sessions: [
      {
        id: "33333333-3333-4333-8333-333333333337",
        title: "Soundcheck & mở cổng",
        speaker: "Ban tổ chức",
        startTime: from(-2 * hour),
        endTime: from(-1 * hour),
      },
      {
        id: "33333333-3333-4333-8333-333333333338",
        title: "Indie Night Live",
        speaker: "Various artists",
        startTime: from(-1 * hour),
        endTime: from(2 * hour),
        isLive: true,
      },
      {
        id: "33333333-3333-4333-8333-333333333339",
        title: "Encore & giao lưu",
        speaker: "Ban tổ chức",
        startTime: from(2 * hour),
        endTime: from(4 * hour),
      },
    ],
    ticketTypes: [
      {
        id: "44444444-4444-4444-8444-444444444451",
        name: "GA",
        price: 450_000,
        quota: 800,
        soldCount: 512,
      },
      {
        id: "44444444-4444-4444-8444-444444444452",
        name: "VIP",
        price: 1_200_000,
        quota: 200,
        soldCount: 141,
      },
      {
        id: "44444444-4444-4444-8444-444444444453",
        name: "Backstage",
        price: 2_500_000,
        quota: 50,
        soldCount: 22,
      },
    ],
  },
  {
    id: "11111111-1111-4111-8111-111111111113",
    name: "DevOps Day Đà Nẵng 2026",
    venue: "Trung tâm Hội nghị Ariyana",
    startTime: from(21 * day),
    endTime: from(21 * day + 6 * hour),
    maxCapacity: 350,
    reservedCount: 127,
    rooms: [
      { id: "22222222-2222-4222-8222-222222222241", name: "Hall A", capacity: 250 },
      { id: "22222222-2222-4222-8222-222222222242", name: "Hall B", capacity: 100 },
    ],
    sessions: [
      {
        id: "33333333-3333-4333-8333-333333333340",
        title: "Observability thực chiến",
        speaker: "Đức Lê",
        startTime: from(21 * day),
        endTime: from(21 * day + hour),
      },
      {
        id: "33333333-3333-4333-8333-333333333341",
        title: "Kubernetes trên production",
        speaker: "Hải Ngô",
        startTime: from(21 * day + hour),
        endTime: from(21 * day + 2 * hour),
      },
      {
        id: "33333333-3333-4333-8333-333333333342",
        title: "SRE on-call không burnout",
        speaker: "Mai Đỗ",
        startTime: from(21 * day + 2 * hour),
        endTime: from(21 * day + 3 * hour),
      },
    ],
    ticketTypes: [
      {
        id: "44444444-4444-4444-8444-444444444461",
        name: "Standard",
        price: 350_000,
        quota: 300,
        soldCount: 96,
      },
      {
        id: "44444444-4444-4444-8444-444444444462",
        name: "Workshop",
        price: 600_000,
        quota: 50,
        soldCount: 31,
      },
    ],
  },
  {
    id: "11111111-1111-4111-8111-111111111114",
    name: "AI & Vé thông minh 2026",
    venue: "Trung tâm Hội nghị Quốc gia, Hà Nội",
    startTime: from(3 * day),
    endTime: from(3 * day + 5 * hour),
    maxCapacity: 400,
    reservedCount: 237,
    rooms: [
      { id: "22222222-2222-4222-8222-222222222231", name: "Auditorium", capacity: 300 },
      { id: "22222222-2222-4222-8222-222222222232", name: "Demo Zone", capacity: 100 },
    ],
    sessions: [
      {
        id: "33333333-3333-4333-8333-333333333343",
        title: "Thị giác máy tính cho soát vé",
        speaker: "Khoa Vũ",
        startTime: from(3 * day),
        endTime: from(3 * day + hour),
      },
      {
        id: "33333333-3333-4333-8333-333333333344",
        title: "Chống gian lận QR",
        speaker: "Linh Hoàng",
        startTime: from(3 * day + hour),
        endTime: from(3 * day + 2 * hour),
      },
      {
        id: "33333333-3333-4333-8333-333333333345",
        title: "Demo: check-in dưới 0.3 giây",
        speaker: "Đội kỹ thuật",
        startTime: from(3 * day + 2 * hour),
        endTime: from(3 * day + 3 * hour),
      },
    ],
    ticketTypes: [
      {
        id: "44444444-4444-4444-8444-444444444471",
        name: "Standard",
        price: 300_000,
        quota: 350,
        soldCount: 204,
      },
      {
        id: "44444444-4444-4444-8444-444444444472",
        name: "VIP",
        price: 900_000,
        quota: 50,
        soldCount: 33,
      },
    ],
  },
];

/**
 * The demo HOST login is seeded by admission-service with this fixed id, so
 * event-service can assign it without querying another service during seed.
 */
const HOST_USER_ID = "0f7a1b2c-0000-4000-8000-000000000004";
const HOST_EVENT_IDS = [
  "11111111-1111-4111-8111-111111111111", // Tech Summit
  "11111111-1111-4111-8111-111111111114", // AI & Vé thông minh
];

async function main() {
  for (const event of events) {
    await prisma.event.upsert({
      where: { id: event.id },
      update: {
        name: event.name,
        venue: event.venue,
        startTime: event.startTime,
        endTime: event.endTime,
        maxCapacity: event.maxCapacity,
      },
      create: {
        id: event.id,
        name: event.name,
        venue: event.venue,
        startTime: event.startTime,
        endTime: event.endTime,
        maxCapacity: event.maxCapacity,
        reservedCount: event.reservedCount,
      },
    });

    for (const room of event.rooms) {
      await prisma.room.upsert({
        where: { id: room.id },
        update: { name: room.name, capacity: room.capacity },
        create: { ...room, eventId: event.id },
      });
    }

    for (const session of event.sessions) {
      await prisma.session.upsert({
        where: { id: session.id },
        update: {
          title: session.title,
          speaker: session.speaker,
          startTime: session.startTime,
          endTime: session.endTime,
          isLive: session.isLive ?? false,
        },
        create: {
          ...session,
          isLive: session.isLive ?? false,
          eventId: event.id,
        },
      });
    }

    for (const type of event.ticketTypes) {
      await prisma.ticketType.upsert({
        where: { id: type.id },
        update: { name: type.name, price: type.price, quota: type.quota },
        create: { ...type, eventId: event.id },
      });
      // Never lower a real counter, but top it up to the demo baseline so the
      // console never shows sold > reserved after a fresh seed.
      await prisma.$executeRaw`UPDATE "TicketType" SET "soldCount" = GREATEST("soldCount", ${type.soldCount}::int) WHERE "id" = ${type.id}`;
    }

    await prisma.$executeRaw`UPDATE "Event" SET "reservedCount" = GREATEST("reservedCount", (SELECT COALESCE(SUM("soldCount"), 0)::int FROM "TicketType" WHERE "eventId" = ${event.id})) WHERE "id" = ${event.id}`;
  }

  console.log(`Seeded ${events.length} events (idempotent).`);

  for (const eventId of HOST_EVENT_IDS) {
    await prisma.eventHost.upsert({
      where: { eventId_userId: { eventId, userId: HOST_USER_ID } },
      update: {},
      create: { eventId, userId: HOST_USER_ID },
    });
  }
  console.log(`Assigned demo host to ${HOST_EVENT_IDS.length} events.`);
  console.log({
    events: events.map((event) => event.id),
    sessions: events.flatMap((event) => event.sessions.map((session) => session.id)),
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
