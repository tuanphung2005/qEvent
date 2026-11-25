import { PrismaClient, type Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

type SeedUser = { id?: string; email: string; fullName: string; role: Role };

const users: SeedUser[] = [
  { email: "organizer@qevent.com", fullName: "Alex Nguyen (Organizer)", role: "ORGANIZER" },
  {
    // Fixed id: event-service uses it to seed per-event host assignments.
    id: "0f7a1b2c-0000-4000-8000-000000000004",
    email: "host@qevent.com",
    fullName: "Alex Nguyen (Host)",
    role: "HOST",
  },
  { email: "staff1@qevent.com", fullName: "Lê Thị Hồng", role: "STAFF" },
  { email: "staff2@qevent.com", fullName: "Nguyễn Quốc Bảo", role: "STAFF" },
  { email: "attendee@qevent.com", fullName: "Nguyễn Văn An", role: "ATTENDEE" },
  { email: "attendee2@qevent.com", fullName: "Trần Thị Bích", role: "ATTENDEE" },
  { email: "attendee3@qevent.com", fullName: "Lê Hoàng Nam", role: "ATTENDEE" },
  { email: "attendee4@qevent.com", fullName: "Phạm Thu Hà", role: "ATTENDEE" },
  { email: "attendee5@qevent.com", fullName: "Vũ Đức Long", role: "ATTENDEE" },
  { email: "attendee6@qevent.com", fullName: "Đỗ Mai Linh", role: "ATTENDEE" },
  { email: "attendee7@qevent.com", fullName: "Ngô Quang Huy", role: "ATTENDEE" },
  { email: "attendee8@qevent.com", fullName: "Bùi Khánh Vy", role: "ATTENDEE" },
  { email: "attendee9@qevent.com", fullName: "Hoàng Minh Khoa", role: "ATTENDEE" },
  { email: "attendee10@qevent.com", fullName: "Đặng Thảo Nhi", role: "ATTENDEE" },
];

// Ids owned by event-service/prisma/seed.ts.
const events = {
  techSummit: "11111111-1111-4111-8111-111111111111",
  indie: "11111111-1111-4111-8111-111111111112",
  devops: "11111111-1111-4111-8111-111111111113",
  ai: "11111111-1111-4111-8111-111111111114",
};
const ticketTypes = {
  techStandard: "44444444-4444-4444-8444-444444444444",
  techVip: "44444444-4444-4444-8444-444444444445",
  indieGa: "44444444-4444-4444-8444-444444444451",
  devopsStandard: "44444444-4444-4444-8444-444444444461",
  aiStandard: "44444444-4444-4444-8444-444444444471",
  aiVip: "44444444-4444-4444-8444-444444444472",
};

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);

type OrderSeed = {
  id: string;
  email: string;
  eventId: string;
  ticketTypeId: string;
  status: string;
  quantity: number;
  totalAmount: number;
  failureCode?: string;
  tickets: Array<{ id: string; status: "PENDING_PAYMENT" | "PAID" | "CHECKED_IN" | "CANCELLED" }>;
};

/** A handful of non-green rows so every status badge shows up on first load. */
const orders: OrderSeed[] = [
  {
    id: "55555555-5555-4555-8555-555555550001",
    email: "attendee2@qevent.com",
    eventId: events.techSummit,
    ticketTypeId: ticketTypes.techStandard,
    status: "CONFIRMED",
    quantity: 2,
    totalAmount: 500_000,
    tickets: [
      { id: "66666666-6666-4666-8666-666666660001", status: "PAID" },
      { id: "66666666-6666-4666-8666-666666660002", status: "CANCELLED" },
    ],
  },
  {
    id: "55555555-5555-4555-8555-555555550002",
    email: "attendee3@qevent.com",
    eventId: events.techSummit,
    ticketTypeId: ticketTypes.techVip,
    status: "PENDING",
    quantity: 1,
    totalAmount: 750_000,
    tickets: [{ id: "66666666-6666-4666-8666-666666660003", status: "PENDING_PAYMENT" }],
  },
  {
    id: "55555555-5555-4555-8555-555555550003",
    email: "attendee4@qevent.com",
    eventId: events.devops,
    ticketTypeId: ticketTypes.devopsStandard,
    status: "FAILED",
    quantity: 1,
    totalAmount: 350_000,
    failureCode: "RESERVATION_EXPIRED",
    tickets: [],
  },
  {
    id: "55555555-5555-4555-8555-555555550004",
    email: "attendee5@qevent.com",
    eventId: events.ai,
    ticketTypeId: ticketTypes.aiVip,
    status: "PENDING_RECONCILIATION",
    quantity: 1,
    totalAmount: 900_000,
    tickets: [{ id: "66666666-6666-4666-8666-666666660004", status: "PAID" }],
  },
  {
    id: "55555555-5555-4555-8555-555555550005",
    email: "attendee6@qevent.com",
    eventId: events.indie,
    ticketTypeId: ticketTypes.indieGa,
    status: "CONFIRMED",
    quantity: 3,
    totalAmount: 1_350_000,
    tickets: [
      { id: "66666666-6666-4666-8666-666666660005", status: "CHECKED_IN" },
      { id: "66666666-6666-4666-8666-666666660006", status: "CHECKED_IN" },
      { id: "66666666-6666-4666-8666-666666660007", status: "PAID" },
    ],
  },
  {
    id: "55555555-5555-4555-8555-555555550006",
    email: "attendee7@qevent.com",
    eventId: events.ai,
    ticketTypeId: ticketTypes.aiStandard,
    status: "CONFIRMED",
    quantity: 2,
    totalAmount: 600_000,
    tickets: [
      { id: "66666666-6666-4666-8666-666666660008", status: "CHECKED_IN" },
      { id: "66666666-6666-4666-8666-666666660009", status: "PAID" },
    ],
  },
];

const checkedInAt: Record<string, Date> = {
  "66666666-6666-4666-8666-666666660005": minutesAgo(34),
  "66666666-6666-4666-8666-666666660006": minutesAgo(12),
  "66666666-6666-4666-8666-666666660008": minutesAgo(52),
};

const checkins = [
  {
    id: "77777777-7777-4777-8777-777777770001",
    ticketId: "66666666-6666-4666-8666-666666660005",
    deviceId: "gate-1",
    isOffline: false,
    syncStatus: "SYNCED",
    scannedAt: minutesAgo(34),
  },
  {
    id: "77777777-7777-4777-8777-777777770002",
    ticketId: "66666666-6666-4666-8666-666666660006",
    deviceId: "gate-2",
    isOffline: true,
    syncStatus: "SYNCED",
    scannedAt: minutesAgo(12),
  },
  {
    id: "77777777-7777-4777-8777-777777770003",
    ticketId: "66666666-6666-4666-8666-666666660008",
    deviceId: "gate-1",
    isOffline: false,
    syncStatus: "SYNCED",
    scannedAt: minutesAgo(52),
  },
  {
    // Duplicate scan of an already checked-in ticket: shows the conflict tone.
    id: "77777777-7777-4777-8777-777777770004",
    ticketId: "66666666-6666-4666-8666-666666660008",
    deviceId: "gate-2",
    isOffline: true,
    syncStatus: "CONFLICT",
    scannedAt: minutesAgo(47),
  },
];

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);
  const userIds = new Map<string, string>();

  for (const user of users) {
    const row = await prisma.user.upsert({
      where: { email: user.email },
      // The demo host keeps a fixed id so event-service can assign it. It has no
      // orders/tickets, so changing the primary key on an old seed is safe.
      update: user.id ? { id: user.id } : {},
      create: { ...user, passwordHash },
    });
    userIds.set(user.email, row.id);
  }

  const staffId = userIds.get("staff1@qevent.com")!;

  for (const order of orders) {
    const userId = userIds.get(order.email);
    if (!userId) continue;

    await prisma.order.upsert({
      where: { id: order.id },
      update: {},
      create: {
        id: order.id,
        userId,
        eventId: order.eventId,
        ticketTypeId: order.ticketTypeId,
        idempotencyKey: `seed-${order.id}`,
        operationId: `seed-op-${order.id}`,
        status: order.status,
        quantity: order.quantity,
        totalAmount: order.totalAmount,
        failureCode: order.failureCode ?? null,
      },
    });

    for (const ticket of order.tickets) {
      await prisma.ticket.upsert({
        where: { id: ticket.id },
        update: {},
        create: {
          id: ticket.id,
          orderId: order.id,
          userId,
          eventId: order.eventId,
          ticketTypeId: order.ticketTypeId,
          status: ticket.status,
          qrSecret: `seed-qr-${ticket.id}`,
          checkedInAt: checkedInAt[ticket.id] ?? null,
        },
      });
    }
  }

  for (const log of checkins) {
    await prisma.checkinLog.upsert({
      where: { id: log.id },
      update: {},
      create: {
        id: log.id,
        ticketId: log.ticketId,
        scannedBy: staffId,
        scannedAt: log.scannedAt,
        isOffline: log.isOffline,
        deviceId: log.deviceId,
        syncStatus: log.syncStatus,
        scanKey: `seed-scan-${log.id}`,
      },
    });
  }

  console.log(`Seeded ${users.length} users, ${orders.length} orders, ${checkins.length} check-ins.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
