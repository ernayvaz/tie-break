/**
 * One-off: refund Power Pick x3 rights that were wasted on draft (unfinalized)
 * predictions. A selection that reached lock time while its prediction was never
 * finalized should not have consumed a right. We revoke those selections so the
 * right returns to the user's balance (totalGranted is left untouched).
 *
 * Dry-run by default. Pass --apply to write changes.
 */
import { prisma } from "../src/lib/db";

const APPLY = process.argv.includes("--apply");

async function main() {
  const now = new Date();

  // Non-revoked selections that have reached lock time.
  const selections = await prisma.powerPickSelection.findMany({
    where: {
      status: { not: "revoked" },
      OR: [
        { status: "locked" },
        { match: { isLocked: true } },
        { match: { lockAt: { lte: now } } },
      ],
    },
    select: {
      id: true,
      userId: true,
      matchId: true,
      status: true,
      match: { select: { lockAt: true, isLocked: true, homeTeamName: true, awayTeamName: true } },
      user: { select: { name: true, surname: true, username: true } },
    },
  });

  if (selections.length === 0) {
    console.log("No locked/past-lock selections found.");
    return;
  }

  const userIds = [...new Set(selections.map((s) => s.userId))];
  const matchIds = [...new Set(selections.map((s) => s.matchId))];
  const finalized = await prisma.prediction.findMany({
    where: { userId: { in: userIds }, matchId: { in: matchIds }, isFinal: true },
    select: { userId: true, matchId: true },
  });
  const finalizedKeys = new Set(finalized.map((p) => `${p.userId}__${p.matchId}`));

  const toRefund = selections.filter(
    (s) => !finalizedKeys.has(`${s.userId}__${s.matchId}`)
  );

  console.log(`Locked/past-lock selections: ${selections.length}`);
  console.log(`Wasted on draft (to refund): ${toRefund.length}`);
  const perUser = new Map<string, number>();
  for (const s of toRefund) {
    perUser.set(s.userId, (perUser.get(s.userId) ?? 0) + 1);
    console.log(
      `  ${s.user.name} ${s.user.surname} (@${s.user.username}) — ${s.match.homeTeamName} vs ${s.match.awayTeamName} [status=${s.status}]`
    );
  }
  console.log(`Affected users: ${perUser.size}`);

  if (!APPLY) {
    console.log("\nDRY-RUN. Re-run with --apply to revoke and refund.");
    return;
  }

  if (toRefund.length > 0) {
    await prisma.powerPickSelection.updateMany({
      where: { id: { in: toRefund.map((s) => s.id) } },
      data: { status: "revoked", revokedAt: now },
    });
  }
  console.log(`\nApplied: refunded ${toRefund.length} right(s) to ${perUser.size} user(s).`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(String(e).slice(0, 250));
    await prisma.$disconnect();
    process.exit(1);
  });
