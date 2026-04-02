import { chromium, devices } from "playwright";

const BASE = "https://www.tie-break.uk";
const TOKEN = process.env.TB_SESSION || "";

async function msSinceNav(page) {
  return page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    if (nav && "loadEventEnd" in nav && nav.loadEventEnd > 0) {
      return Math.round(nav.loadEventEnd);
    }
    const t = performance.timing;
    if (t.loadEventEnd && t.navigationStart) {
      return t.loadEventEnd - t.navigationStart;
    }
    return null;
  });
}

function squadTableLocator(page) {
  return page
    .getByText("Current squad size:", { exact: false })
    .locator("xpath=ancestor::div[contains(@class,'overflow-x-auto')][1]")
    .locator("table")
    .first();
}

async function readSquadRowAnchor(table) {
  const row = table.locator("tbody tr").first();
  await row.waitFor({ timeout: 15000 });

  const participantId = (await row.getAttribute("data-participant-id"))?.trim() || null;
  const playerName = (await row.locator("td").first().locator("div.font-medium").textContent())?.trim();
  if (!playerName) {
    throw new Error("Could not read anchor player name from first squad row");
  }

  return { participantId, playerName };
}

async function squadRowByParticipantId(table, participantId) {
  const row = table.locator(`tbody tr[data-participant-id="${participantId}"]`).first();
  if ((await row.count()) === 0) {
    throw new Error(`No squad row for participant "${participantId}"`);
  }
  return row;
}

async function squadRowByPlayerName(table, playerName) {
  const rows = table.locator("tbody tr");
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    const text = (await row.locator("td").first().locator("div.font-medium").textContent())?.trim();
    if (text === playerName) {
      return row;
    }
  }
  throw new Error(`No squad row for player "${playerName}"`);
}

async function squadRowByAnchor(table, anchor) {
  if (anchor.participantId) {
    const row = table.locator(`tbody tr[data-participant-id="${anchor.participantId}"]`).first();
    if ((await row.count()) > 0) {
      return squadRowByParticipantId(table, anchor.participantId);
    }
  }
  return squadRowByPlayerName(table, anchor.playerName);
}

async function main() {
  if (!TOKEN) {
    throw new Error("Set TB_SESSION env to admin session token");
  }

  const results = {
    adminNavMs: null,
    adminPerformanceLoadMs: null,
    halisahaNavMs: null,
    halisahaPerformanceLoadMs: null,
    hasShownColumn: false,
    anchorParticipantId: null,
    anchorPlayerName: null,
    rowLocatorStrategy: "player_name",
    overrideSaved: false,
    resetToDefault: false,
    publicShowsCustomName: false,
    mobileTabTransform: null,
    cleanupOk: false,
    errors: [],
  };

  const browser = await chromium.launch({ headless: true });

  try {
    const desk = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    await desk.addCookies([
      {
        name: "tb_session",
        value: TOKEN,
        url: BASE,
        httpOnly: true,
        sameSite: "Lax",
        secure: true,
      },
    ]);
    const adminPage = await desk.newPage();
    adminPage.on("pageerror", (e) => results.errors.push(`admin:${String(e)}`));

    const t0 = Date.now();
    await adminPage.goto(`${BASE}/admin/halisaha`, { waitUntil: "domcontentloaded" });
    results.adminNavMs = Date.now() - t0;
    results.adminPerformanceLoadMs = await msSinceNav(adminPage);

    if (adminPage.url().includes("/login")) {
      throw new Error("Session cookie not accepted (redirected to login)");
    }

    await adminPage.getByText("Players and guests", { exact: false }).first().waitFor({
      timeout: 30000,
    });
    results.hasShownColumn = (await adminPage.getByText("Shown on Halisaha").count()) > 0;

    let table = squadTableLocator(adminPage);
    await table.waitFor({ timeout: 15000 });

    const anchor = await readSquadRowAnchor(table);
    results.anchorParticipantId = anchor.participantId;
    results.anchorPlayerName = anchor.playerName;
    results.rowLocatorStrategy = anchor.participantId ? "participant_id" : "player_name_fallback";

    let row = await squadRowByAnchor(table, anchor);
    let input = row.locator("input").first();
    await input.waitFor({ timeout: 15000 });
    const defaultName = (await input.inputValue()).trim();
    const custom = `LiveVerify ${Date.now()}`;

    await input.fill(custom);
    await row.getByRole("button", { name: "Save" }).click();
    await adminPage.getByText(/Player assignment updated|Assignment updated/i).waitFor({
      timeout: 20000,
    });
    await adminPage.waitForLoadState("networkidle").catch(() => {});
    results.overrideSaved = true;

    await adminPage.reload({ waitUntil: "domcontentloaded" });
    table = squadTableLocator(adminPage);
    await table.waitFor({ timeout: 15000 });
    row = await squadRowByAnchor(table, anchor);
    input = row.locator("input").first();
    await input.waitFor({ timeout: 15000 });
    const afterReload = (await input.inputValue()).trim();
    if (afterReload !== custom) {
      throw new Error(`Expected override "${custom}" after reload, got "${afterReload}"`);
    }

    const useCurrent = row.getByRole("button", { name: /use current name/i });
    if ((await useCurrent.count()) > 0) {
      await useCurrent.click();
    } else {
      await input.fill(defaultName);
    }
    await row.getByRole("button", { name: "Save" }).click();
    await adminPage.getByText(/Player assignment updated|Assignment updated/i).waitFor({
      timeout: 20000,
    });
    await adminPage.waitForLoadState("networkidle").catch(() => {});
    results.resetToDefault = true;

    const pub = await browser.newContext({
      ...devices["iPhone 13"],
    });
    await pub.addCookies([
      {
        name: "tb_session",
        value: TOKEN,
        url: BASE,
        httpOnly: true,
        sameSite: "Lax",
        secure: true,
      },
    ]);
    const halPage = await pub.newPage();
    halPage.on("pageerror", (e) => results.errors.push(`halisaha:${String(e)}`));

    const t1 = Date.now();
    await halPage.goto(`${BASE}/halisaha`, { waitUntil: "domcontentloaded" });
    results.halisahaNavMs = Date.now() - t1;
    results.halisahaPerformanceLoadMs = await msSinceNav(halPage);

    const leaderboardBtn = halPage.getByRole("button", { name: /leaderboard/i }).first();
    await leaderboardBtn.waitFor({ timeout: 30000 });
    const tabRow = leaderboardBtn.locator(
      "xpath=ancestor::div[contains(@class,'flex')][contains(@class,'max-w-full')][1]",
    );
    results.mobileTabTransform = await tabRow.evaluate((el) => window.getComputedStyle(el).transform);

    table = squadTableLocator(adminPage);
    await table.waitFor({ timeout: 15000 });
    row = await squadRowByAnchor(table, anchor);
    input = row.locator("input").first();
    await input.waitFor({ timeout: 15000 });
    await input.fill(custom);
    await row.getByRole("button", { name: "Save" }).click();
    await adminPage.getByText(/Player assignment updated|Assignment updated/i).waitFor({
      timeout: 20000,
    });
    await adminPage.waitForLoadState("networkidle").catch(() => {});

    await halPage.reload({ waitUntil: "domcontentloaded" });
    await halPage.waitForTimeout(800);
    // With published questions, opening lineups shows the challenge overlay and *unmounts* pitch
    // names (shouldRenderMatchdayPitchOverlay). Names are on the closed pitch; if MVP/questions
    // forced lineups open, press Hide first.
    let body = await halPage.locator("body").innerText();
    const hideLineups = halPage.getByRole("button", { name: /hide lineups|hide mvp vote/i });
    if ((await hideLineups.count()) > 0) {
      await hideLineups.first().click();
      await halPage.waitForTimeout(1200);
      body = await halPage.locator("body").innerText();
    }
    // Pitch labels render names in uppercase (see splitThreeWordPlayerName).
    results.publicShowsCustomName = body.toLowerCase().includes(custom.toLowerCase());

    await pub.close();

    table = squadTableLocator(adminPage);
    await table.waitFor({ timeout: 15000 });
    row = await squadRowByAnchor(table, anchor);
    input = row.locator("input").first();
    await input.waitFor({ timeout: 15000 });
    const useCurrent2 = row.getByRole("button", { name: /use current name/i });
    if ((await useCurrent2.count()) > 0) {
      await useCurrent2.click();
    } else {
      await input.fill(defaultName);
    }
    await row.getByRole("button", { name: "Save" }).click();
    await adminPage.getByText(/Player assignment updated|Assignment updated/i).waitFor({
      timeout: 20000,
    });
    await adminPage.waitForLoadState("networkidle").catch(() => {});
    results.cleanupOk = true;

    await desk.close();

    console.log(
      JSON.stringify(
        {
          ...results,
          mobileTabTransformIsMatrix:
            typeof results.mobileTabTransform === "string" &&
            results.mobileTabTransform !== "none",
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
