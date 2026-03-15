import { prisma } from "@/lib/db";
import { InviteLinkList } from "./invite-link-list";

export default async function AdminInvitePage() {
  const links = await prisma.inviteLink.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";

  return (
    <div>
      <h1 className="text-xl font-semibold text-nord-polar">Invite link</h1>
      <p className="mt-1 text-sm text-nord-polarLight">
        Share the link below so people can register. One link can be used by many people until it expires or is disabled.
      </p>
      <InviteLinkList
        links={links.map((l) => ({
          id: l.id,
          token: l.token,
          fullUrl: `${baseUrl}/invite/${l.token}`,
          isActive: l.isActive,
          expiresAt: l.expiresAt?.toISOString() ?? null,
          createdAt: l.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
