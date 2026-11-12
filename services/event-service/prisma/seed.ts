import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ids = {
  event: "11111111-1111-4111-8111-111111111111",
  room: "22222222-2222-4222-8222-222222222222",
  session: "33333333-3333-4333-8333-333333333333",
  ticketType: "44444444-4444-4444-8444-444444444444",
};

const day = 24 * 60 * 60 * 1000;

async function main() {
  const startTime = new Date(Date.now() + 7 * day);
  const endTime = new Date(Date.now() + 7 * day + 8 * 60 * 60 * 1000);

  await prisma.event.upsert({
    where: { id: ids.event },
    update: { startTime, endTime },
    create: {
      id: ids.event,
      name: "Tech Summit Vietnam 2026",
      venue: "Saigon Exhibition and Convention Center",
      startTime,
      endTime,
      maxCapacity: 500,
    },
  });

  await prisma.room.upsert({
    where: { id: ids.room },
    update: {},
    create: { id: ids.room, eventId: ids.event, name: "Main Hall", capacity: 500 },
  });

  await prisma.session.upsert({
    where: { id: ids.session },
    update: { startTime, endTime },
    create: {
      id: ids.session,
      eventId: ids.event,
      title: "Opening Keynote",
      speaker: "Alex Nguyen",
      startTime,
      endTime: new Date(startTime.getTime() + 60 * 60 * 1000),
      isLive: false,
    },
  });

  await prisma.ticketType.upsert({
    where: { id: ids.ticketType },
    update: {},
    create: {
      id: ids.ticketType,
      eventId: ids.event,
      name: "Standard",
      price: 25,
      quota: 500,
    },
  });

  console.log("Seeded event-service demo data (idempotent).");
  console.log({ eventId: ids.event, ticketTypeId: ids.ticketType, sessionId: ids.session });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
