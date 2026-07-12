import { execSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient as SqlitePrismaClient } from "@/generated/prisma-sqlite";

const SQLITE_URL = "file:./prisma/sqlite/integration.sqlite";
const WC = "WC";

// Route the scoring/power-pick modules (which import the real Postgres client via
// "@/lib/db") at the SQLite integration client so we can exercise the real
// scoreMatch / rebuildLeaderboard pipeline end-to-end against a throwaway DB.
vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@/generated/prisma-sqlite");
  return { prisma: new PrismaClient() };
});

import { prisma } from "@/lib/db";
import {
  scoreMatch,
  rebuildLeaderboardForCompetition,
  getLeaderboardStatsForUser,
} from "@/lib/scoring";

const db = prisma as unknown as SqlitePrismaClient;

const TEST_PIN_HASH = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";
const PAST = new Date("2026-06-01T18:00:00.000Z");
const LOCK = new Date("2026-06-01T17:55:00.000Z");

let userSeq = 0;

async function makeUser(role: "user" | "admin" = "user") {
  userSeq += 1;
  return db.user.create({
    data: {
      name: `User${userSeq}`,
      surname: "Test",
      username: `user_${userSeq}`,
      pinHash: TEST_PIN_HASH,
      status: "approved",
      role,
    },
  });
}

async function makeFinishedMatch(opts: {
  officialResultType: "ONE" | "X" | "TWO";
  homeScore: number | null;
  awayScore: number | null;
  stage?: string;
}) {
  return db.match.create({
    data: {
      competitionId: WC,
      stage: opts.stage ?? "GROUP_STAGE",
      matchDatetime: PAST,
      homeTeamName: "Home",
      awayTeamName: "Away",
      lockAt: LOCK,
      isLocked: true,
      officialResultType: opts.officialResultType,
      homeScore: opts.homeScore,
      awayScore: opts.awayScore,
    },
  });
}

async function makePrediction(
  userId: string,
  matchId: string,
  selectedPrediction: string,
  isFinal = true
) {
  return db.prediction.create({
    data: {
      userId,
      matchId,
      selectedPrediction: selectedPrediction as never,
      isFinal,
      finalizedAt: isFinal ? LOCK : null,
    },
  });
}

async function armPowerPick(userId: string, matchId: string, multiplier: number) {
  await db.userPowerPickBalance.upsert({
    where: { userId_competitionId: { userId, competitionId: WC } },
    create: { userId, competitionId: WC, totalGranted: 1, multiplier },
    update: { totalGranted: 1, multiplier },
  });
  await db.powerPickSelection.create({
    data: {
      userId,
      matchId,
      competitionId: WC,
      multiplier,
      status: "active",
      selectedAt: LOCK,
    },
  });
}

async function pointsFor(userId: string, matchId: string): Promise<number> {
  const row = await db.prediction.findUnique({
    where: { userId_matchId: { userId, matchId } },
    select: { awardedPoints: true },
  });
  return row?.awardedPoints ?? -1;
}

describe("BTTS + winner scoring (SQLite integration)", () => {
  beforeAll(() => {
    process.env.SQLITE_TEST_DATABASE_URL = SQLITE_URL;
    execSync(
      "npx prisma db push --schema=prisma/sqlite/schema.prisma --accept-data-loss --skip-generate",
      {
        env: { ...process.env, SQLITE_TEST_DATABASE_URL: SQLITE_URL },
        stdio: "inherit",
        cwd: process.cwd(),
      }
    );
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  beforeEach(async () => {
    await db.leaderboardEntry.deleteMany();
    await db.powerPickSelection.deleteMany();
    await db.userPowerPickBalance.deleteMany();
    await db.prediction.deleteMany();
    await db.match.deleteMany();
    await db.user.deleteMany();
  });

  it("scores 1/2 from the winner and BTTS from the goal line, excluding the shootout", async () => {
    // Away won (e.g. on penalties) but both teams scored 1-1 in the goal line.
    const match = await makeFinishedMatch({
      officialResultType: "TWO",
      homeScore: 1,
      awayScore: 1,
    });

    const uTwo = await makeUser();
    const uOne = await makeUser();
    const uBttsYes = await makeUser();
    const uBttsNo = await makeUser();

    await makePrediction(uTwo.id, match.id, "TWO");
    await makePrediction(uOne.id, match.id, "ONE");
    await makePrediction(uBttsYes.id, match.id, "BTTS_YES");
    await makePrediction(uBttsNo.id, match.id, "BTTS_NO");

    const res = await scoreMatch(match.id);
    expect(res.ok).toBe(true);

    expect(await pointsFor(uTwo.id, match.id)).toBe(1); // winner correct
    expect(await pointsFor(uOne.id, match.id)).toBe(0); // winner wrong
    expect(await pointsFor(uBttsYes.id, match.id)).toBe(2); // both scored, BTTS base = 2
    expect(await pointsFor(uBttsNo.id, match.id)).toBe(0); // both scored → No wrong
  });

  it("BTTS No is correct for a goalless draw and a one-sided win", async () => {
    const goalless = await makeFinishedMatch({
      officialResultType: "X",
      homeScore: 0,
      awayScore: 0,
    });
    const oneSided = await makeFinishedMatch({
      officialResultType: "ONE",
      homeScore: 3,
      awayScore: 0,
    });

    const uNoA = await makeUser();
    const uYesA = await makeUser();
    const uNoB = await makeUser();
    const uYesB = await makeUser();

    await makePrediction(uNoA.id, goalless.id, "BTTS_NO");
    await makePrediction(uYesA.id, goalless.id, "BTTS_YES");
    await makePrediction(uNoB.id, oneSided.id, "BTTS_NO");
    await makePrediction(uYesB.id, oneSided.id, "BTTS_YES");

    expect((await scoreMatch(goalless.id)).ok).toBe(true);
    expect((await scoreMatch(oneSided.id)).ok).toBe(true);

    expect(await pointsFor(uNoA.id, goalless.id)).toBe(2);
    expect(await pointsFor(uYesA.id, goalless.id)).toBe(0);
    expect(await pointsFor(uNoB.id, oneSided.id)).toBe(2);
    expect(await pointsFor(uYesB.id, oneSided.id)).toBe(0);
  });

  it("applies the Power Pick multiplier to a correct BTTS pick only", async () => {
    const match = await makeFinishedMatch({
      officialResultType: "ONE",
      homeScore: 2,
      awayScore: 1,
    });

    const boostedCorrect = await makeUser();
    const normalCorrect = await makeUser();
    const boostedWrong = await makeUser();

    await makePrediction(boostedCorrect.id, match.id, "BTTS_YES");
    await makePrediction(normalCorrect.id, match.id, "BTTS_YES");
    await makePrediction(boostedWrong.id, match.id, "BTTS_NO");

    await armPowerPick(boostedCorrect.id, match.id, 5);
    await armPowerPick(boostedWrong.id, match.id, 5);

    expect((await scoreMatch(match.id)).ok).toBe(true);

    expect(await pointsFor(boostedCorrect.id, match.id)).toBe(5); // 5-point right, not 2 * 5
    expect(await pointsFor(normalCorrect.id, match.id)).toBe(2); // plain BTTS correct
    expect(await pointsFor(boostedWrong.id, match.id)).toBe(0); // wrong, no points

    // The consumed booster is locked, not left active.
    const sel = await db.powerPickSelection.findUnique({
      where: { userId_matchId: { userId: boostedCorrect.id, matchId: match.id } },
      select: { status: true },
    });
    expect(sel?.status).toBe("locked");
  });

  it("never scores BTTS when the scoreline is unavailable", async () => {
    const match = await makeFinishedMatch({
      officialResultType: "ONE",
      homeScore: null,
      awayScore: null,
    });

    const uOne = await makeUser();
    const uYes = await makeUser();
    const uNo = await makeUser();

    await makePrediction(uOne.id, match.id, "ONE");
    await makePrediction(uYes.id, match.id, "BTTS_YES");
    await makePrediction(uNo.id, match.id, "BTTS_NO");

    expect((await scoreMatch(match.id)).ok).toBe(true);

    expect(await pointsFor(uOne.id, match.id)).toBe(1); // winner still resolves
    expect(await pointsFor(uYes.id, match.id)).toBe(0); // no scoreline → not correct
    expect(await pointsFor(uNo.id, match.id)).toBe(0); // no scoreline → not correct
  });

  it("does not score draft (non-final) predictions", async () => {
    const match = await makeFinishedMatch({
      officialResultType: "ONE",
      homeScore: 1,
      awayScore: 1,
    });

    const draftUser = await makeUser();
    await makePrediction(draftUser.id, match.id, "BTTS_YES", false);

    expect((await scoreMatch(match.id)).ok).toBe(true);
    expect(await pointsFor(draftUser.id, match.id)).toBe(0);
  });

  it("rebuilds the leaderboard with BTTS points and accuracy", async () => {
    const match = await makeFinishedMatch({
      officialResultType: "TWO",
      homeScore: 2,
      awayScore: 2,
    });

    const winner = await makeUser(); // BTTS_YES correct
    const loser = await makeUser(); // BTTS_NO wrong

    await makePrediction(winner.id, match.id, "BTTS_YES");
    await makePrediction(loser.id, match.id, "BTTS_NO");

    await scoreMatch(match.id);
    const rebuilt = await rebuildLeaderboardForCompetition(WC);
    expect(rebuilt.ok).toBe(true);

    const winnerEntry = await db.leaderboardEntry.findUnique({
      where: { userId_competitionId: { userId: winner.id, competitionId: WC } },
    });
    const loserEntry = await db.leaderboardEntry.findUnique({
      where: { userId_competitionId: { userId: loser.id, competitionId: WC } },
    });

    expect(winnerEntry?.totalPoints).toBe(2);
    expect(winnerEntry?.completedMatchCount).toBe(1);
    expect(winnerEntry?.accuracyRate).toBe(1);
    expect(winnerEntry?.currentRank).toBe(1);

    const liveStats = await getLeaderboardStatsForUser(winner.id, WC);
    expect(liveStats?.totalPoints).toBe(2);
    expect(liveStats?.completedMatchCount).toBe(1);
    expect(liveStats?.accuracyRate).toBe(1);

    expect(loserEntry?.totalPoints).toBe(0);
    expect(loserEntry?.completedMatchCount).toBe(1);
    expect(loserEntry?.accuracyRate).toBe(0);
    expect(loserEntry?.currentRank).toBe(2);
  });
});
