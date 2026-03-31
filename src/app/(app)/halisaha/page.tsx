import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/get-user";
import { canAccessHalisahaMode } from "@/lib/halisaha/public-access";
import { isLikelyHalisahaPhoneUserAgent } from "@/lib/halisaha/mobile-landscape";
import { HalisahaMatchShowcase } from "./halisaha-match-showcase";
import { getHalisahaPublicSnapshot } from "@/lib/halisaha/server";

export const metadata: Metadata = {
  title: "RayNET Matchday Show | Tie-Break",
};

export default async function HalisahaPage({
  searchParams,
}: {
  searchParams: Promise<{ postMatchVote?: string }>;
}) {
  const user = await requireAuth();
  if (!canAccessHalisahaMode(user.role)) {
    redirect("/schedule");
  }

  const params = await searchParams;
  const requestHeaders = await headers();
  const initialPhoneLikeViewport = isLikelyHalisahaPhoneUserAgent(
    requestHeaders.get("user-agent"),
  );

  const snapshot = await getHalisahaPublicSnapshot(user.id, user.role);

  return (
    <HalisahaMatchShowcase
      snapshot={snapshot}
      viewerCanManageOwnAnswerLock={user.role === "admin"}
      forcePostMatchMvpVote={params.postMatchVote === "1"}
      initialPhoneLikeViewport={initialPhoneLikeViewport}
    />
  );
}
