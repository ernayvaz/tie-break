import { getSession } from "./session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export type AuthUser = {
  id: string;
  name: string;
  surname: string;
  username: string;
  status: string;
  role: string;
};

/**
 * Get current user from session. Returns null if not logged in.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const session = await getSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      surname: true,
      username: true,
      status: true,
      role: true,
    },
  });

  if (!user) return null;
  return user as AuthUser;
}

/**
 * Require auth. Redirects to login if not logged in.
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Require admin role. Redirects to home if not admin.
 */
export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireAuth();
  if (user.role !== "admin") redirect("/");
  return user;
}
