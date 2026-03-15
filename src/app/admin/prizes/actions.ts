"use server";

import { prisma } from "@/lib/db";
import { createAdminLog } from "@/lib/admin-log";
import { requireAdmin } from "@/lib/auth/get-user";
import { revalidatePath } from "next/cache";

export type PrizeActionState = { ok: true; message?: string } | { ok: false; error: string };

const LEAGUE_IDS = ["CL", "OTHER"] as const;

export async function createPrizeAction(data: {
  competitionId: string;
  place: number;
  title: string;
  description?: string | null;
}): Promise<PrizeActionState> {
  const admin = await requireAdmin();
  const competitionId = LEAGUE_IDS.includes(data.competitionId as (typeof LEAGUE_IDS)[number])
    ? data.competitionId
    : "CL";
  const place = Math.floor(Number(data.place));
  const title = data.title?.trim();
  if (!title || place < 1) return { ok: false, error: "Place (≥1) and title are required." };

  const existing = await prisma.prize.findUnique({
    where: { competitionId_place: { competitionId, place } },
  });
  if (existing) return { ok: false, error: `Place ${place} already exists for this league.` };

  const prize = await prisma.prize.create({
    data: {
      competitionId,
      place,
      title,
      description: data.description?.trim() || null,
    },
  });
  await createAdminLog(admin.id, "prize_created", "prize", prize.id, null, `${competitionId} #${place} ${title}`);
  revalidatePath("/admin/prizes");
  revalidatePath("/leaderboard");
  revalidatePath("/rules");
  return { ok: true, message: "Prize created." };
}

export async function updatePrizeAction(
  prizeId: string,
  data: { title?: string; description?: string | null }
): Promise<PrizeActionState> {
  const admin = await requireAdmin();
  const prize = await prisma.prize.findUnique({ where: { id: prizeId } });
  if (!prize) return { ok: false, error: "Prize not found." };

  const title = data.title?.trim();
  const description = data.description?.trim() || null;
  const oldVal = `${prize.title}${prize.description ? ` | ${prize.description}` : ""}`;
  const newVal = `${title ?? prize.title}${description != null ? ` | ${description}` : prize.description ? ` | ${description}` : ""}`;

  await prisma.prize.update({
    where: { id: prizeId },
    data: title != null ? { title, description } : { description },
  });
  await createAdminLog(admin.id, "prize_updated", "prize", prizeId, oldVal, newVal);
  revalidatePath("/admin/prizes");
  revalidatePath("/leaderboard");
  revalidatePath("/rules");
  return { ok: true, message: "Prize updated." };
}

export async function deletePrizeAction(prizeId: string): Promise<PrizeActionState> {
  const admin = await requireAdmin();
  const prize = await prisma.prize.findUnique({ where: { id: prizeId } });
  if (!prize) return { ok: false, error: "Prize not found." };

  await prisma.prize.delete({ where: { id: prizeId } });
  await createAdminLog(admin.id, "prize_deleted", "prize", prizeId, `${prize.competitionId} #${prize.place} ${prize.title}`, null);
  revalidatePath("/admin/prizes");
  revalidatePath("/leaderboard");
  revalidatePath("/rules");
  return { ok: true, message: "Prize deleted." };
}
