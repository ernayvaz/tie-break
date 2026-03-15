"use server";

import { prisma } from "@/lib/db";
import { hashPin } from "@/lib/auth/pin";
import { validateRegister } from "@/lib/validation/auth";
import { validateInviteToken } from "@/lib/invite";
import { checkRegisterRateLimit } from "@/lib/rate-limit";
import { getClientIpForRateLimit } from "@/lib/client-ip";
import { UserStatus } from "@prisma/client";

export type RegisterState = {
  success?: boolean;
  error?: string;
};

const RATE_LIMIT_MESSAGE = "Too many registration attempts from your network. Please try again later.";

export async function registerAction(
  _prev: RegisterState | null,
  formData: FormData
): Promise<RegisterState> {
  const inviteToken = (formData.get("inviteToken") as string)?.trim() ?? "";

  const validInvite = await validateInviteToken(inviteToken);
  if (!validInvite) {
    return { error: "Invalid or expired invite link. Please use a valid link to register." };
  }

  const ip = await getClientIpForRateLimit();
  if (!checkRegisterRateLimit(ip)) {
    return { error: RATE_LIMIT_MESSAGE };
  }

  const name = (formData.get("name") as string)?.trim() ?? "";
  const surname = (formData.get("surname") as string)?.trim() ?? "";
  const username = (formData.get("username") as string)?.trim() ?? "";
  const pin = (formData.get("pin") as string) ?? "";

  const validation = validateRegister({ name, surname, username, pin });
  if (!validation.ok) {
    return { error: validation.error };
  }

  const usernameLower = username.toLowerCase();
  const existing = await prisma.user.findUnique({
    where: { username: usernameLower },
  });

  if (existing) {
    return { error: "This username is already taken." };
  }

  const pinHash = await hashPin(pin);

  await prisma.user.create({
    data: {
      name: name.trim(),
      surname: surname.trim(),
      username: usernameLower,
      pinHash,
      status: UserStatus.pending_approval,
    },
  });

  return { success: true };
}
