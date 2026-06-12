"use server";

import { requireAdmin } from "@/lib/auth/get-user";
import { revalidatePath } from "next/cache";
import {
  grantPowerPick,
  removeUnusedPowerPick,
  forceRemovePowerPick,
  type PowerPickAdminScope,
} from "@/lib/power-pick-admin";
import { POWER_PICK_PACKAGE_SIZE } from "@/lib/config";

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
  amount: number = POWER_PICK_PACKAGE_SIZE
): Promise<PowerPickAdminActionState> {
  const admin = await requireAdmin();
  const result = await grantPowerPick({
    adminUserId: admin.id,
    scope,
    userIds,
    amount,
  });
  if (!result.ok) return result;
  revalidate();
  return {
    ok: true,
    message: `Granted ${result.amount} Power Pick x3 right(s) to ${result.affected} user(s).`,
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
    message: `Removed unused Power Pick x3 rights from ${result.affected} user(s).`,
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
    message: `Force-removed Power Pick x3 rights and active selections from ${result.affected} user(s).`,
  };
}
