import { PrismaClient, type Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

type SeedUser = { email: string; fullName: string; role: Role };

const users: SeedUser[] = [
  { email: "organizer@qevent.com", fullName: "Alex Nguyen (Organizer)", role: "ORGANIZER" },
  { email: "staff1@qevent.com", fullName: "Staff One", role: "STAFF" },
  { email: "staff2@qevent.com", fullName: "Staff Two", role: "STAFF" },
  { email: "attendee@qevent.com", fullName: "Attendee One", role: "ATTENDEE" },
  { email: "attendee2@qevent.com", fullName: "Attendee Two", role: "ATTENDEE" },
];

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);
  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: { ...user, passwordHash },
    });
  }
  console.log(`Seeded ${users.length} admission users (idempotent).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
