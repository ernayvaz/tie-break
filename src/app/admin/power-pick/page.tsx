import { requireAdmin } from "@/lib/auth/get-user";
import { getPowerPickAdminOverview } from "@/lib/power-pick-admin";
import { POWER_PICK_PACKAGE_SIZE, POWER_PICK_POINTS } from "@/lib/config";
import { PowerPickAdminClient } from "./power-pick-admin-client";

export default async function AdminPowerPickPage() {
  await requireAdmin();

  const { users, logs } = await getPowerPickAdminOverview();

  return (
    <div>
      <h1 className="text-xl font-semibold text-nord-polar">Power Pick x3</h1>
      <p className="mt-2 max-w-3xl text-sm text-nord-polarLight">
        Manage the World Cup Power Pick x3 booster. Each package grants{" "}
        <strong>{POWER_PICK_PACKAGE_SIZE}</strong> rights. A correct boosted prediction is worth{" "}
        <strong>{POWER_PICK_POINTS} points</strong> instead of 1. Removing unused rights never
        touches locked historical picks; the force reset does and requires confirmation.
      </p>
      <PowerPickAdminClient users={users} logs={logs} packageSize={POWER_PICK_PACKAGE_SIZE} />
    </div>
  );
}
