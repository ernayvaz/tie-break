import { prisma } from "@/lib/db";
import {
  POWER_PICK_PACKAGE_SIZE,
  POWER_PICK_COMPETITION_ID,
  POWER_PICK_MAX_PER_USER,
  normalizePowerPickMultiplier,
  POWER_PICK_POINTS,
  type PowerPickMultiplier,
} from "@/lib/config";

export type PowerPickAdminScope = "all_users" | "selected_users";
export type PowerPickAdminAction =
  | "grant"
  | "remove_unused"
  | "force_remove"
  | "reset_next_round";

export type PowerPickAdminUserRow = {
  userId: string;
  name: string;
  surname: string;
  username: string;
  totalGranted: number;
  multiplier: PowerPickMultiplier;
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
  multiplier: PowerPickMultiplier;
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
      matchId: true,
      status: true,
      match: { select: { lockAt: true, isLocked: true } },
    },
  });
  if (selections.length === 0) return result;

  // A right is only consumed when its prediction was finalized. A selection that
  // locked while still a draft returns its right (it never committed the pick).
  const selUserIds = [...new Set(selections.map((s) => s.userId))];
  const selMatchIds = [...new Set(selections.map((s) => s.matchId))];
  const finalized = await prisma.prediction.findMany({
    where: { userId: { in: selUserIds }, matchId: { in: selMatchIds }, isFinal: true },
    select: { userId: true, matchId: true },
  });
  const finalizedKeys = new Set(finalized.map((p) => `${p.userId}__${p.matchId}`));

  for (const sel of selections) {
    const entry = result.get(sel.userId) ?? { locked: 0, activeUnlocked: 0 };
    const locked =
      sel.status === "locked" || sel.match.isLocked || now >= sel.match.lockAt;
    if (locked) {
      // Draft prediction at lock → right returned, not counted as used.
      if (!finalizedKeys.has(`${sel.userId}__${sel.matchId}`)) continue;
      entry.locked += 1;
    } else {
      entry.activeUnlocked += 1;
    }
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
  multiplier: PowerPickMultiplier,
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
      multiplier,
      actionType,
      affectedUsers: affectedUserIds.length,
    },
  });
}

/**
 * Grant Power Pick x3 rights to the target users, adding to any existing balance.
 * The requested amount is clamped to 1..POWER_PICK_MAX_PER_USER, and no user is
 * ever pushed above POWER_PICK_MAX_PER_USER total (extra is dropped per user).
 */
export async function grantPowerPick(params: {
  adminUserId: string;
  scope: PowerPickAdminScope;
  userIds?: string[];
  amount?: number;
  multiplier?: number;
  competitionId?: string;
}): Promise<
  | { ok: true; affected: number; amount: number; skippedAtMax: number }
  | { ok: false; error: string }
> {
  const competitionId = params.competitionId ?? POWER_PICK_COMPETITION_ID;
  const amount = Math.min(
    POWER_PICK_MAX_PER_USER,
    Math.max(1, Math.floor(params.amount ?? POWER_PICK_PACKAGE_SIZE))
  );
  const multiplier = normalizePowerPickMultiplier(params.multiplier ?? POWER_PICK_POINTS);
  const targets = await resolveTargetUserIds(params.scope, params.userIds);
  if (targets.length === 0) return { ok: false, error: "No eligible users selected." };

  const existing = await prisma.userPowerPickBalance.findMany({
    where: { userId: { in: targets }, competitionId },
    select: { userId: true, totalGranted: true },
  });
  const grantedByUser = new Map(existing.map((b) => [b.userId, b.totalGranted]));

  let affected = 0;
  let skippedAtMax = 0;
  for (const userId of targets) {
    const current = grantedByUser.get(userId) ?? 0;
    const newTotal = Math.min(POWER_PICK_MAX_PER_USER, current + amount);
    if (newTotal <= current) {
      skippedAtMax += 1;
      continue;
    }
    await prisma.userPowerPickBalance.upsert({
      where: { userId_competitionId: { userId, competitionId } },
      create: { userId, competitionId, totalGranted: newTotal, multiplier },
      update: { totalGranted: newTotal, multiplier },
    });
    affected += 1;
  }

  await logAdminAction(
    params.adminUserId,
    params.scope,
    "grant",
    amount,
    multiplier,
    targets,
    competitionId
  );
  return { ok: true, affected, amount, skippedAtMax };
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

  await logAdminAction(
    params.adminUserId,
    params.scope,
    "remove_unused",
    0,
    POWER_PICK_POINTS,
    targets,
    competitionId
  );
  return { ok: true, affected };
}

/**
 * Round transition helper: clear every user's leftover (unused) rights and top
 * their available balance back up to exactly `amount` fresh rights for the next
 * round — in a single step.
 *
 * Committed rights are always preserved: locked historical picks (used in past
 * rounds, keeps scoring intact) and active selections already armed on still
 * unlocked matches. Only the truly unused/available leftover from the previous
 * round is dropped before the new allowance is set, so each user ends up with
 * precisely `amount` available rights regardless of how many they hoarded.
 *
 * Unlike {@link grantPowerPick} this is NOT additive and does not apply the
 * lifetime cap to the cumulative `totalGranted` counter — it targets the
 * *available* balance so admins can keep handing out a fresh allowance every
 * round throughout the tournament. The chosen `amount` is still clamped to
 * 1..POWER_PICK_MAX_PER_USER so no user holds more than the per-user maximum at
 * once.
 */
export async function resetForNextRound(params: {
  adminUserId: string;
  scope: PowerPickAdminScope;
  userIds?: string[];
  amount?: number;
  multiplier?: number;
  competitionId?: string;
}): Promise<
  | { ok: true; affected: number; amount: number }
  | { ok: false; error: string }
> {
  const competitionId = params.competitionId ?? POWER_PICK_COMPETITION_ID;
  const amount = Math.min(
    POWER_PICK_MAX_PER_USER,
    Math.max(1, Math.floor(params.amount ?? POWER_PICK_PACKAGE_SIZE))
  );
  const multiplier = normalizePowerPickMultiplier(params.multiplier ?? POWER_PICK_POINTS);
  const now = new Date();
  const targets = await resolveTargetUserIds(params.scope, params.userIds);
  if (targets.length === 0) return { ok: false, error: "No eligible users selected." };

  const committed = await committedByUser(targets, competitionId, now);

  let affected = 0;
  for (const userId of targets) {
    const c = committed.get(userId) ?? { locked: 0, activeUnlocked: 0 };
    // Keep committed rights, then set the available balance to exactly `amount`:
    // available = totalGranted - locked - activeUnlocked, so totalGranted must be
    // (locked + activeUnlocked) + amount.
    const newTotal = c.locked + c.activeUnlocked + amount;
    await prisma.userPowerPickBalance.upsert({
      where: { userId_competitionId: { userId, competitionId } },
      create: { userId, competitionId, totalGranted: newTotal, multiplier },
      update: { totalGranted: newTotal, multiplier },
    });
    affected += 1;
  }

  await logAdminAction(
    params.adminUserId,
    params.scope,
    "reset_next_round",
    amount,
    multiplier,
    targets,
    competitionId
  );
  return { ok: true, affected, amount };
}

/**
 * Reclaim a specific number of a single user's *unused* Power Pick rights.
 *
 * Only the available (unused) balance can ever be pulled back: rights already
 * committed to a match — locked historical picks and active selections armed on
 * still-unlocked matches — are always preserved. The reclaimed amount is clamped
 * to the currently available pool, so it can never touch a right the user has
 * actually spent or armed. This is the per-user counterpart the admin uses after
 * removing a Power Pick from a match to also drop the freed-up right from the
 * user's balance.
 */
export async function reclaimUnusedPowerPick(params: {
  adminUserId: string;
  userId: string;
  amount?: number;
  competitionId?: string;
}): Promise<
  | { ok: true; reclaimed: number; totalGranted: number; remainingAvailable: number }
  | { ok: false; error: string }
> {
  const competitionId = params.competitionId ?? POWER_PICK_COMPETITION_ID;
  const now = new Date();
  const amount = Math.max(1, Math.floor(params.amount ?? 1));

  const balance = await prisma.userPowerPickBalance.findUnique({
    where: { userId_competitionId: { userId: params.userId, competitionId } },
    select: { totalGranted: true },
  });
  if (!balance) return { ok: false, error: "User has no Power Pick balance yet." };

  const committed = await committedByUser([params.userId], competitionId, now);
  const c = committed.get(params.userId) ?? { locked: 0, activeUnlocked: 0 };
  const keep = c.locked + c.activeUnlocked; // never strip committed rights
  const available = Math.max(0, balance.totalGranted - keep);
  const reclaimed = Math.min(amount, available);
  if (reclaimed <= 0) {
    return { ok: false, error: "No unused rights available to reclaim." };
  }

  const newTotal = balance.totalGranted - reclaimed;
  await prisma.userPowerPickBalance.update({
    where: { userId_competitionId: { userId: params.userId, competitionId } },
    data: { totalGranted: newTotal },
  });

  await logAdminAction(
    params.adminUserId,
    "selected_users",
    "remove_unused",
    reclaimed,
    POWER_PICK_POINTS,
    [params.userId],
    competitionId
  );
  return {
    ok: true,
    reclaimed,
    totalGranted: newTotal,
    remainingAvailable: Math.max(0, newTotal - keep),
  };
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
      create: { userId, competitionId, totalGranted: c.locked, multiplier: POWER_PICK_POINTS },
      update: { totalGranted: c.locked, multiplier: POWER_PICK_POINTS },
    });
  }

  await logAdminAction(
    params.adminUserId,
    params.scope,
    "force_remove",
    0,
    POWER_PICK_POINTS,
    targets,
    competitionId
  );
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
      select: { userId: true, totalGranted: true, multiplier: true, updatedAt: true },
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
      multiplier: normalizePowerPickMultiplier(balance?.multiplier ?? POWER_PICK_POINTS),
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
    multiplier: normalizePowerPickMultiplier(l.multiplier ?? POWER_PICK_POINTS),
    affectedUsers: l.affectedUsers,
    createdAt: l.createdAt.toISOString(),
  }));

  return { users: userRows, logs: logRows };
}
