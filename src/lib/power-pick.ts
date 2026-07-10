import { prisma } from "@/lib/db";
import {
  normalizePowerPickMultiplier,
  POWER_PICK_COMPETITION_ID,
  POWER_PICK_POINTS,
  type PowerPickMultiplier,
} from "@/lib/config";
import type { PowerPickStatus } from "@prisma/client";

export type PowerPickError =
  | "match_not_found"
  | "match_locked"
  | "no_prediction"
  | "no_rights_remaining"
  | "not_available";

/** Effective per-match Power Pick state for a user. */
export type PowerPickMatchState = {
  matchId: string;
  /** Stored intent: the user has this match marked as a Power Pick. */
  isOn: boolean;
  /** Points awarded for a correct boosted pick on this match. */
  multiplier: PowerPickMultiplier;
  /** The match has passed its lock time, so the toggle can no longer change. */
  isLocked: boolean;
};

/** Aggregated Power Pick balance for a user in a competition. */
export type PowerPickBalanceSummary = {
  competitionId: string;
  totalGranted: number;
  /** Multiplier assigned to currently available rights. Existing match selections keep their own multiplier. */
  multiplier: PowerPickMultiplier;
  /** Rights consumed by matches that already locked with the booster ON. */
  usedLocked: number;
  /** Rights currently committed to unlocked matches (can still be freed up). */
  selectedUnlocked: number;
  /** Rights still free to assign to a new match. */
  remainingAvailable: number;
};

export type PowerPickUserState = {
  balance: PowerPickBalanceSummary;
  byMatchId: Record<string, PowerPickMatchState>;
};

const POINTS_NORMAL_CORRECT = 1;

/**
 * Points a finalized prediction earns.
 *
 * - Incorrect → 0.
 * - Boosted correct → exactly the Power Pick multiplier value (e.g. x5 → 5),
 *   regardless of `basePoints`. The multiplier replaces the base; it never stacks.
 * - Non-boosted correct → `basePoints` (1 for a 1/2 winner pick, 2 for BTTS).
 */
export function pointsForPrediction(
  isCorrect: boolean,
  powerPickMultiplier: number | boolean | null | undefined,
  basePoints: number = POINTS_NORMAL_CORRECT
): number {
  if (!isCorrect) return 0;
  if (powerPickMultiplier === true) return POWER_PICK_POINTS;
  if (typeof powerPickMultiplier === "number") {
    return normalizePowerPickMultiplier(powerPickMultiplier);
  }
  return basePoints;
}

/** A match is locked for Power Pick purposes once its lock time has passed. */
function isMatchLocked(match: { lockAt: Date; isLocked: boolean }, now: Date): boolean {
  return match.isLocked || now >= match.lockAt;
}

function summarize(
  competitionId: string,
  totalGranted: number,
  multiplier: PowerPickMultiplier,
  usedLocked: number,
  selectedUnlocked: number
): PowerPickBalanceSummary {
  return {
    competitionId,
    totalGranted,
    multiplier,
    usedLocked,
    selectedUnlocked,
    remainingAvailable: Math.max(0, totalGranted - usedLocked - selectedUnlocked),
  };
}

/**
 * Resolve a user's full Power Pick state for a competition: their granted balance plus
 * an effective per-match map. Counts are derived from selection rows so they cannot drift.
 */
export async function getUserPowerPickState(
  userId: string,
  competitionId: string = POWER_PICK_COMPETITION_ID,
  now: Date = new Date()
): Promise<PowerPickUserState> {
  const [balance, selections] = await Promise.all([
    prisma.userPowerPickBalance.findUnique({
      where: { userId_competitionId: { userId, competitionId } },
      select: { totalGranted: true, multiplier: true },
    }),
    prisma.powerPickSelection.findMany({
      where: { userId, competitionId, status: { not: "revoked" } },
      select: {
        matchId: true,
        multiplier: true,
        status: true,
        match: { select: { lockAt: true, isLocked: true } },
      },
    }),
  ]);

  const totalGranted = balance?.totalGranted ?? 0;
  const balanceMultiplier = normalizePowerPickMultiplier(balance?.multiplier ?? POWER_PICK_POINTS);

  // Only a finalized prediction truly consumes a right. A selection that reaches
  // lock time while its prediction is still a draft never committed the pick, so
  // its right is returned (not counted as used). Unlocked selections still reserve
  // a right so the per-user cap stays meaningful while the match is open.
  const selectionMatchIds = selections.map((s) => s.matchId);
  const finalizedMatchIds =
    selectionMatchIds.length > 0
      ? new Set(
          (
            await prisma.prediction.findMany({
              where: { userId, matchId: { in: selectionMatchIds }, isFinal: true },
              select: { matchId: true },
            })
          ).map((p) => p.matchId)
        )
      : new Set<string>();

  let usedLocked = 0;
  let selectedUnlocked = 0;
  const byMatchId: Record<string, PowerPickMatchState> = {};

  for (const sel of selections) {
    const locked = sel.status === "locked" || isMatchLocked(sel.match, now);
    if (locked) {
      // Draft prediction at lock → right returned; the pick is not active.
      if (!finalizedMatchIds.has(sel.matchId)) continue;
      usedLocked += 1;
    } else {
      selectedUnlocked += 1;
    }
    byMatchId[sel.matchId] = {
      matchId: sel.matchId,
      isOn: true,
      multiplier: normalizePowerPickMultiplier(sel.multiplier),
      isLocked: locked,
    };
  }

  return {
    balance: summarize(competitionId, totalGranted, balanceMultiplier, usedLocked, selectedUnlocked),
    byMatchId,
  };
}

/**
 * Turn the Power Pick booster on or off for a match. Backend validation is the source of truth.
 */
export async function setUserPowerPick(
  userId: string,
  matchId: string,
  on: boolean,
  options?: { isAdmin?: boolean; multiplier?: number }
): Promise<{ ok: true; state: PowerPickUserState } | { ok: false; error: PowerPickError }> {
  const now = new Date();
  const isAdmin = options?.isAdmin === true;

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { id: true, competitionId: true, lockAt: true, isLocked: true },
  });
  if (!match) return { ok: false, error: "match_not_found" };

  const competitionId = match.competitionId ?? POWER_PICK_COMPETITION_ID;
  const locked = isMatchLocked(match, now);
  if (locked && !isAdmin) return { ok: false, error: "match_locked" };

  const existing = await prisma.powerPickSelection.findUnique({
    where: { userId_matchId: { userId, matchId } },
    select: { id: true, status: true },
  });

  if (on) {
    // Already committed to this match → idempotent success.
    const alreadyActive = existing && existing.status !== "revoked";
    const state = await getUserPowerPickState(userId, competitionId, now);
    const multiplier = normalizePowerPickMultiplier(
      options?.isAdmin && options.multiplier ? options.multiplier : state.balance.multiplier
    );
    if (!alreadyActive) {
      const prediction = await prisma.prediction.findUnique({
        where: { userId_matchId: { userId, matchId } },
        select: { id: true },
      });
      if (!prediction) return { ok: false, error: "no_prediction" };

      if (!isAdmin && state.balance.remainingAvailable <= 0) {
        return { ok: false, error: "no_rights_remaining" };
      }

      await prisma.powerPickSelection.upsert({
        where: { userId_matchId: { userId, matchId } },
        create: {
          userId,
          matchId,
          competitionId,
          multiplier,
          status: "active",
          selectedAt: now,
        },
        update: { status: "active", multiplier, revokedAt: null, selectedAt: now },
      });
      if (isAdmin && state.balance.remainingAvailable <= 0) {
        const minimumTotal =
          state.balance.usedLocked + state.balance.selectedUnlocked + 1;
        if (state.balance.totalGranted < minimumTotal) {
          await prisma.userPowerPickBalance.upsert({
            where: { userId_competitionId: { userId, competitionId } },
            create: { userId, competitionId, totalGranted: minimumTotal, multiplier },
            update: { totalGranted: minimumTotal, multiplier },
          });
        }
      }
    } else if (isAdmin && options?.multiplier) {
      await prisma.powerPickSelection.update({
        where: { userId_matchId: { userId, matchId } },
        data: { multiplier },
      });
    }
  } else {
    if (existing && (existing.status === "active" || (isAdmin && existing.status !== "revoked"))) {
      await prisma.powerPickSelection.update({
        where: { id: existing.id },
        data: { status: "revoked", revokedAt: now },
      });
    }
  }

  const state = await getUserPowerPickState(userId, competitionId, now);
  return { ok: true, state };
}

/**
 * Persist the lock transition for a match's Power Pick selections once it locks.
 *
 * Only selections whose prediction was finalized consume the right (→ locked).
 * Selections still sitting on a draft prediction never committed the pick, so the
 * right is returned (→ revoked) instead of being wasted. Idempotent.
 */
export async function lockPowerPickSelectionsForMatch(matchId: string): Promise<void> {
  const now = new Date();
  const active = await prisma.powerPickSelection.findMany({
    where: { matchId, status: "active" },
    select: { userId: true },
  });
  if (active.length === 0) return;

  const userIds = active.map((a) => a.userId);
  const finalized = await prisma.prediction.findMany({
    where: { matchId, userId: { in: userIds }, isFinal: true },
    select: { userId: true },
  });
  const finalizedUserIds = new Set(finalized.map((p) => p.userId));
  const lockUserIds = userIds.filter((id) => finalizedUserIds.has(id));
  const revokeUserIds = userIds.filter((id) => !finalizedUserIds.has(id));

  if (lockUserIds.length > 0) {
    await prisma.powerPickSelection.updateMany({
      where: { matchId, status: "active", userId: { in: lockUserIds } },
      data: { status: "locked", lockedAt: now },
    });
  }
  if (revokeUserIds.length > 0) {
    await prisma.powerPickSelection.updateMany({
      where: { matchId, status: "active", userId: { in: revokeUserIds } },
      data: { status: "revoked", revokedAt: now },
    });
  }
}

/**
 * Map of matchId → userId set that has an effective (non-revoked) Power Pick on that match.
 * Used by scoring to award 3 points instead of 1.
 */
export async function getPowerPickMultipliersByMatch(
  matchIds: string[]
): Promise<Map<string, Map<string, PowerPickMultiplier>>> {
  const result = new Map<string, Map<string, PowerPickMultiplier>>();
  if (matchIds.length === 0) return result;
  const selections = await prisma.powerPickSelection.findMany({
    where: { matchId: { in: matchIds }, status: { not: "revoked" } },
    select: { matchId: true, userId: true, multiplier: true },
  });
  for (const sel of selections) {
    let map = result.get(sel.matchId);
    if (!map) {
      map = new Map<string, PowerPickMultiplier>();
      result.set(sel.matchId, map);
    }
    map.set(sel.userId, normalizePowerPickMultiplier(sel.multiplier));
  }
  return result;
}

/** Whether a stored selection status should be treated as boosting a prediction. */
export function isBoostingStatus(status: PowerPickStatus): boolean {
  return status !== "revoked";
}
