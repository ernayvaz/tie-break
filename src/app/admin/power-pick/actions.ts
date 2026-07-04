"use server";

import { requireAdmin } from "@/lib/auth/get-user";
import { revalidatePath } from "next/cache";
import {
  grantPowerPick,
  removeUnusedPowerPick,
  forceRemovePowerPick,
  resetForNextRound,
  removeActivePowerPickSelections,
  listUserPowerPickMatches,
  removeUserMatchPowerPick,
  type PowerPickAdminScope,
  type UserPowerPickMatchRow,
} from "@/lib/power-pick-admin";
import { rebuildLeaderboard, scoreMatch } from "@/lib/scoring";
import {
  POWER_PICK_PACKAGE_SIZE,
  POWER_PICK_MAX_PER_USER,
  POWER_PICK_POINTS,
  normalizePowerPickMultiplier,
} from "@/lib/config";

export type PowerPickAdminActionState =
  | { ok: true; message: string }
  | { ok: false; error: string };

function revalidate() {
  revalidatePath("/admin/power-pick");
  revalidatePath("/schedule");
  revalidatePath("/leaderboard");
}

export async function grantPowerPickAction(
  scope: PowerPickAdminScope,
  userIds: string[] = [],
  amount: number = POWER_PICK_PACKAGE_SIZE,
  multiplier: number = POWER_PICK_POINTS
): Promise<PowerPickAdminActionState> {
  const admin = await requireAdmin();
  const safeAmount = Math.min(
    POWER_PICK_MAX_PER_USER,
    Math.max(1, Math.floor(Number.isFinite(amount) ? amount : POWER_PICK_PACKAGE_SIZE))
  );
  const result = await grantPowerPick({
    adminUserId: admin.id,
    scope,
    userIds,
    amount: safeAmount,
    multiplier,
  });
  if (!result.ok) return result;
  revalidate();
  const skippedNote =
    result.skippedAtMax > 0
      ? ` ${result.skippedAtMax} user(s) already at the ${POWER_PICK_MAX_PER_USER} cap were skipped.`
      : "";
  const safeMultiplier = normalizePowerPickMultiplier(multiplier);
  return {
    ok: true,
    message: `Granted up to ${result.amount} Power Pick x${safeMultiplier} right(s) to ${result.affected} user(s) (max ${POWER_PICK_MAX_PER_USER} per user).${skippedNote}`,
  };
}

export async function removeUnusedPowerPickAction(
  scope: PowerPickAdminScope,
  userIds: string[] = []
): Promise<PowerPickAdminActionState> {
  const admin = await requireAdmin();
  const result = await removeUnusedPowerPick({
    adminUserId: admin.id,
    scope,
    userIds,
  });
  if (!result.ok) return result;
  revalidate();
  return {
    ok: true,
    message: `Removed unused Power Pick rights from ${result.affected} user(s).`,
  };
}

export async function resetForNextRoundPowerPickAction(
  scope: PowerPickAdminScope,
  userIds: string[] = [],
  amount: number = POWER_PICK_PACKAGE_SIZE,
  multiplier: number = POWER_PICK_POINTS
): Promise<PowerPickAdminActionState> {
  const admin = await requireAdmin();
  const safeAmount = Math.min(
    POWER_PICK_MAX_PER_USER,
    Math.max(1, Math.floor(Number.isFinite(amount) ? amount : POWER_PICK_PACKAGE_SIZE))
  );
  const result = await resetForNextRound({
    adminUserId: admin.id,
    scope,
    userIds,
    amount: safeAmount,
    multiplier,
  });
  if (!result.ok) return result;
  revalidate();
  const safeMultiplier = normalizePowerPickMultiplier(multiplier);
  return {
    ok: true,
    message: `Cleared unused rights and set ${result.amount} fresh Power Pick x${safeMultiplier} right(s) for the next round on ${result.affected} user(s).`,
  };
}

export async function forceRemovePowerPickAction(
  scope: PowerPickAdminScope,
  userIds: string[] = []
): Promise<PowerPickAdminActionState> {
  const admin = await requireAdmin();
  const result = await forceRemovePowerPick({
    adminUserId: admin.id,
    scope,
    userIds,
  });
  if (!result.ok) return result;
  revalidate();
  return {
    ok: true,
    message: `Force-removed Power Pick rights and active selections from ${result.affected} user(s).`,
  };
}

/**
 * Remove the in-use (armed, unlocked) Power Pick selections for all/selected users.
 * Freed rights return to each user's available pool; any completed match involved is
 * rescored and the leaderboard rebuilt.
 */
export async function removeActivePowerPickAction(
  scope: PowerPickAdminScope,
  userIds: string[] = []
): Promise<PowerPickAdminActionState> {
  const admin = await requireAdmin();
  const result = await removeActivePowerPickSelections({
    adminUserId: admin.id,
    scope,
    userIds,
  });
  if (!result.ok) return result;

  for (const matchId of result.matchIds) {
    await scoreMatch(matchId);
  }
  if (result.revokedCount > 0) await rebuildLeaderboard();

  revalidate();
  return {
    ok: true,
    message:
      result.revokedCount === 0
        ? "No in-use Power Picks to remove."
        : `Removed ${result.revokedCount} in-use Power Pick(s) from ${result.affectedUsers} user(s). Rights returned to their pool.`,
  };
}

export type UserPowerPickMatchesState =
  | { ok: true; matches: UserPowerPickMatchRow[] }
  | { ok: false; error: string };

/** Fetch one user's Power Pick matches for the expandable per-user row. */
export async function getUserPowerPickMatchesAction(
  userId: string
): Promise<UserPowerPickMatchesState> {
  await requireAdmin();
  if (!userId) return { ok: false, error: "Missing user." };
  const matches = await listUserPowerPickMatches(userId);
  return { ok: true, matches };
}

/**
 * Remove one user's Power Pick from a single match (fix a mistaken assignment).
 * Rescores the match if it was already completed and rebuilds the leaderboard.
 */
export async function removeUserMatchPowerPickAction(
  userId: string,
  matchId: string
): Promise<PowerPickAdminActionState> {
  const admin = await requireAdmin();
  const result = await removeUserMatchPowerPick({
    adminUserId: admin.id,
    userId,
    matchId,
  });
  if (!result.ok) return result;

  if (result.wasCompleted) await scoreMatch(matchId);
  await rebuildLeaderboard();

  revalidate();
  return {
    ok: true,
    message: "Power Pick removed from the match. Right returned to the user's pool.",
  };
}
