/**
 * Seed script – run with: pnpm db:seed (or npm run db:seed)
 * Creates initial admin, prizes, and an invite link.
 */
import { PrismaClient, UserRole, UserStatus } from "@prisma/client";
import { hashPin } from "../src/lib/auth/pin";

const prisma = new PrismaClient();

async function main() {
  // Default admin PIN: 1234 – CHANGE AFTER FIRST LOGIN
  const adminPinHash = await hashPin("1234");

  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      name: "Admin",
      surname: "User",
      username: "admin",
      pinHash: adminPinHash,
      status: UserStatus.approved,
      role: UserRole.admin,
      approvedAt: new Date(),
    },
  });

  console.log("Admin user:", admin.username);

  const prizeData = [
    { place: 1, title: "1st prize", description: "Prize for the first-placed user" },
    { place: 2, title: "2nd prize", description: "Prize for the second-placed user" },
    { place: 3, title: "3rd prize", description: "Prize for the third-placed user" },
  ];

  for (const compId of ["CL", "OTHER"]) {
    for (const p of prizeData) {
      await prisma.prize.upsert({
        where: { competitionId_place: { competitionId: compId, place: p.place } },
        update: { title: p.title, description: p.description },
        create: { competitionId: compId, ...p },
      });
    }
  }
  console.log("Prizes created: 6 (3 per league)");

  const token = "invite-" + Math.random().toString(36).slice(2, 12);
  await prisma.inviteLink.upsert({
    where: { token },
    update: {},
    create: {
      token,
      isActive: true,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });
  console.log("Invite link token:", token);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
