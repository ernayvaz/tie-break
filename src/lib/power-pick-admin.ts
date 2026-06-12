import { prisma } from "@/lib/db";
import {
  POWER_PICK_PACKAGE_SIZE,
  POWER_PICK_COMPETITION_ID,
} from "@/lib/config";

export type PowerPickAdminScope = "all_users" | "selected_users";
export type PowerPickAdminAction = "grant" | "remove_unused" | "force_remove";

export type PowerPickAdminUserRow = {
  userId: string;
  name: string;
  surname: string;
  username: string;
  totalGranted: number;
  usedLocked: number;
  selectedUnlocked: number;
  remainingAvailable: number;
  updatedAt: string | null;
};

export type PowerPickAdminLogRow = {
  id: string;
  adminUserId: string;
  adminName: string | null;
  targetScope: PowerPickAdminScope;
  actionType: PowerPickAdminAction;
  amountGranted: number;
  affectedUsers: number;
  createdAt: string;
};

type Committed = { locked: number; activeUnlocked: number };

/** Per-user committed (locked + active-unlocked) Power Pick counts derived from selections. */
async function committedByUser(
  userIds: string[],
  competitionId: string,
  now: Date
): Promise<Map<string, Committed>> {
  const result = new Map<string, Committed>();
  if (userIds.length === 0) return result;
  const selections = await prisma.powerPickSelection.findMany({
    where: { userId: { in: userIds }, competitionId, status: { not: "revoked" } },
    select: {
      userId: true,
      status: true,
      match: { select: { lockAt: true, isLocked: true } },
    },
  });
  for (const sel of selections) {
    const entry = result.get(sel.userId) ?? { locked: 0, activeUnlocked: 0 };
    const locked =
      sel.status === "locked" || sel.match.isLocked || now >= sel.match.lockAt;
    if (locked) entry.locked += 1;
    else entry.activeUnlocked += 1;
    result.set(sel.userId, entry);
  }
  return result;
}

/** Resolve the set of eligible target users (approved players). */
async function resolveTargetUserIds(
  scope: PowerPickAdminScope,
  userIds: string[] | undefined
): Promise<string[]> {
  if (scope === "all_users") {
    const users = await prisma.user.findMany({
      where: { status: "approved", role: { not: "admin" } },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }
  const ids = [...new Set((userIds ?? []).filter(Boolean))];
  if (ids.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: ids }, status: "approved", role: { not: "admin" } },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

async function logAdminAction(
  adminUserId: string,
  scope: PowerPickAdminScope,
  actionType: PowerPickAdminAction,
  amountGranted: number,
  affectedUserIds: string[],
  competitionId: string
): Promise<void> {
  await prisma.adminPowerPickGrantLog.create({
    data: {
      adminUserId,
      targetScope: scope,
      targetUserIds: scope === "all_users" ? null : JSON.stringify(affectedUserIds),
      competitionId,
      amountGranted,
      actionType,
      affectedUsers: affectedUserIds.length,
    },
  });
}

/**
 * Grant a package of Power Pick x3 rights (default 3) to the target users.
 * Adds to any existing balance.
 */
export async function grantPowerPick(params: {
  adminUserId: string;
  scope: PowerPickAdminScope;
  userIds?: string[];
  amount?: number;
  competitionId?: string;
}): Promise<{ ok: true; affected: number; amount: number } | { ok: false; error: string }> {
  const competitionId = params.competitionId ?? POWER_PICK_COMPETITION_ID;
  const amount = Math.max(1, Math.floor(params.amount ?? POWER_PICK_PACKAGE_SIZE));
  const targets = await resolveTargetUserIds(params.scope, params.userIds);
  if (targets.length === 0) return { ok: false, error: "No eligible users selected." };

  for (const userId of targets) {
    await prisma.userPowerPickBalance.upsert({
      where: { userId_competitionId: { userId, competitionId } },
      create: { userId, competitionId, totalGranted: amount },
      update: { totalGranted: { increment: amount } },
    });
  }

  await logAdminAction(params.adminUserId, params.scope, "grant", amount, targets, competitionId);
  return { ok: true, affected: targets.length, amount };
}

/**
 * Remove only the unused (available, not yet committed) Power Pick rights.
 * Locked historical picks and active selections on unlocked matches are preserved.
 */
export async function removeUnusedPowerPick(params: {
  adminUserId: string;
  scope: PowerPickAdminScope;
  userIds?: string[];
  competitionId?: string;
}): Promise<{ ok: true; affected: number } | { ok: false; error: string }> {
  const competitionId = params.competitionId ?? POWER_PICK_COMPETITION_ID;
  const now = new Date();
  const targets = await resolveTargetUserIds(params.scope, params.userIds);
  if (targets.length === 0) return { ok: false, error: "No eligible users selected." };

  const committed = await committedByUser(targets, competitionId, now);
  const balances = await prisma.userPowerPickBalance.findMany({
    where: { userId: { in: targets }, competitionId },
    select: { userId: true, totalGranted: true },
  });
  const balanceByUser = new Map(balances.map((b) => [b.userId, b.totalGranted]));

  let affected = 0;
  for (const userId of targets) {
    const totalGranted = balanceByUser.get(userId);
    if (totalGranted == null) continue;
    const c = committed.get(userId) ?? { locked: 0, activeUnlocked: 0 };
    const keep = c.locked + c.activeUnlocked; // never strip committed rights
    if (totalGranted <= keep) continue;
    await prisma.userPowerPickBalance.update({
      where: { userId_competitionId: { userId, competitionId } },
      data: { totalGranted: keep },
    });
    affected += 1;
  }

  await logAdminAction(params.adminUserId, params.scope, "remove_unused", 0, targets, competitionId);
  return { ok: true, affected };
}

/**
 * Dangerous: revoke all active (unlocked) selections and zero out granted rights.
 * Locked historical picks are kept so past scoring stays intact.
 */
export async function forceRemovePowerPick(params: {
  adminUserId: string;
  scope: PowerPickAdminScope;
  userIds?: string[];
  competitionId?: string;
}): Promise<{ ok: true; affected: number } | { ok: false; error: string }> {
  const competitionId = params.competitionId ?? POWER_PICK_COMPETITION_ID;
  const now = new Date();
  const targets = await resolveTargetUserIds(params.scope, params.userIds);
  if (targets.length === 0) return { ok: false, error: "No eligible users selected." };

  await prisma.powerPickSelection.updateMany({
    where: { userId: { in: targets }, competitionId, status: "active" },
    data: { status: "revoked", revokedAt: now },
  });

  // Preserve already-locked (historical) rights only.
  const committed = await committedByUser(targets, competitionId, now);
  for (const userId of targets) {
    const c = committed.get(userId) ?? { locked: 0, activeUnlocked: 0 };
    await prisma.userPowerPickBalance.upsert({
      where: { userId_competitionId: { userId, competitionId } },
      create: { userId, competitionId, totalGranted: c.locked },
      update: { totalGranted: c.locked },
    });
  }

  await logAdminAction(params.adminUserId, params.scope, "force_remove", 0, targets, competitionId);
  return { ok: true, affected: targets.length };
}

/** Admin overview: every approved player with their derived Power Pick counts, plus recent logs. */
export async function getPowerPickAdminOverview(
  competitionId: string = POWER_PICK_COMPETITION_ID
): Promise<{ users: PowerPickAdminUserRow[]; logs: PowerPickAdminLogRow[] }> {
  const now = new Date();
  const users = await prisma.user.findMany({
    where: { status: "approved", role: { not: "admin" } },
    orderBy: [{ name: "asc" }, { surname: "asc" }],
    select: { id: true, name: true, surname: true, username: true },
  });
  const userIds = users.map((u) => u.id);

  const [balances, committed, logs, admins] = await Promise.all([
    prisma.userPowerPickBalance.findMany({
      where: { userId: { in: userIds }, competitionId },
      select: { userId: true, totalGranted: true, updatedAt: true },
    }),
    committedByUser(userIds, competitionId, now),
    prisma.adminPowerPickGrantLog.findMany({
      where: { competitionId },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    prisma.user.findMany({
      where: { role: "admin" },
      select: { id: true, name: true, surname: true },
    }),
  ]);

  const balanceByUser = new Map(balances.map((b) => [b.userId, b]));
  const adminNameById = new Map(admins.map((a) => [a.id, `${a.name} ${a.surname}`]));

  const userRows: PowerPickAdminUserRow[] = users.map((u) => {
    const balance = balanceByUser.get(u.id);
    const totalGranted = balance?.totalGranted ?? 0;
    const c = committed.get(u.id) ?? { locked: 0, activeUnlocked: 0 };
    const remainingAvailable = Math.max(0, totalGranted - c.locked - c.activeUnlocked);
    return {
      userId: u.id,
      name: u.name,
      surname: u.surname,
      username: u.username,
      totalGranted,
      usedLocked: c.locked,
      selectedUnlocked: c.activeUnlocked,
      remainingAvailable,
      updatedAt: balance?.updatedAt ? balance.updatedAt.toISOString() : null,
    };
  });

  const logRows: PowerPickAdminLogRow[] = logs.map((l) => ({
    id: l.id,
    adminUserId: l.adminUserId,
    adminName: adminNameById.get(l.adminUserId) ?? null,
    targetScope: l.targetScope as PowerPickAdminScope,
    actionType: l.actionType as PowerPickAdminAction,
    amountGranted: l.amountGranted,
    affectedUsers: l.affectedUsers,
    createdAt: l.createdAt.toISOString(),
  }));

  return { users: userRows, logs: logRows };
}
