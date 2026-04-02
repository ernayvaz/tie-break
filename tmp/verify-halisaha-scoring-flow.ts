import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const require = createRequire(import.meta.url);
const prismaCliPath = require.resolve("prisma/build/index.js");
const TEST_PIN_HASH = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";
const MIGRATE_RETRY_DELAY_MS = 5000;
const MIGRATE_MAX_ATTEMPTS = 4;

function withSchema(connectionString: string, schema: string) {
  const url = new URL(connectionString);
  url.searchParams.set("schema", schema);
  return url.toString();
}

function runPrismaMigrateDeploy(env: NodeJS.ProcessEnv) {
  const result = spawnSync(process.execPath, [prismaCliPath, "migrate", "deploy"], {
    cwd: process.cwd(),
    env,
    encoding: "utf8",
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  if (result.status !== 0) {
    const combinedOutput = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
    throw new Error(
      `prisma migrate deploy failed with exit code ${result.status ?? "unknown"}\n${combinedOutput}`,
    );
  }
}

function isRetryableMigrateLockTimeout(error: unknown) {
  return error instanceof Error && /P1002|advisory lock|timed out/i.test(error.message);
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function runPrismaMigrateDeployWithRetry(env: NodeJS.ProcessEnv) {
  for (let attempt = 1; attempt <= MIGRATE_MAX_ATTEMPTS; attempt += 1) {
    try {
      runPrismaMigrateDeploy(env);
      return;
    } catch (error) {
      if (!isRetryableMigrateLockTimeout(error) || attempt === MIGRATE_MAX_ATTEMPTS) {
        throw error;
      }
      console.warn(
        `migrate deploy hit advisory lock timeout; retrying in ${MIGRATE_RETRY_DELAY_MS}ms (${attempt}/${MIGRATE_MAX_ATTEMPTS})`,
      );
      await sleep(MIGRATE_RETRY_DELAY_MS);
    }
  }
}

async function main() {
  const baseDatabaseUrl = process.env.DATABASE_URL;
  const baseDirectDatabaseUrl = process.env.DIRECT_DATABASE_URL;

  if (!baseDatabaseUrl || !baseDirectDatabaseUrl) {
    throw new Error("DATABASE_URL and DIRECT_DATABASE_URL must be set");
  }

  const schema = `halisaha_verify_${Date.now()}_${randomUUID().slice(0, 8)}`.replace(/-/g, "_");
  const databaseUrl = withSchema(baseDatabaseUrl, schema);
  const directDatabaseUrl = withSchema(baseDirectDatabaseUrl, schema);
  const adminPrisma = new PrismaClient({ datasourceUrl: baseDirectDatabaseUrl });
  let appPrisma: PrismaClient | null = null;

  try {
    await adminPrisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    await runPrismaMigrateDeployWithRetry({
      ...process.env,
      DATABASE_URL: databaseUrl,
      DIRECT_DATABASE_URL: directDatabaseUrl,
    });

    process.env.DATABASE_URL = databaseUrl;
    process.env.DIRECT_DATABASE_URL = directDatabaseUrl;

    const [{ prisma }, { scoreHalisahaAnswers }, { composeHalisahaCumulativeLeaderboard }] =
      await Promise.all([
        import("../src/lib/db"),
        import("../src/lib/halisaha/server"),
        import("../src/lib/halisaha/leaderboard"),
      ]);
    appPrisma = prisma;

    const [ada, bora] = await Promise.all([
      prisma.user.create({
        data: {
          name: "Ada",
          surname: "Yilmaz",
          username: `verify_ada_${Date.now()}`,
          pinHash: TEST_PIN_HASH,
          status: "approved",
          role: "user",
        },
      }),
      prisma.user.create({
        data: {
          name: "Bora",
          surname: "Kaya",
          username: `verify_bora_${Date.now()}`,
          pinHash: TEST_PIN_HASH,
          status: "approved",
          role: "user",
        },
      }),
    ]);

    const round1 = await prisma.halisahaMatch.create({
      data: {
        roundNumber: 1,
        title: "Verify Round 1",
        homeTeamName: "RayNET",
        awayTeamName: "Rivals",
        venueName: "Verify Arena",
        kickoffAt: new Date("2026-04-02T18:00:00.000Z"),
      },
    });

    const round1Mvp = await prisma.halisahaParticipant.create({
      data: {
        matchId: round1.id,
        userId: bora.id,
        teamSide: "away",
        positionKey: "striker",
        displayOrder: 0,
      },
    });

    await prisma.halisahaMatch.update({
      where: { id: round1.id },
      data: {
        mvpResolvedParticipantId: round1Mvp.id,
        mvpResolvedAt: new Date("2026-04-02T20:00:00.000Z"),
      },
    });

    const round1WinnerQuestion = await prisma.halisahaQuestion.create({
      data: {
        matchId: round1.id,
        kind: "winner",
        prompt: "Who wins round 1?",
        points: 2,
        sortOrder: 0,
      },
    });
    const [round1WinnerHome, round1WinnerAway] = await Promise.all([
      prisma.halisahaQuestionOption.create({
        data: {
          questionId: round1WinnerQuestion.id,
          label: "RayNET",
          kind: "standard",
          sortOrder: 0,
          isCorrect: true,
        },
      }),
      prisma.halisahaQuestionOption.create({
        data: {
          questionId: round1WinnerQuestion.id,
          label: "Rivals",
          kind: "standard",
          sortOrder: 1,
          isCorrect: false,
        },
      }),
    ]);

    const round1ScoreQuestion = await prisma.halisahaQuestion.create({
      data: {
        matchId: round1.id,
        kind: "score_prediction",
        prompt: "Exact score round 1?",
        points: 3,
        sortOrder: 1,
      },
    });
    const round1ScoreOption = await prisma.halisahaQuestionOption.create({
      data: {
        questionId: round1ScoreQuestion.id,
        label: "Exact score",
        kind: "custom_score",
        sortOrder: 0,
        resolvedScoreHome: 3,
        resolvedScoreAway: 2,
      },
    });

    await prisma.halisahaAnswer.createMany({
      data: [
        {
          matchId: round1.id,
          questionId: round1WinnerQuestion.id,
          userId: ada.id,
          selectedOptionId: round1WinnerHome.id,
          isFinal: true,
          finalizedAt: new Date("2026-04-02T17:00:00.000Z"),
        },
        {
          matchId: round1.id,
          questionId: round1WinnerQuestion.id,
          userId: bora.id,
          selectedOptionId: round1WinnerAway.id,
          isFinal: true,
          finalizedAt: new Date("2026-04-02T17:01:00.000Z"),
        },
        {
          matchId: round1.id,
          questionId: round1ScoreQuestion.id,
          userId: ada.id,
          selectedOptionId: round1ScoreOption.id,
          customScoreHome: 3,
          customScoreAway: 2,
          isFinal: true,
          finalizedAt: new Date("2026-04-02T17:02:00.000Z"),
        },
        {
          matchId: round1.id,
          questionId: round1ScoreQuestion.id,
          userId: bora.id,
          selectedOptionId: round1ScoreOption.id,
          customScoreHome: 2,
          customScoreAway: 2,
          isFinal: true,
          finalizedAt: new Date("2026-04-02T17:03:00.000Z"),
        },
      ],
    });

    const round2 = await prisma.halisahaMatch.create({
      data: {
        singletonKey: "active",
        roundNumber: 2,
        title: "Verify Round 2",
        homeTeamName: "RayNET",
        awayTeamName: "Challengers",
        venueName: "Verify Arena",
        kickoffAt: new Date("2026-04-09T18:00:00.000Z"),
      },
    });

    const round2Mvp = await prisma.halisahaParticipant.create({
      data: {
        matchId: round2.id,
        userId: ada.id,
        teamSide: "home",
        positionKey: "center_midfield",
        displayOrder: 0,
      },
    });

    await prisma.halisahaMatch.update({
      where: { id: round2.id },
      data: {
        mvpResolvedParticipantId: round2Mvp.id,
        mvpResolvedAt: new Date("2026-04-09T20:00:00.000Z"),
      },
    });

    const round2ShotsQuestion = await prisma.halisahaQuestion.create({
      data: {
        matchId: round2.id,
        kind: "standard",
        prompt: "How many shots on target for RayNET?",
        points: 4,
        sortOrder: 0,
      },
    });
    const round2ShotsOption = await prisma.halisahaQuestionOption.create({
      data: {
        questionId: round2ShotsQuestion.id,
        label: "Shots on target",
        kind: "custom_number",
        sortOrder: 0,
        resolvedScoreHome: 7,
      },
    });

    const round2WinnerQuestion = await prisma.halisahaQuestion.create({
      data: {
        matchId: round2.id,
        kind: "winner",
        prompt: "Who wins round 2?",
        points: 2,
        sortOrder: 1,
      },
    });
    const [round2WinnerHome, round2WinnerAway] = await Promise.all([
      prisma.halisahaQuestionOption.create({
        data: {
          questionId: round2WinnerQuestion.id,
          label: "RayNET",
          kind: "standard",
          sortOrder: 0,
          isCorrect: false,
        },
      }),
      prisma.halisahaQuestionOption.create({
        data: {
          questionId: round2WinnerQuestion.id,
          label: "Challengers",
          kind: "standard",
          sortOrder: 1,
          isCorrect: true,
        },
      }),
    ]);

    await prisma.halisahaAnswer.createMany({
      data: [
        {
          matchId: round2.id,
          questionId: round2ShotsQuestion.id,
          userId: ada.id,
          selectedOptionId: round2ShotsOption.id,
          customScoreHome: 6,
          isFinal: true,
          finalizedAt: new Date("2026-04-09T17:00:00.000Z"),
        },
        {
          matchId: round2.id,
          questionId: round2ShotsQuestion.id,
          userId: bora.id,
          selectedOptionId: round2ShotsOption.id,
          customScoreHome: 7,
          isFinal: true,
          finalizedAt: new Date("2026-04-09T17:01:00.000Z"),
        },
        {
          matchId: round2.id,
          questionId: round2WinnerQuestion.id,
          userId: ada.id,
          selectedOptionId: round2WinnerAway.id,
          isFinal: true,
          finalizedAt: new Date("2026-04-09T17:02:00.000Z"),
        },
        {
          matchId: round2.id,
          questionId: round2WinnerQuestion.id,
          userId: bora.id,
          selectedOptionId: round2WinnerAway.id,
          isFinal: true,
          finalizedAt: new Date("2026-04-09T17:03:00.000Z"),
        },
      ],
    });

    const round1ScoreResult = await scoreHalisahaAnswers(round1.id);
    const round2ScoreResult = await scoreHalisahaAnswers(round2.id);

    const scoredAnswers = await prisma.halisahaAnswer.findMany({
      where: {
        matchId: { in: [round1.id, round2.id] },
      },
      orderBy: [{ matchId: "asc" }, { finalizedAt: "asc" }],
      include: {
        question: { select: { prompt: true, points: true } },
        user: { select: { id: true, name: true, surname: true } },
      },
    });

    const roundRows = await prisma.halisahaLeaderboardRound.findMany({
      orderBy: [{ roundNumber: "asc" }, { userId: "asc" }],
      include: {
        user: { select: { id: true, name: true, surname: true } },
      },
    });

    const mvpAwards = await prisma.halisahaMvpRoundAward.findMany({
      orderBy: [{ roundNumber: "asc" }, { userId: "asc" }],
      include: {
        user: { select: { id: true, name: true, surname: true } },
      },
    });

    const cumulative = composeHalisahaCumulativeLeaderboard(
      roundRows.map((row) => ({
        userId: row.user.id,
        name: row.user.name,
        surname: row.user.surname,
        totalPoints: row.totalPoints,
        correctAnswers: row.correctAnswers,
        answeredQuestions: row.answeredQuestions,
        recentAnswers: row.recentAnswers as never,
      })),
      new Map(
        mvpAwards.reduce<[string, number][]>((acc, award) => {
          const existing = acc.find(([userId]) => userId === award.userId);
          if (existing) {
            existing[1] += 1;
          } else {
            acc.push([award.userId, 1]);
          }
          return acc;
        }, []),
      ),
      [],
    );

    const adaRound1 = roundRows.find((row) => row.roundNumber === 1 && row.userId === ada.id);
    const boraRound1 = roundRows.find((row) => row.roundNumber === 1 && row.userId === bora.id);
    const adaRound2 = roundRows.find((row) => row.roundNumber === 2 && row.userId === ada.id);
    const boraRound2 = roundRows.find((row) => row.roundNumber === 2 && row.userId === bora.id);
    const adaCumulative = cumulative.find((row) => row.userId === ada.id);
    const boraCumulative = cumulative.find((row) => row.userId === bora.id);

    const checks = {
      round1ScoreOk: round1ScoreResult.ok === true,
      round2ScoreOk: round2ScoreResult.ok === true,
      answerMatchingOk:
        scoredAnswers.some(
          (answer) =>
            answer.userId === ada.id &&
            answer.question.prompt === "Who wins round 1?" &&
            answer.isCorrect === true &&
            answer.awardedPoints === 2,
        ) &&
        scoredAnswers.some(
          (answer) =>
            answer.userId === bora.id &&
            answer.question.prompt === "Who wins round 1?" &&
            answer.isCorrect === false &&
            answer.awardedPoints === 0,
        ) &&
        scoredAnswers.some(
          (answer) =>
            answer.userId === ada.id &&
            answer.question.prompt === "Exact score round 1?" &&
            answer.isCorrect === true &&
            answer.awardedPoints === 3,
        ) &&
        scoredAnswers.some(
          (answer) =>
            answer.userId === bora.id &&
            answer.question.prompt === "Exact score round 1?" &&
            answer.isCorrect === false &&
            answer.awardedPoints === 0,
        ) &&
        scoredAnswers.some(
          (answer) =>
            answer.userId === ada.id &&
            answer.question.prompt === "How many shots on target for RayNET?" &&
            answer.isCorrect === false &&
            answer.awardedPoints === 0,
        ) &&
        scoredAnswers.some(
          (answer) =>
            answer.userId === bora.id &&
            answer.question.prompt === "How many shots on target for RayNET?" &&
            answer.isCorrect === true &&
            answer.awardedPoints === 4,
        ),
      round1LeaderboardOk:
        adaRound1?.totalPoints === 5 &&
        adaRound1.correctAnswers === 2 &&
        adaRound1.answeredQuestions === 2 &&
        boraRound1?.totalPoints === 0 &&
        boraRound1.correctAnswers === 0 &&
        boraRound1.answeredQuestions === 2,
      round2LeaderboardOk:
        adaRound2?.totalPoints === 2 &&
        adaRound2.correctAnswers === 1 &&
        adaRound2.answeredQuestions === 2 &&
        boraRound2?.totalPoints === 6 &&
        boraRound2.correctAnswers === 2 &&
        boraRound2.answeredQuestions === 2,
      cumulativeLeaderboardOk:
        adaCumulative?.totalPoints === 8 &&
        adaCumulative.correctAnswers === 3 &&
        adaCumulative.answeredQuestions === 4 &&
        adaCumulative.mvpWins === 1 &&
        adaCumulative.rank === 1 &&
        boraCumulative?.totalPoints === 7 &&
        boraCumulative.correctAnswers === 2 &&
        boraCumulative.answeredQuestions === 4 &&
        boraCumulative.mvpWins === 1 &&
        boraCumulative.rank === 2,
    };

    console.log(
      JSON.stringify(
        {
          schema,
          checks,
          scoredAnswers: scoredAnswers.map((answer) => ({
            user: `${answer.user.name} ${answer.user.surname}`,
            question: answer.question.prompt,
            pointsForQuestion: answer.question.points,
            isCorrect: answer.isCorrect,
            awardedPoints: answer.awardedPoints,
            customScoreHome: answer.customScoreHome,
            customScoreAway: answer.customScoreAway,
          })),
          leaderboardRounds: roundRows.map((row) => ({
            roundNumber: row.roundNumber,
            user: `${row.user.name} ${row.user.surname}`,
            totalPoints: row.totalPoints,
            correctAnswers: row.correctAnswers,
            answeredQuestions: row.answeredQuestions,
          })),
          cumulative,
          mvpAwards: mvpAwards.map((award) => ({
            roundNumber: award.roundNumber,
            user: `${award.user.name} ${award.user.surname}`,
          })),
        },
        null,
        2,
      ),
    );

  } finally {
    if (appPrisma) {
      await appPrisma.$disconnect().catch(() => {});
    }
    await adminPrisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await adminPrisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
