import { execSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient as AppPrismaClient } from "@prisma/client";
import { PrismaClient as SqlitePrismaClient } from "@/generated/prisma-sqlite";
import { composeHalisahaCumulativeLeaderboard } from "@/lib/halisaha/leaderboard";
import type { HalisahaRecentAnswerRow } from "@/lib/halisaha/leaderboard";
import { rebuildHalisahaLeaderboardForMatch } from "@/lib/halisaha/server";

const SQLITE_URL = "file:./prisma/sqlite/integration.sqlite";

function asAppPrisma(client: SqlitePrismaClient): AppPrismaClient {
  return client as unknown as AppPrismaClient;
}

async function wipeSqlite(prisma: SqlitePrismaClient) {
  await prisma.halisahaLeaderboardRound.deleteMany();
  await prisma.halisahaMvpRoundAward.deleteMany();
  await prisma.halisahaMatch.deleteMany();
  await prisma.user.deleteMany();
}

/** Valid bcrypt hash for PIN `password` (same pattern as auth tests). */
const TEST_PIN_HASH = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

describe("Halisaha leaderboard rebuild (SQLite integration)", () => {
  let prisma: SqlitePrismaClient;

  beforeAll(() => {
    process.env.SQLITE_TEST_DATABASE_URL = SQLITE_URL;
    execSync(
      "npx prisma db push --schema=prisma/sqlite/schema.prisma --accept-data-loss --skip-generate",
      {
        env: { ...process.env, SQLITE_TEST_DATABASE_URL: SQLITE_URL },
        stdio: "inherit",
        cwd: process.cwd(),
      },
    );
    prisma = new SqlitePrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await wipeSqlite(prisma);
  });

  it("rebuildHalisahaLeaderboardForMatch writes HalisahaLeaderboardRound from finalized answers", async () => {
    const user = await prisma.user.create({
      data: {
        name: "Ada",
        surname: "Yilmaz",
        username: "ada_y",
        pinHash: TEST_PIN_HASH,
        status: "approved",
        role: "user",
      },
    });

    const match = await prisma.halisahaMatch.create({
      data: {
        singletonKey: "active",
        roundNumber: 1,
        homeTeamName: "Home FC",
        awayTeamName: "Away FC",
        venueName: "Test",
        kickoffAt: new Date("2026-06-01T18:00:00.000Z"),
      },
    });

    const question = await prisma.halisahaQuestion.create({
      data: {
        matchId: match.id,
        kind: "standard",
        prompt: "Test question?",
        points: 1,
        sortOrder: 0,
      },
    });

    const option = await prisma.halisahaQuestionOption.create({
      data: {
        questionId: question.id,
        label: "Yes",
        kind: "standard",
        sortOrder: 0,
        isCorrect: true,
      },
    });

    await prisma.halisahaAnswer.create({
      data: {
        matchId: match.id,
        questionId: question.id,
        userId: user.id,
        selectedOptionId: option.id,
        isFinal: true,
        finalizedAt: new Date("2026-06-01T17:00:00.000Z"),
        isCorrect: true,
        awardedPoints: 1,
      },
    });

    const result = await rebuildHalisahaLeaderboardForMatch(match.id, asAppPrisma(prisma));
    expect(result).toEqual({ ok: true });

    const rows = await prisma.halisahaLeaderboardRound.findMany({
      where: { roundNumber: 1, userId: user.id },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.totalPoints).toBe(1);
    expect(rows[0]?.correctAnswers).toBe(1);
    expect(rows[0]?.answeredQuestions).toBe(1);
    expect(Array.isArray(rows[0]?.recentAnswers)).toBe(true);
  });

  it("rebuild syncs HalisahaMvpRoundAward when mvpResolvedParticipantId links to a registered user", async () => {
    const mvpUser = await prisma.user.create({
      data: {
        name: "Mvp",
        surname: "Player",
        username: "mvp_p",
        pinHash: TEST_PIN_HASH,
        status: "approved",
        role: "user",
      },
    });

    const other = await prisma.user.create({
      data: {
        name: "Other",
        surname: "User",
        username: "other_u",
        pinHash: TEST_PIN_HASH,
        status: "approved",
        role: "user",
      },
    });

    const match = await prisma.halisahaMatch.create({
      data: {
        singletonKey: "active",
        roundNumber: 2,
        homeTeamName: "H",
        awayTeamName: "A",
        venueName: "V",
        kickoffAt: new Date("2026-07-01T18:00:00.000Z"),
      },
    });

    const participant = await prisma.halisahaParticipant.create({
      data: {
        matchId: match.id,
        userId: mvpUser.id,
        teamSide: "home",
        positionKey: "striker",
        displayOrder: 0,
      },
    });

    await prisma.halisahaMatch.update({
      where: { id: match.id },
      data: { mvpResolvedParticipantId: participant.id },
    });

    const question = await prisma.halisahaQuestion.create({
      data: {
        matchId: match.id,
        kind: "standard",
        prompt: "Q?",
        points: 1,
        sortOrder: 0,
      },
    });

    const option = await prisma.halisahaQuestionOption.create({
      data: {
        questionId: question.id,
        label: "Opt",
        kind: "standard",
        sortOrder: 0,
        isCorrect: true,
      },
    });

    await prisma.halisahaAnswer.create({
      data: {
        matchId: match.id,
        questionId: question.id,
        userId: other.id,
        selectedOptionId: option.id,
        isFinal: true,
        finalizedAt: new Date(),
        isCorrect: true,
        awardedPoints: 1,
      },
    });

    await rebuildHalisahaLeaderboardForMatch(match.id, asAppPrisma(prisma));

    const awards = await prisma.halisahaMvpRoundAward.findMany({
      where: { roundNumber: 2 },
    });
    expect(awards).toHaveLength(1);
    expect(awards[0]?.userId).toBe(mvpUser.id);
  });

  it("composeHalisahaCumulativeLeaderboard matches DB after rebuild (end-to-end snapshot)", async () => {
    const u1 = await prisma.user.create({
      data: {
        name: "One",
        surname: "User",
        username: "u_one",
        pinHash: TEST_PIN_HASH,
        status: "approved",
        role: "user",
      },
    });

    const match = await prisma.halisahaMatch.create({
      data: {
        singletonKey: "active",
        roundNumber: 3,
        homeTeamName: "H",
        awayTeamName: "A",
        venueName: "V",
        kickoffAt: new Date("2026-08-01T18:00:00.000Z"),
      },
    });

    const participant = await prisma.halisahaParticipant.create({
      data: {
        matchId: match.id,
        userId: u1.id,
        teamSide: "home",
        positionKey: "goalkeeper",
        displayOrder: 0,
      },
    });

    await prisma.halisahaMatch.update({
      where: { id: match.id },
      data: { mvpResolvedParticipantId: participant.id },
    });

    const question = await prisma.halisahaQuestion.create({
      data: {
        matchId: match.id,
        kind: "standard",
        prompt: "Pick",
        points: 2,
        sortOrder: 0,
      },
    });

    const option = await prisma.halisahaQuestionOption.create({
      data: {
        questionId: question.id,
        label: "A",
        kind: "standard",
        sortOrder: 0,
        isCorrect: true,
      },
    });

    await prisma.halisahaAnswer.create({
      data: {
        matchId: match.id,
        questionId: question.id,
        userId: u1.id,
        selectedOptionId: option.id,
        isFinal: true,
        finalizedAt: new Date(),
        isCorrect: true,
        awardedPoints: 2,
      },
    });

    await rebuildHalisahaLeaderboardForMatch(match.id, asAppPrisma(prisma));

    const mvpGroups = await prisma.halisahaMvpRoundAward.groupBy({
      by: ["userId"],
      _count: { _all: true },
    });
    const mvpCountByUser = new Map(mvpGroups.map((g) => [g.userId, g._count._all]));

    const rounds = await prisma.halisahaLeaderboardRound.findMany({
      orderBy: [{ roundNumber: "asc" }, { createdAt: "asc" }],
      include: {
        user: { select: { id: true, name: true, surname: true } },
      },
    });

    const snapshots = rounds.map((round) => ({
      userId: round.user.id,
      name: round.user.name,
      surname: round.user.surname,
      totalPoints: round.totalPoints,
      correctAnswers: round.correctAnswers,
      answeredQuestions: round.answeredQuestions,
      recentAnswers: round.recentAnswers as unknown as HalisahaRecentAnswerRow[],
    }));

    const composed = composeHalisahaCumulativeLeaderboard(snapshots, mvpCountByUser, []);

    expect(composed).toHaveLength(1);
    expect(composed[0]).toMatchObject({
      userId: u1.id,
      totalPoints: 3,
      mvpWins: 1,
      rank: 1,
    });
  });
});
