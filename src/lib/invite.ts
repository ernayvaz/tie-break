import { prisma } from "@/lib/db";

export async function validateInviteToken(token: string): Promise<boolean> {
  if (!token?.trim()) return false;
  const link = await prisma.inviteLink.findUnique({
    where: { token: token.trim(), isActive: true },
  });
  if (!link) return false;
  if (link.expiresAt && link.expiresAt < new Date()) return false;
  return true;
}
