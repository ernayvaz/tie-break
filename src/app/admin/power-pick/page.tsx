import { requireAdmin } from "@/lib/auth/get-user";
import { getPowerPickAdminOverview } from "@/lib/power-pick-admin";
import { POWER_PICK_PACKAGE_SIZE, POWER_PICK_MAX_PER_USER } from "@/lib/config";
import { PowerPickAdminClient } from "./power-pick-admin-client";

export default async function AdminPowerPickPage() {
  await requireAdmin();

  const { users, logs } = await getPowerPickAdminOverview();

  return (
    <div>
      <h1 className="text-xl font-semibold text-nord-polar">Power Pick multipliers</h1>
      <p className="mt-2 max-w-3xl text-sm text-nord-polarLight">
        Manage World Cup Power Pick boosters. Each package grants{" "}
        <strong>{POWER_PICK_PACKAGE_SIZE}</strong> rights and can be assigned as x3, x4, x5,
        x6 or x10. Choose any amount up to{" "}
        <strong>{POWER_PICK_MAX_PER_USER}</strong> per user. Removing unused rights never touches
        locked historical picks; the force reset does and requires confirmation.
      </p>
      <PowerPickAdminClient
        users={users}
        logs={logs}
        packageSize={POWER_PICK_PACKAGE_SIZE}
        maxPerUser={POWER_PICK_MAX_PER_USER}
      />
    </div>
  );
}
