import { execSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient as AppPrismaClient } from "@prisma/client";
import { PrismaClient as SqlitePrismaClient } from "@/generated/prisma-sqlite";
import {
  archiveHalisahaMatchForNextRound,
  purgeArchivedHalisahaMatchesBefore,
} from "@/lib/halisaha/server";

const SQLITE_URL = "file:./prisma/sqlite/integration.sqlite";

function asAppPrisma(client: SqlitePrismaClient): AppPrismaClient {
  return client as unknown as AppPrismaClient;
}

async function wipeSqlite(prisma: SqlitePrismaClient) {
  await prisma.halisahaLeaderboardRound.deleteMany();
  await prisma.halisahaMvpRoundAward.deleteMany();
  await prisma.halisahaMatch.deleteMany();
  await prisma.halisahaGuest.deleteMany();
  await prisma.adminLog.deleteMany();
  await prisma.user.deleteMany();
}

const TEST_PIN_HASH =
  "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

describe("Halisaha archive lifecycle (SQLite integration)", () => {
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

  it("archives the previous active match and clones participants and questions into the next round", async () => {
    const registeredPlayer = await prisma.user.create({
      data: {
        name: "Mert",
        surname: "Yildiz",
        username: "mert_y",
        pinHash: TEST_PIN_HASH,
        status: "approved",
        role: "user",
      },
    });
    const voter = await prisma.user.create({
      data: {
        name: "Ada",
        surname: "Tester",
        username: "ada_t",
        pinHash: TEST_PIN_HASH,
        status: "approved",
        role: "user",
      },
    });
    const savedGuest = await prisma.halisahaGuest.create({
      data: {
        displayName: "Guest Star",
        normalizedName: "guest star",
      },
    });

    const match = await prisma.halisahaMatch.create({
      data: {
        singletonKey: "active",
        roundNumber: 7,
        title: "Matchday Show",
        homeTeamName: "Old Home",
        awayTeamName: "Old Away",
        venueName: "Old Venue",
        homeFormation: "f1_2_3_1",
        awayFormation: "f1_3_3",
        kickoffAt: new Date("2026-09-01T18:00:00.000Z"),
        answersResolvedAt: new Date("2026-09-01T20:00:00.000Z"),
      },
    });

    const homeParticipant = await prisma.halisahaParticipant.create({
      data: {
        matchId: match.id,
        userId: registeredPlayer.id,
        displayNameOverride: "Captain Mert",
        teamSide: "home",
        positionKey: "striker",
        displayOrder: 10,
      },
    });
    const guestParticipant = await prisma.halisahaParticipant.create({
      data: {
        matchId: match.id,
        guestId: savedGuest.id,
        guestName: "Guest Star",
        teamSide: "away",
        positionKey: "goalkeeper",
        displayOrder: 20,
      },
    });

    const scoreQuestion = await prisma.halisahaQuestion.create({
      data: {
        matchId: match.id,
        kind: "score_prediction",
        prompt: "Exact score?",
        points: 3,
        sortOrder: 10,
        scoreHomeResult: 6,
        scoreAwayResult: 4,
      },
    });
    const fixedScoreOption = await prisma.halisahaQuestionOption.create({
      data: {
        questionId: scoreQuestion.id,
        label: "6-4",
        kind: "standard",
        sortOrder: 10,
        isCorrect: true,
      },
    });
    await prisma.halisahaQuestionOption.create({
      data: {
        questionId: scoreQuestion.id,
        label: "Your exact score",
        kind: "custom_score",
        sortOrder: 20,
        isCorrect: false,
      },
    });

    const mvpQuestion = await prisma.halisahaQuestion.create({
      data: {
        matchId: match.id,
        kind: "mvp_prediction",
        prompt: "Who will be the MVP?",
        points: 1,
        sortOrder: 20,
      },
    });
    await prisma.halisahaQuestionOption.createMany({
      data: [
        {
          questionId: mvpQuestion.id,
          label: "Mert Yildiz",
          kind: "standard",
          participantId: homeParticipant.id,
          sortOrder: 10,
          isCorrect: true,
        },
        {
          questionId: mvpQuestion.id,
          label: "Guest Star",
          kind: "standard",
          participantId: guestParticipant.id,
          sortOrder: 20,
        },
      ],
    });

    await prisma.halisahaAnswer.create({
      data: {
        matchId: match.id,
        questionId: scoreQuestion.id,
        userId: voter.id,
        selectedOptionId: fixedScoreOption.id,
        isFinal: true,
        finalizedAt: new Date("2026-09-01T17:45:00.000Z"),
        isCorrect: true,
        awardedPoints: 3,
      },
    });
    await prisma.halisahaMvpVote.create({
      data: {
        matchId: match.id,
        userId: voter.id,
        participantId: homeParticipant.id,
      },
    });

    const result = await archiveHalisahaMatchForNextRound(
      {
        matchId: match.id,
        homeTeamName: "New Home",
        awayTeamName: "New Away",
        venueName: "New Venue",
        homeFormation: "f1_3_2_1",
        awayFormation: "f1_2_2_2",
        kickoffAt: new Date("2026-09-08T18:00:00.000Z"),
        matchDurationMinutes: 70,
      },
      asAppPrisma(prisma),
    );

    expect(result).toMatchObject({
      ok: true,
      archivedMatchId: match.id,
      archivedRoundNumber: 7,
      nextRoundNumber: 8,
    });

    const archivedMatch = await prisma.halisahaMatch.findUnique({
      where: { id: match.id },
    });
    expect(archivedMatch?.singletonKey).toBeNull();
    expect(archivedMatch?.archivedAt).not.toBeNull();
    expect(archivedMatch?.homeTeamName).toBe("Old Home");

    const nextActive = await prisma.halisahaMatch.findUnique({
      where: { singletonKey: "active" },
      include: {
        participants: {
          orderBy: { displayOrder: "asc" },
        },
        questions: {
          orderBy: { sortOrder: "asc" },
          include: {
            options: {
              orderBy: { sortOrder: "asc" },
            },
          },
        },
        answers: true,
        mvpVotes: true,
      },
    });

    expect(nextActive).not.toBeNull();
    expect(nextActive?.id).not.toBe(match.id);
    expect(nextActive).toMatchObject({
      roundNumber: 8,
      homeTeamName: "New Home",
      awayTeamName: "New Away",
      venueName: "New Venue",
      homeFormation: "f1_3_2_1",
      awayFormation: "f1_2_2_2",
      matchDurationMinutes: 70,
      isPublishedToUsers: false,
    });
    expect(nextActive?.answers).toHaveLength(0);
    expect(nextActive?.mvpVotes).toHaveLength(0);
    expect(nextActive?.participants).toHaveLength(2);

    const nextParticipantIds = new Set(
      nextActive?.participants.map((participant) => participant.id) ?? [],
    );
    expect(nextParticipantIds.has(homeParticipant.id)).toBe(false);
    expect(nextParticipantIds.has(guestParticipant.id)).toBe(false);
    expect(
      nextActive?.participants.find((participant) => participant.userId === registeredPlayer.id)
        ?.displayNameOverride,
    ).toBe("Captain Mert");
    expect(
      nextActive?.participants.find((participant) => participant.userId == null)?.guestId,
    ).toBe(savedGuest.id);

    const clonedScoreQuestion = nextActive?.questions.find(
      (question) => question.kind === "score_prediction",
    );
    expect(clonedScoreQuestion).toBeTruthy();
    expect(clonedScoreQuestion?.scoreHomeResult).toBeNull();
    expect(clonedScoreQuestion?.scoreAwayResult).toBeNull();
    expect(clonedScoreQuestion?.options.every((option) => option.isCorrect === false)).toBe(
      true,
    );

    const clonedMvpQuestion = nextActive?.questions.find(
      (question) => question.kind === "mvp_prediction",
    );
    expect(clonedMvpQuestion?.options).toHaveLength(2);
    expect(
      clonedMvpQuestion?.options.every(
        (option) => option.participantId == null || nextParticipantIds.has(option.participantId),
      ),
    ).toBe(true);

    expect(
      await prisma.halisahaAnswer.count({
        where: { matchId: match.id },
      }),
    ).toBe(1);
    expect(
      await prisma.halisahaMvpVote.count({
        where: { matchId: match.id },
      }),
    ).toBe(1);
  });

  it("purges archived matches before a cutoff and removes round snapshots for those rounds", async () => {
    const user = await prisma.user.create({
      data: {
        name: "Archive",
        surname: "Owner",
        username: "archive_o",
        pinHash: TEST_PIN_HASH,
        status: "approved",
        role: "user",
      },
    });

    const activeMatch = await prisma.halisahaMatch.create({
      data: {
        singletonKey: "active",
        roundNumber: 1,
        homeTeamName: "Alpha",
        awayTeamName: "Beta",
        venueName: "Pitch",
        kickoffAt: new Date("2026-10-01T18:00:00.000Z"),
      },
    });

    const archiveResult = await archiveHalisahaMatchForNextRound(
      {
        matchId: activeMatch.id,
        homeTeamName: "Gamma",
        awayTeamName: "Delta",
        venueName: "Arena",
        homeFormation: "f1_3_1_2",
        awayFormation: "f1_2_1_3",
        kickoffAt: new Date("2026-10-08T18:00:00.000Z"),
        matchDurationMinutes: 60,
      },
      asAppPrisma(prisma),
    );
    expect(archiveResult.ok).toBe(true);
    if (!archiveResult.ok) {
      throw new Error(archiveResult.error);
    }

    await prisma.halisahaMatch.update({
      where: { id: archiveResult.archivedMatchId },
      data: {
        archivedAt: new Date("2026-10-02T00:00:00.000Z"),
      },
    });

    await prisma.halisahaLeaderboardRound.createMany({
      data: [
        {
          roundNumber: archiveResult.archivedRoundNumber,
          userId: user.id,
          totalPoints: 3,
          correctAnswers: 1,
          answeredQuestions: 1,
          recentAnswers: [],
        },
        {
          roundNumber: archiveResult.nextRoundNumber,
          userId: user.id,
          totalPoints: 1,
          correctAnswers: 1,
          answeredQuestions: 1,
          recentAnswers: [],
        },
      ],
    });
    await prisma.halisahaMvpRoundAward.createMany({
      data: [
        {
          roundNumber: archiveResult.archivedRoundNumber,
          userId: user.id,
        },
        {
          roundNumber: archiveResult.nextRoundNumber,
          userId: user.id,
        },
      ],
    });

    const purgeResult = await purgeArchivedHalisahaMatchesBefore(
      new Date("2026-10-03T00:00:00.000Z"),
      asAppPrisma(prisma),
    );

    expect(purgeResult).toEqual({
      ok: true,
      deletedMatches: 1,
      deletedRounds: 1,
    });
    expect(
      await prisma.halisahaMatch.findUnique({
        where: { id: archiveResult.archivedMatchId },
      }),
    ).toBeNull();
    expect(
      await prisma.halisahaMatch.findUnique({
        where: { singletonKey: "active" },
      }),
    ).not.toBeNull();

    const remainingRounds = await prisma.halisahaLeaderboardRound.findMany({
      orderBy: { roundNumber: "asc" },
    });
    expect(remainingRounds).toHaveLength(1);
    expect(remainingRounds[0]?.roundNumber).toBe(archiveResult.nextRoundNumber);

    const remainingAwards = await prisma.halisahaMvpRoundAward.findMany({
      orderBy: { roundNumber: "asc" },
    });
    expect(remainingAwards).toHaveLength(1);
    expect(remainingAwards[0]?.roundNumber).toBe(archiveResult.nextRoundNumber);
  });
});
