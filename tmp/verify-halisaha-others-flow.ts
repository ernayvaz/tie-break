import { spawn, spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { setTimeout as sleep } from "node:timers/promises";
import { PrismaClient } from "@prisma/client";
import { chromium, devices } from "playwright";

const require = createRequire(import.meta.url);
const prismaCliPath = require.resolve("prisma/build/index.js");
const nextCliPath = require.resolve("next/dist/bin/next");
const TEST_PIN_HASH =
  "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";
const PORT = 3016;

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
    throw new Error(
      `prisma migrate deploy failed with exit code ${result.status ?? "unknown"}`,
    );
  }
}

async function waitForServer(url: string) {
  const deadline = Date.now() + 120_000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status < 500) {
        return;
      }
    } catch {
      // Server is still booting.
    }

    await sleep(1_000);
  }

  throw new Error(`Timed out waiting for ${url}`);
}

async function startNextServer(env: NodeJS.ProcessEnv) {
  const child = spawn(
    process.execPath,
    [nextCliPath, "dev", "-H", "127.0.0.1", "-p", String(PORT)],
    {
      cwd: process.cwd(),
      env,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  try {
    await waitForServer(`http://127.0.0.1:${PORT}/halisaha`);
  } catch (error) {
    child.kill();
    throw new Error(`Next server failed to start.\n${output}`, { cause: error });
  }

  return {
    child,
    getOutput: () => output,
  };
}

function createSessionToken() {
  return randomBytes(32).toString("hex");
}

async function measureGoto(page: import("playwright").Page, url: string) {
  const startedAt = Date.now();
  await page.goto(url, { waitUntil: "networkidle" });
  return {
    navMs: Date.now() - startedAt,
    performanceLoadMs: await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0] as
        | PerformanceNavigationTiming
        | undefined;
      if (typeof nav?.loadEventEnd === "number" && nav.loadEventEnd > 0) {
        return Math.round(nav.loadEventEnd);
      }
      return null;
    }),
  };
}

async function ensureQuestionOverlayOpen(page: import("playwright").Page) {
  let othersButton = page.getByRole("button", { name: /^others$/i }).first();
  if (
    (await othersButton.count()) > 0 &&
    (await othersButton.isVisible().catch(() => false))
  ) {
    return;
  }

  const toggleButtons = page.locator("button[aria-label]");
  const toggleCount = await toggleButtons.count();

  for (let index = 0; index < toggleCount; index += 1) {
    const candidate = toggleButtons.nth(index);
    const label = await candidate.getAttribute("aria-label");
    if (label && /reveal lineups|reveal mvp vote/i.test(label)) {
      await candidate.click({ force: true });
      break;
    }
  }

  othersButton = page.getByRole("button", { name: /^others$/i }).first();
  await othersButton.waitFor({ timeout: 20_000 });
}

async function verifyViewport(params: {
  baseUrl: string;
  sessionToken: string;
  prompt: string;
  expectedOthersButtonCount: number;
  viewport: "desktop" | "mobile";
}) {
  const browser = await chromium.launch({ headless: true });
  const context =
    params.viewport === "desktop"
      ? await browser.newContext({
          viewport: { width: 1440, height: 900 },
          screen: { width: 1440, height: 900 },
        })
      : await browser.newContext({
          ...devices["iPhone 13"],
          viewport: { width: 844, height: 390 },
          screen: { width: 844, height: 390 },
          isMobile: true,
          hasTouch: true,
        });

  try {
    await context.addCookies([
      {
        name: "tb_session",
        value: params.sessionToken,
        url: params.baseUrl,
        httpOnly: true,
        sameSite: "Lax",
        secure: false,
      },
    ]);

    const page = await context.newPage();
    const navigation = await measureGoto(page, `${params.baseUrl}/halisaha`);
    await ensureQuestionOverlayOpen(page);

    const othersButtons = page.getByRole("button", { name: /^others$/i });
    const othersButtonCount = await othersButtons.count();

    const targetCard = page
      .locator("article")
      .filter({ hasText: params.prompt })
      .first();
    await targetCard.getByRole("button", { name: /^others$/i }).click();

    const modal = page.getByText("See how other players answered").first();
    await modal.waitFor({ timeout: 20_000 });

    const modalText = await page.locator("body").innerText();
    return {
      ...navigation,
      othersButtonCount,
      matchesExpectedButtonCount: othersButtonCount === params.expectedOthersButtonCount,
      modalContainsExpectedName: modalText.includes("Bora Kaya"),
      modalContainsExpectedAnswer: modalText.includes("Answer: 7"),
    };
  } finally {
    await context.close();
    await browser.close();
  }
}

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const baseDatabaseUrl = process.env.DATABASE_URL;
  const baseDirectDatabaseUrl = process.env.DIRECT_DATABASE_URL;

  if (!baseDatabaseUrl || !baseDirectDatabaseUrl) {
    throw new Error("DATABASE_URL and DIRECT_DATABASE_URL must be set.");
  }

  const schema = `halisaha_others_${Date.now()}_${randomUUID().slice(0, 8)}`.replace(
    /-/g,
    "_",
  );
  const databaseUrl = withSchema(baseDatabaseUrl, schema);
  const directDatabaseUrl = withSchema(baseDirectDatabaseUrl, schema);
  const adminPrisma = new PrismaClient({ datasourceUrl: baseDirectDatabaseUrl });
  let appPrisma: PrismaClient | null = null;
  let nextServer: Awaited<ReturnType<typeof startNextServer>> | null = null;

  try {
    await adminPrisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    runPrismaMigrateDeploy({
      ...process.env,
      DATABASE_URL: databaseUrl,
      DIRECT_DATABASE_URL: directDatabaseUrl,
    });

    process.env.DATABASE_URL = databaseUrl;
    process.env.DIRECT_DATABASE_URL = directDatabaseUrl;

    const [
      { prisma },
      {
        getHalisahaPublicSnapshot,
        scoreHalisahaAnswers,
        syncHalisahaMvpPredictionQuestion,
      },
    ] = await Promise.all([import("../src/lib/db"), import("../src/lib/halisaha/server")]);
    appPrisma = prisma;

    const [ada, bora] = await Promise.all([
      prisma.user.create({
        data: {
          name: "Ada",
          surname: "Yilmaz",
          username: `others_ada_${Date.now()}`,
          pinHash: TEST_PIN_HASH,
          status: "approved",
          role: "user",
        },
      }),
      prisma.user.create({
        data: {
          name: "Bora",
          surname: "Kaya",
          username: `others_bora_${Date.now()}`,
          pinHash: TEST_PIN_HASH,
          status: "approved",
          role: "user",
        },
      }),
    ]);

    const round1 = await prisma.halisahaMatch.create({
      data: {
        roundNumber: 1,
        title: "Round 1",
        homeTeamName: "RayNET",
        awayTeamName: "Rivals",
        venueName: "Arena",
        kickoffAt: new Date("2026-04-01T18:00:00.000Z"),
      },
    });

    const round1MvpParticipant = await prisma.halisahaParticipant.create({
      data: {
        matchId: round1.id,
        userId: bora.id,
        teamSide: "away",
        positionKey: "striker",
        displayOrder: 10,
      },
    });
    await prisma.halisahaMatch.update({
      where: { id: round1.id },
      data: {
        mvpResolvedParticipantId: round1MvpParticipant.id,
        mvpResolvedAt: new Date("2026-04-01T20:30:00.000Z"),
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
          finalizedAt: new Date("2026-04-01T17:00:00.000Z"),
        },
        {
          matchId: round1.id,
          questionId: round1WinnerQuestion.id,
          userId: bora.id,
          selectedOptionId: round1WinnerAway.id,
          isFinal: true,
          finalizedAt: new Date("2026-04-01T17:01:00.000Z"),
        },
        {
          matchId: round1.id,
          questionId: round1ScoreQuestion.id,
          userId: ada.id,
          selectedOptionId: round1ScoreOption.id,
          customScoreHome: 3,
          customScoreAway: 2,
          isFinal: true,
          finalizedAt: new Date("2026-04-01T17:02:00.000Z"),
        },
        {
          matchId: round1.id,
          questionId: round1ScoreQuestion.id,
          userId: bora.id,
          selectedOptionId: round1ScoreOption.id,
          customScoreHome: 2,
          customScoreAway: 2,
          isFinal: true,
          finalizedAt: new Date("2026-04-01T17:03:00.000Z"),
        },
      ],
    });

    const round1ScoreResult = await scoreHalisahaAnswers(round1.id);
    assert(round1ScoreResult.ok, "Round 1 scoring failed.");

    const round2 = await prisma.halisahaMatch.create({
      data: {
        singletonKey: "active",
        roundNumber: 2,
        title: "Round 2",
        homeTeamName: "RayNET",
        awayTeamName: "Challengers",
        venueName: "Arena",
        kickoffAt: new Date("2026-04-03T18:00:00.000Z"),
        isPublishedToUsers: true,
      },
    });

    const [adaParticipant, boraParticipant] = await Promise.all([
      prisma.halisahaParticipant.create({
        data: {
          matchId: round2.id,
          userId: ada.id,
          teamSide: "home",
          positionKey: "center_midfield",
          displayOrder: 10,
        },
      }),
      prisma.halisahaParticipant.create({
        data: {
          matchId: round2.id,
          userId: bora.id,
          teamSide: "away",
          positionKey: "striker",
          displayOrder: 20,
        },
      }),
    ]);

    await prisma.halisahaMatch.update({
      where: { id: round2.id },
      data: {
        mvpResolvedParticipantId: boraParticipant.id,
        mvpResolvedAt: new Date("2026-04-03T20:30:00.000Z"),
      },
    });

    const round2WinnerQuestion = await prisma.halisahaQuestion.create({
      data: {
        matchId: round2.id,
        kind: "winner",
        prompt: "Who wins round 2?",
        points: 2,
        sortOrder: 0,
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

    const round2ShotsQuestion = await prisma.halisahaQuestion.create({
      data: {
        matchId: round2.id,
        kind: "standard",
        prompt: "How many shots on target for RayNET?",
        points: 4,
        sortOrder: 1,
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

    await syncHalisahaMvpPredictionQuestion(round2.id);
    const mvpQuestion = await prisma.halisahaQuestion.findFirstOrThrow({
      where: {
        matchId: round2.id,
        kind: "mvp_prediction",
      },
      include: {
        options: {
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
    });
    const adaMvpOption = mvpQuestion.options.find(
      (option) => option.participantId === adaParticipant.id,
    );
    const boraMvpOption = mvpQuestion.options.find(
      (option) => option.participantId === boraParticipant.id,
    );
    assert(Boolean(adaMvpOption && boraMvpOption), "MVP options were not synced correctly.");

    await prisma.halisahaAnswer.createMany({
      data: [
        {
          matchId: round2.id,
          questionId: round2WinnerQuestion.id,
          userId: ada.id,
          selectedOptionId: round2WinnerAway.id,
          isFinal: true,
          finalizedAt: new Date("2026-04-03T17:00:00.000Z"),
        },
        {
          matchId: round2.id,
          questionId: round2WinnerQuestion.id,
          userId: bora.id,
          selectedOptionId: round2WinnerAway.id,
          isFinal: true,
          finalizedAt: new Date("2026-04-03T17:01:00.000Z"),
        },
        {
          matchId: round2.id,
          questionId: round2ShotsQuestion.id,
          userId: ada.id,
          selectedOptionId: round2ShotsOption.id,
          customScoreHome: 6,
          isFinal: true,
          finalizedAt: new Date("2026-04-03T17:02:00.000Z"),
        },
        {
          matchId: round2.id,
          questionId: round2ShotsQuestion.id,
          userId: bora.id,
          selectedOptionId: round2ShotsOption.id,
          customScoreHome: 7,
          isFinal: true,
          finalizedAt: new Date("2026-04-03T17:03:00.000Z"),
        },
        {
          matchId: round2.id,
          questionId: mvpQuestion.id,
          userId: ada.id,
          selectedOptionId: adaMvpOption!.id,
          isFinal: true,
          finalizedAt: new Date("2026-04-03T17:04:00.000Z"),
        },
        {
          matchId: round2.id,
          questionId: mvpQuestion.id,
          userId: bora.id,
          selectedOptionId: boraMvpOption!.id,
          isFinal: true,
          finalizedAt: new Date("2026-04-03T17:05:00.000Z"),
        },
      ],
    });

    const preResolutionSnapshot = await getHalisahaPublicSnapshot(ada.id, ada.role);
    const preResolutionAdaRow = preResolutionSnapshot.results.find((row) => row.userId === ada.id);
    const preResolutionBoraRow = preResolutionSnapshot.results.find((row) => row.userId === bora.id);
    assert(Boolean(preResolutionAdaRow), "Ada should appear in the unresolved leaderboard.");
    assert(Boolean(preResolutionBoraRow), "Bora should appear in the unresolved leaderboard.");
    assert(
      preResolutionAdaRow?.answeredQuestions === 2 &&
        preResolutionAdaRow.answersSent === 5 &&
        preResolutionAdaRow.correctAnswers === 2 &&
        preResolutionAdaRow.accuracyLabel === "100%" &&
        preResolutionAdaRow.totalPoints === 5,
      "Unresolved leaderboard row for Ada did not preserve scored stats while increasing answers sent.",
    );
    assert(
      preResolutionBoraRow?.answeredQuestions === 2 &&
        preResolutionBoraRow.answersSent === 5 &&
        preResolutionBoraRow.correctAnswers === 0 &&
        preResolutionBoraRow.totalPoints === 1,
      "Unresolved leaderboard row for Bora did not preserve scored stats while increasing answers sent.",
    );

    const round2ScoreResult = await scoreHalisahaAnswers(round2.id);
    assert(round2ScoreResult.ok, "Round 2 scoring failed.");

    const postResolutionSnapshot = await getHalisahaPublicSnapshot(ada.id, ada.role);
    const shotsQuestion = postResolutionSnapshot.questions.find(
      (question) => question.prompt === "How many shots on target for RayNET?",
    );
    assert(Boolean(shotsQuestion), "Resolved shots question not found in public snapshot.");
    assert(
      shotsQuestion?.otherAnswers.some(
        (answer) => answer.displayName === "Bora Kaya" && answer.answerLabel === "7",
      ),
      "Resolved snapshot is missing Bora's answer in the Others data.",
    );

    const sessionToken = createSessionToken();
    await prisma.session.create({
      data: {
        userId: ada.id,
        sessionToken: sessionToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    nextServer = await startNextServer({
      ...process.env,
      DATABASE_URL: databaseUrl,
      DIRECT_DATABASE_URL: directDatabaseUrl,
    });

    const baseUrl = `http://127.0.0.1:${PORT}`;
    const expectedOthersButtonCount = postResolutionSnapshot.questions.length;
    const [desktopUi, mobileUi] = await Promise.all([
      verifyViewport({
        baseUrl,
        sessionToken,
        prompt: "How many shots on target for RayNET?",
        expectedOthersButtonCount,
        viewport: "desktop",
      }),
      verifyViewport({
        baseUrl,
        sessionToken,
        prompt: "How many shots on target for RayNET?",
        expectedOthersButtonCount,
        viewport: "mobile",
      }),
    ]);

    const summary = {
      schema,
      preResolutionLeaderboard: {
        ada: preResolutionAdaRow,
        bora: preResolutionBoraRow,
      },
      postResolutionOthers: shotsQuestion?.otherAnswers ?? [],
      ui: {
        desktop: desktopUi,
        mobile: mobileUi,
      },
    };

    assert(desktopUi.matchesExpectedButtonCount, "Desktop Others button count mismatch.");
    assert(desktopUi.modalContainsExpectedName, "Desktop Others modal is missing Bora Kaya.");
    assert(desktopUi.modalContainsExpectedAnswer, "Desktop Others modal is missing answer 7.");
    assert(mobileUi.matchesExpectedButtonCount, "Mobile Others button count mismatch.");
    assert(mobileUi.modalContainsExpectedName, "Mobile Others modal is missing Bora Kaya.");
    assert(mobileUi.modalContainsExpectedAnswer, "Mobile Others modal is missing answer 7.");

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    if (nextServer) {
      nextServer.child.kill();
      await sleep(1_000);
    }
    if (appPrisma) {
      await appPrisma.$disconnect();
    }
    await adminPrisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await adminPrisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
