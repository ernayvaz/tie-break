"use server";

import { prisma } from "@/lib/db";
import { verifyPin } from "@/lib/auth/pin";
import { createSession } from "@/lib/auth/session";
import { validateLogin } from "@/lib/validation/auth";
import { checkLoginRateLimit } from "@/lib/rate-limit";
import { redirect } from "next/navigation";

export type LoginState = {
  error?: string;
  statusMessage?: "pending" | "rejected" | "blocked";
};

const RATE_LIMIT_MESSAGE = "Too many login attempts. Please try again in 15 minutes.";

export async function loginAction(
  _prev: LoginState | null,
  formData: FormData
): Promise<LoginState> {
  const username = (formData.get("username") as string)?.trim() ?? "";
  const pin = (formData.get("pin") as string) ?? "";

  const validation = validateLogin({ username, pin });
  if (!validation.ok) {
    return { error: validation.error };
  }

  const rateLimitKey = username.toLowerCase();
  if (!checkLoginRateLimit(rateLimitKey)) {
    return { error: RATE_LIMIT_MESSAGE };
  }

  const user = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
  });

  if (!user) {
    return { error: "No account found with this username. Register first." };
  }

  if (user.status === "pending_approval") {
    return { statusMessage: "pending" };
  }

  if (user.status === "rejected") {
    return { statusMessage: "rejected" };
  }

  if (user.status === "blocked") {
    return { statusMessage: "blocked" };
  }

  const pinOk = await verifyPin(pin, user.pinHash);
  if (!pinOk) {
    return { error: "Invalid username or PIN." };
  }

  await createSession(user.id);

  if (user.role === "admin") {
    redirect("/admin");
  }
  redirect("/schedule");
}
