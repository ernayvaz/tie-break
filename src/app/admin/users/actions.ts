"use server";

import { prisma } from "@/lib/db";
import { hashPin, isValidPinFormat } from "@/lib/auth/pin";
import { createAdminLog } from "@/lib/admin-log";
import { requireAdmin } from "@/lib/auth/get-user";
import { revalidatePath } from "next/cache";

export type UserActionState = { ok: true; message?: string } | { ok: false; error: string };

export async function approveUserAction(userId: string): Promise<UserActionState> {
  const admin = await requireAdmin();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, status: true },
  });
  if (!user) return { ok: false, error: "User not found." };
  if (user.status !== "pending_approval") return { ok: false, error: "User is not pending approval." };

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { status: "approved", approvedAt: new Date(), approvedBy: admin.id },
    }),
  ]);
  await createAdminLog(admin.id, "user_approved", "user", userId, user.status, "approved");
  revalidatePath("/admin/users");
  return { ok: true, message: "User approved. They can now log in." };
}

export async function rejectUserAction(userId: string): Promise<UserActionState> {
  const admin = await requireAdmin();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, status: true },
  });
  if (!user) return { ok: false, error: "User not found." };
  if (user.status !== "pending_approval") return { ok: false, error: "User is not pending approval." };

  await prisma.session.deleteMany({ where: { userId } });
  await prisma.user.update({
    where: { id: userId },
    data: { status: "rejected" },
  });
  await createAdminLog(admin.id, "user_rejected", "user", userId, user.status, "rejected");
  revalidatePath("/admin/users");
  return { ok: true, message: "User rejected." };
}

export async function blockUserAction(userId: string): Promise<UserActionState> {
  const admin = await requireAdmin();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, status: true },
  });
  if (!user) return { ok: false, error: "User not found." };
  if (user.status !== "approved") return { ok: false, error: "Only approved users can be blocked." };

  await prisma.session.deleteMany({ where: { userId } });
  await prisma.user.update({
    where: { id: userId },
    data: { status: "blocked" },
  });
  await createAdminLog(admin.id, "user_blocked", "user", userId, user.status, "blocked");
  revalidatePath("/admin/users");
  return { ok: true, message: "User blocked. Their sessions have been invalidated." };
}

export async function unblockUserAction(userId: string): Promise<UserActionState> {
  const admin = await requireAdmin();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, status: true },
  });
  if (!user) return { ok: false, error: "User not found." };
  if (user.status !== "blocked") return { ok: false, error: "User is not blocked." };

  await prisma.user.update({
    where: { id: userId },
    data: { status: "approved" },
  });
  await createAdminLog(admin.id, "user_unblocked", "user", userId, user.status, "approved");
  revalidatePath("/admin/users");
  return { ok: true, message: "User unblocked." };
}

export async function updateUsernameAction(
  userId: string,
  newUsername: string
): Promise<UserActionState> {
  const admin = await requireAdmin();
  const trimmed = newUsername.trim();
  if (!trimmed) return { ok: false, error: "Username is required." };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true },
  });
  if (!user) return { ok: false, error: "User not found." };
  if (user.username === trimmed) return { ok: true };

  const existing = await prisma.user.findUnique({
    where: { username: trimmed },
    select: { id: true },
  });
  if (existing && existing.id !== userId) return { ok: false, error: "Username already taken." };

  await prisma.user.update({
    where: { id: userId },
    data: { username: trimmed },
  });
  await createAdminLog(admin.id, "username_updated", "user", userId, user.username, trimmed);
  revalidatePath("/admin/users");
  return { ok: true, message: "Username updated." };
}

export async function resetPinAction(userId: string, newPin: string): Promise<UserActionState> {
  const admin = await requireAdmin();
  if (!isValidPinFormat(newPin)) return { ok: false, error: "PIN must be exactly 4 digits." };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true },
  });
  if (!user) return { ok: false, error: "User not found." };

  const pinHash = await hashPin(newPin);
  await prisma.user.update({
    where: { id: userId },
    data: { pinHash },
  });
  await createAdminLog(admin.id, "pin_reset", "user", userId, null, "(hidden)");
  revalidatePath("/admin/users");
  return { ok: true, message: "PIN reset successfully." };
}

export async function deleteUserAction(userId: string): Promise<UserActionState> {
  const admin = await requireAdmin();
  if (userId === admin.id) return { ok: false, error: "You cannot delete your own account." };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, name: true, surname: true, role: true },
  });
  if (!user) return { ok: false, error: "User not found." };
  if (user.role === "admin") return { ok: false, error: "Admin users cannot be deleted." };

  await prisma.user.updateMany({
    where: { approvedBy: userId },
    data: { approvedBy: null },
  });
  await prisma.user.delete({ where: { id: userId } });
  await createAdminLog(admin.id, "user_deleted", "user", userId, `${user.username} (${user.name} ${user.surname})`, null);
  revalidatePath("/admin/users");
  return { ok: true, message: "User deleted. Their sessions, predictions, and leaderboard entry have been removed." };
}
