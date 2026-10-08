import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting qCheck database seeding...");

  const existingUsers = await prisma.user.count();
  const forceSeed = process.env.FORCE_SEED === "true" || true; // Force seed to populate new models and live events

  if (forceSeed) {
    console.log("⚠️ Cleaning and re-seeding qCheck tables...");
    await prisma.quizAnswer.deleteMany();
    await prisma.quizOption.deleteMany();
    await prisma.quizQuestion.deleteMany();
    await prisma.quizGame.deleteMany();
    await prisma.pollVote.deleteMany();
    await prisma.pollOption.deleteMany();
    await prisma.poll.deleteMany();
    await prisma.qAQuestionVote.deleteMany();
    await prisma.qAQuestion.deleteMany();
    await prisma.checkinLog.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.ticketType.deleteMany();
    await prisma.session.deleteMany();
    await prisma.room.deleteMany();
    await prisma.eventInvitation.deleteMany();
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

  const attendee2 = await prisma.user.create({
    data: {
      email: "attendee2@qcheck.com",
      passwordHash,
      fullName: "Lan Tran (Attendee)",
      role: "ATTENDEE",
    },
  });

  console.log("✅ Seeded Users: Organizer, Staff 1, Staff 2, Attendee 1, Attendee 2");

  // 2. Create Event (Mark as LIVE for instant testing)
  const now = new Date();
  const liveEvent = await prisma.event.create({
    data: {
      name: "Tech Summit Vietnam 2026",
      venue: "Grand Convention Center, Saigon",
      inviteCode: "TECHSUMMIT2026",
      startTime: new Date(now.getTime() - 3600000 * 2), // Started 2 hours ago
      endTime: new Date(now.getTime() + 3600000 * 6),   // Ends in 6 hours
      maxCapacity: 1000,
      isLive: true,
    },
  });

  // Seed Event Invitations
  const invitation1 = await prisma.eventInvitation.create({
    data: {
      eventId: liveEvent.id,
      email: "attendee@qcheck.com",
      code: "VIP-SUMMIT-2026",
      role: "ATTENDEE",
      isClaimed: false,
    },
  });

  // 3. Create Rooms
  const mainHall = await prisma.room.create({
    data: {
      eventId: liveEvent.id,
      name: "Grand Ballroom A",
      capacity: 500,
    },
  });

  const workshopRoom = await prisma.room.create({
    data: {
      eventId: liveEvent.id,
      name: "Workshop Hall 2",
      capacity: 100,
    },
  });

  // 4. Create Sessions (Session 1 is currently LIVE)
  const liveSession = await prisma.session.create({
    data: {
      eventId: liveEvent.id,
      roomId: mainHall.id,
      title: "Keynote: The Future of Agentic AI & Bun Runtime",
      description: "Khám phá kiến trúc Backend hiệu năng cao và Agentic AI năm 2026",
      speakerName: "Alex Nguyen (Lead Architect)",
      startTime: new Date(now.getTime() - 3600000), // Started 1 hour ago
      endTime: new Date(now.getTime() + 3600000 * 2), // Ends in 2 hours
      isLive: true,
    },
  });

  const upcomingSession = await prisma.session.create({
    data: {
      eventId: liveEvent.id,
      roomId: workshopRoom.id,
      title: "Deep Dive: Offline-First Check-in Architecture",
      description: "Thực chiến lưu trữ SQLite local và giải quyết xung đột khi rớt mạng",
      speakerName: "Staff Sarah (Senior Engineer)",
      startTime: new Date(now.getTime() + 86400000),
      endTime: new Date(now.getTime() + 86400000 + 7200000),
      isLive: false,
    },
  });

  // 5. Create Ticket Types
  const earlyBird = await prisma.ticketType.create({
    data: {
      eventId: liveEvent.id,
      name: "Early Bird Pass",
      price: 25.0,
      totalQuantity: 100,
      soldQuantity: 1,
    },
  });

  const standardPass = await prisma.ticketType.create({
    data: {
      eventId: liveEvent.id,
      name: "Standard Pass",
      price: 50.0,
      totalQuantity: 300,
      soldQuantity: 1,
    },
  });

  const vipPass = await prisma.ticketType.create({
    data: {
      eventId: liveEvent.id,
      name: "VIP All-Access",
      price: 120.0,
      totalQuantity: 50,
      soldQuantity: 0,
    },
  });

  // 6. Pre-issue Ticket to Attendee (Status: PAID - ready to check in)
  const ticket1 = await prisma.ticket.create({
    data: {
      eventId: liveEvent.id,
      userId: attendee.id,
      ticketTypeId: earlyBird.id,
      status: "PAID",
      totpSecret: crypto.randomUUID(),
    },
  });

  // Pre-issue a CHECKED_IN ticket for Attendee 2 (so we have an already checked in user to test Q&A immediately)
  const ticket2 = await prisma.ticket.create({
    data: {
      eventId: liveEvent.id,
      userId: attendee2.id,
      ticketTypeId: standardPass.id,
      status: "CHECKED_IN",
      totpSecret: crypto.randomUUID(),
      checkedInAt: new Date(now.getTime() - 1800000),
    },
  });

  await prisma.checkinLog.create({
    data: {
      ticketId: ticket2.id,
      staffId: staff1.id,
      scannedAt: new Date(now.getTime() - 1800000),
      deviceId: "Gate_A_Scanner",
      isOffline: false,
      syncStatus: "SYNCED",
    },
  });

  // 7. Seed Q&A Questions
  const q1 = await prisma.qAQuestion.create({
    data: {
      sessionId: liveSession.id,
      userId: attendee2.id,
      content: "Can we run local LLMs offline with Bun and React Native?",
      upvotes: 12,
    },
  });

  const q2 = await prisma.qAQuestion.create({
    data: {
      sessionId: liveSession.id,
      userId: attendee2.id,
      content: "How does the conflict resolution algorithm handle network latency?",
      upvotes: 8,
    },
  });

  // 8. Seed Interactive Questions (Polls)
  const poll1 = await prisma.poll.create({
    data: {
      sessionId: liveSession.id,
      question: "Bạn đã từng triển khai kiến trúc Offline-First trong sản phẩm thực tế chưa?",
      isActive: true,
      options: {
        create: [
          { text: "Đã triển khai và đang chạy production" },
          { text: "Đang nghiên cứu và thử nghiệm" },
          { text: "Chưa từng, đang tìm hiểu giải pháp" },
        ],
      },
    },
    include: { options: true },
  });

  // Vote on poll by attendee2
  await prisma.pollVote.create({
    data: {
      pollId: poll1.id,
      optionId: poll1.options[0].id,
      userId: attendee2.id,
    },
  });

  // 9. Seed Kahoot-style Live Quiz Game
  const quizGame = await prisma.quizGame.create({
    data: {
      sessionId: liveSession.id,
      title: "qCheck Tech Trivia: Thử thách Kiến trúc Offline & TOTP",
      description: "Mini-game tương tác trắc nghiệm tốc độ cao dành cho khán giả tại hội trường",
      status: "WAITING",
      currentQuestionIndex: -1,
      questions: {
        create: [
          {
            orderNum: 0,
            question: "Chu kỳ làm mới Dynamic QR trên qCheck là bao nhiêu giây?",
            timeLimitSec: 20,
            points: 1000,
            options: {
              create: [
                { text: "15 giây", color: "RED", isCorrect: false },
                { text: "30 giây", color: "BLUE", isCorrect: true },
                { text: "45 giây", color: "YELLOW", isCorrect: false },
                { text: "60 giây", color: "GREEN", isCorrect: false },
              ],
            },
          },
          {
            orderNum: 1,
            question: "Thuật toán nào được qCheck dùng để ký số Dynamic QR chống làm giả?",
            timeLimitSec: 20,
            points: 1000,
            options: {
              create: [
                { text: "RSA-256 (RS256)", color: "RED", isCorrect: true },
                { text: "MD5 Hashing", color: "BLUE", isCorrect: false },
                { text: "DES 56-bit", color: "YELLOW", isCorrect: false },
                { text: "Plain Base64", color: "GREEN", isCorrect: false },
              ],
            },
          },
        ],
      },
    },
  });

  console.log("✅ Seeding completed successfully!");
  console.log({
    event: liveEvent.name,
    inviteCode: liveEvent.inviteCode,
    invitationCode: invitation1.code,
    isEventLive: liveEvent.isLive,
    liveSessionId: liveSession.id,
    attendeePaidTicket: { email: attendee.email, ticketId: ticket1.id, status: ticket1.status },
    attendeeCheckedInTicket: { email: attendee2.email, ticketId: ticket2.id, status: ticket2.status },
    pollId: poll1.id,
    quizGameId: quizGame.id,
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
