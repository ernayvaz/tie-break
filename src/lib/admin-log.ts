import { prisma } from "@/lib/db";

/**
 * Record an admin action for audit trail.
 */
export async function createAdminLog(
  adminUserId: string,
  actionType: string,
  targetType: string,
  targetId: string,
  oldValue?: string | null,
  newValue?: string | null
): Promise<void> {
  await prisma.adminLog.create({
    data: {
      adminUserId,
      actionType,
      targetType,
      targetId,
      oldValue: oldValue ?? null,
      newValue: newValue ?? null,
    },
  });
}
