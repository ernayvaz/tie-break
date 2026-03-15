import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/get-user";
import { UserManagementClient } from "./user-management-client";
import type { UserRow } from "./user-management-client";

export default async function AdminUsersPage() {
  const admin = await requireAdmin();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      surname: true,
      username: true,
      status: true,
      role: true,
      createdAt: true,
      approvedAt: true,
      approver: {
        select: { name: true, surname: true },
      },
    },
  });

  const rows: UserRow[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    surname: u.surname,
    username: u.username,
    status: u.status,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
    approvedAt: u.approvedAt?.toISOString() ?? null,
    approvedByName: u.approver ? `${u.approver.name} ${u.approver.surname}` : null,
  }));

  return (
    <div>
      <h1 className="text-xl font-semibold text-nord-polar">User Management</h1>
      <p className="mt-2 text-sm text-nord-polarLight">
        Approve or reject pending registrations, block or unblock users, edit usernames, and reset PINs. Only approved users can log in.
      </p>
      <UserManagementClient users={rows} adminUserId={admin.id} />
    </div>
  );
}
