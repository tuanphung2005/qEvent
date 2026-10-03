import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting qCheck database seeding...");

  const existingUsers = await prisma.user.count();
  const forceSeed = process.env.FORCE_SEED === "true";

  if (existingUsers > 0 && !forceSeed) {
    console.log("ℹ️ Database already populated (" + existingUsers + " users found). Skipping seed to preserve data.");
    return;
  }

  if (forceSeed) {
    console.log("⚠️ FORCE_SEED is enabled. Wiping existing database records...");
    await prisma.checkinLog.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.ticketType.deleteMany();
    await prisma.qAQuestion.deleteMany();
    await prisma.session.deleteMany();
    await prisma.room.deleteMany();
    await prisma.event.deleteMany();
    await prisma.user.deleteMany();
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync("password123", salt);

  // 1. Create Users
  const organizer = await prisma.user.create({
    data: {
      email: "organizer@qcheck.com",
      passwordHash,
      fullName: "Alex Nguyen (Organizer)",
      role: "ORGANIZER",
    },
  });

  const staff1 = await prisma.user.create({
    data: {
      email: "staff1@qcheck.com",
      passwordHash,
      fullName: "Staff Mike (Gate A)",
      role: "STAFF",
    },
  });

  const staff2 = await prisma.user.create({
    data: {
      email: "staff2@qcheck.com",
      passwordHash,
      fullName: "Staff Sarah (Gate B)",
      role: "STAFF",
    },
  });

  const attendee = await prisma.user.create({
    data: {
      email: "attendee@qcheck.com",
      passwordHash,
      fullName: "John Doe (Attendee)",
      role: "ATTENDEE",
    },
  });

  console.log("✅ Seeded Users: Organizer, Staff 1, Staff 2, Attendee");

  // 2. Create Event
  const now = new Date();
  const event = await prisma.event.create({
    data: {
      name: "Tech Summit Vietnam 2026",
      venue: "Grand Convention Center, Saigon",
      startTime: new Date(now.getTime() + 86400000 * 2),
      endTime: new Date(now.getTime() + 86400000 * 3),
      maxCapacity: 1000,
    },
  });

  // 3. Create Rooms
  const mainHall = await prisma.room.create({
    data: {
      eventId: event.id,
      name: "Grand Ballroom A",
      capacity: 500,
    },
  });

  const workshopRoom = await prisma.room.create({
    data: {
      eventId: event.id,
      name: "Workshop Hall 2",
      capacity: 100,
    },
  });

  // 4. Create Sessions
  const session1 = await prisma.session.create({
    data: {
      eventId: event.id,
      roomId: mainHall.id,
      title: "Keynote: The Future of Agentic AI & Bun Runtime",
      startTime: new Date(now.getTime() + 86400000 * 2 + 3600000 * 9),
      endTime: new Date(now.getTime() + 86400000 * 2 + 3600000 * 11),
    },
  });

  const session2 = await prisma.session.create({
    data: {
      eventId: event.id,
      roomId: workshopRoom.id,
      title: "Deep Dive: Offline-First Check-in Architecture",
      startTime: new Date(now.getTime() + 86400000 * 2 + 3600000 * 14),
      endTime: new Date(now.getTime() + 86400000 * 2 + 3600000 * 16),
    },
  });

  // 5. Create Ticket Types
  const earlyBird = await prisma.ticketType.create({
    data: {
      eventId: event.id,
      name: "Early Bird Pass",
      price: 25.0,
      totalQuantity: 100,
      soldQuantity: 1,
    },
  });

  const standardPass = await prisma.ticketType.create({
    data: {
      eventId: event.id,
      name: "Standard Pass",
      price: 50.0,
      totalQuantity: 300,
      soldQuantity: 1,
    },
  });

  const vipPass = await prisma.ticketType.create({
    data: {
      eventId: event.id,
      name: "VIP All-Access",
      price: 120.0,
      totalQuantity: 50,
      soldQuantity: 0,
    },
  });

  // 6. Pre-issue Tickets to Attendee
  const ticket1 = await prisma.ticket.create({
    data: {
      eventId: event.id,
      userId: attendee.id,
      ticketTypeId: earlyBird.id,
      status: "PAID",
      totpSecret: crypto.randomUUID(),
    },
  });

  const ticket2 = await prisma.ticket.create({
    data: {
      eventId: event.id,
      userId: attendee.id,
      ticketTypeId: standardPass.id,
      status: "PAID",
      totpSecret: crypto.randomUUID(),
    },
  });

  // 7. Pre-seed Q&A Questions
  await prisma.qAQuestion.create({
    data: {
      sessionId: session1.id,
      userId: attendee.id,
      content: "Can we run local LLMs offline with Bun and React Native?",
      upvotes: 12,
    },
  });

  await prisma.qAQuestion.create({
    data: {
      sessionId: session1.id,
      userId: attendee.id,
      content: "How does the conflict resolution algorithm handle network latency?",
      upvotes: 8,
    },
  });

  console.log("✅ Seeding completed successfully!");
  console.log({
    event: event.name,
    attendeeEmail: attendee.email,
    attendeeTickets: [ticket1.id, ticket2.id],
    staffEmail: staff1.email,
  });
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
