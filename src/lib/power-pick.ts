import { prisma } from "@/lib/db";
import {
  POWER_PICK_POINTS,
  POWER_PICK_COMPETITION_ID,
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
  /** The match has passed its lock time, so the toggle can no longer change. */
  isLocked: boolean;
};

/** Aggregated Power Pick balance for a user in a competition. */
export type PowerPickBalanceSummary = {
  competitionId: string;
  totalGranted: number;
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
 * Points a finalized prediction earns. Power Pick correct = exactly 3 (never 1 + 3).
 */
export function pointsForPrediction(isCorrect: boolean, isPowerPick: boolean): number {
  if (!isCorrect) return 0;
  return isPowerPick ? POWER_PICK_POINTS : POINTS_NORMAL_CORRECT;
}

/** A match is locked for Power Pick purposes once its lock time has passed. */
function isMatchLocked(match: { lockAt: Date; isLocked: boolean }, now: Date): boolean {
  return match.isLocked || now >= match.lockAt;
}

function summarize(
  competitionId: string,
  totalGranted: number,
  usedLocked: number,
  selectedUnlocked: number
): PowerPickBalanceSummary {
  return {
    competitionId,
    totalGranted,
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
      select: { totalGranted: true },
    }),
    prisma.powerPickSelection.findMany({
      where: { userId, competitionId, status: { not: "revoked" } },
      select: {
        matchId: true,
        status: true,
        match: { select: { lockAt: true, isLocked: true } },
      },
    }),
  ]);

  const totalGranted = balance?.totalGranted ?? 0;
  let usedLocked = 0;
  let selectedUnlocked = 0;
  const byMatchId: Record<string, PowerPickMatchState> = {};

  for (const sel of selections) {
    const locked = sel.status === "locked" || isMatchLocked(sel.match, now);
    if (locked) usedLocked += 1;
    else selectedUnlocked += 1;
    byMatchId[sel.matchId] = { matchId: sel.matchId, isOn: true, isLocked: locked };
  }

  return {
    balance: summarize(competitionId, totalGranted, usedLocked, selectedUnlocked),
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
  options?: { isAdmin?: boolean }
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
    if (!alreadyActive) {
      const prediction = await prisma.prediction.findUnique({
        where: { userId_matchId: { userId, matchId } },
        select: { id: true },
      });
      if (!prediction) return { ok: false, error: "no_prediction" };

      const state = await getUserPowerPickState(userId, competitionId, now);
      if (state.balance.remainingAvailable <= 0) {
        return { ok: false, error: "no_rights_remaining" };
      }

      await prisma.powerPickSelection.upsert({
        where: { userId_matchId: { userId, matchId } },
        create: {
          userId,
          matchId,
          competitionId,
          status: "active",
          selectedAt: now,
        },
        update: { status: "active", revokedAt: null, selectedAt: now },
      });
    }
  } else {
    if (existing && existing.status === "active") {
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
 * Persist the lock transition (active → locked) for a match's Power Pick selections.
 * Idempotent; safe to call from scoring / sync once a match has locked.
 */
export async function lockPowerPickSelectionsForMatch(matchId: string): Promise<void> {
  const now = new Date();
  await prisma.powerPickSelection.updateMany({
    where: { matchId, status: "active" },
    data: { status: "locked", lockedAt: now },
  });
}

/**
 * Map of matchId → userId set that has an effective (non-revoked) Power Pick on that match.
 * Used by scoring to award 3 points instead of 1.
 */
export async function getPowerPickUserIdsByMatch(
  matchIds: string[]
): Promise<Map<string, Set<string>>> {
  const result = new Map<string, Set<string>>();
  if (matchIds.length === 0) return result;
  const selections = await prisma.powerPickSelection.findMany({
    where: { matchId: { in: matchIds }, status: { not: "revoked" } },
    select: { matchId: true, userId: true },
  });
  for (const sel of selections) {
    let set = result.get(sel.matchId);
    if (!set) {
      set = new Set<string>();
      result.set(sel.matchId, set);
    }
    set.add(sel.userId);
  }
  return result;
}

/** Whether a stored selection status should be treated as boosting a prediction. */
export function isBoostingStatus(status: PowerPickStatus): boolean {
  return status !== "revoked";
}
