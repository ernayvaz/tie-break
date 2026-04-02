import { randomBytes } from "node:crypto";
import { prisma } from "../src/lib/db";

(async () => {
  const admin = await prisma.user.findUnique({
    where: { username: "admin" },
    select: { id: true },
  });
  if (!admin) {
    throw new Error("admin user not found");
  }
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await prisma.session.create({
    data: { userId: admin.id, sessionToken: token, expiresAt },
  });
  console.log(token);
  await prisma.$disconnect();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
