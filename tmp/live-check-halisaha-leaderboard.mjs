import { chromium, devices } from "playwright";

const BASE = "https://www.tie-break.uk";
const TOKEN = process.env.TB_SESSION || "";

async function performanceLoadMs(page) {
  return page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    if (nav && "loadEventEnd" in nav && nav.loadEventEnd > 0) {
      return Math.round(nav.loadEventEnd);
    }
    const timing = performance.timing;
    if (timing.loadEventEnd && timing.navigationStart) {
      return timing.loadEventEnd - timing.navigationStart;
    }
    return null;
  });
}

async function measureGoto(page, url) {
  const startedAt = Date.now();
  await page.goto(url, { waitUntil: "domcontentloaded" });
  return {
    navMs: Date.now() - startedAt,
    performanceLoadMs: await performanceLoadMs(page),
  };
}

async function openLeaderboard(page) {
  const leaderboardButton = page.getByRole("button", { name: /leaderboard/i }).first();
  await leaderboardButton.waitFor({ timeout: 30000 });
  await leaderboardButton.click();
  await page.waitForTimeout(1200);
}

async function inspectDesktopLeaderboard(page) {
  await openLeaderboard(page);

  const rows = page.locator("table tbody tr");
  const rowCount = await rows.count();
  const firstRowName = rowCount > 0
    ? ((await rows.nth(0).locator("td").nth(1).innerText()).trim().replace(/\s+/g, " "))
    : null;
  const firstRowPoints = rowCount > 0
    ? ((await rows.nth(0).locator("td").nth(6).innerText()).trim().replace(/\s+/g, " "))
    : null;
  const placeholderText = await page.getByText(/temporary podium preview|players start answering/i).count();
  const gateText = await page.getByText(/unlock after the 24-hour MVP vote|results unlock after/i).count();
  const bodyText = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();

  return {
    rowCount,
    firstRowName,
    firstRowPoints,
    showsPlaceholderNotice: placeholderText > 0,
    showsGateNotice: gateText > 0,
    bodySnippet: bodyText.slice(0, 500),
  };
}

async function inspectMobileLeaderboard(page) {
  await openLeaderboard(page);

  const placeholderNotice = page.getByText(/temporary podium preview|players start answering|answers are scored/i).first();
  const gateNotice = page.getByText(/unlock after the 24-hour MVP vote|results unlock after/i).first();
  const mobileCards = page.locator("ul > li");
  const cardCount = await mobileCards.count();
  const firstCardText = cardCount > 0
    ? (await mobileCards.nth(0).innerText()).trim().replace(/\s+/g, " ")
    : null;
  const bodyText = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();

  return {
    cardCount,
    firstCardText,
    showsPlaceholderNotice: (await placeholderNotice.count()) > 0,
    showsGateNotice: (await gateNotice.count()) > 0,
    bodySnippet: bodyText.slice(0, 500),
  };
}

async function main() {
  if (!TOKEN) {
    throw new Error("Set TB_SESSION env to a production admin session token");
  }

  const results = {
    admin: { navMs: null, performanceLoadMs: null, loggedIn: false },
    desktop: { navMs: null, performanceLoadMs: null, rowCount: 0, firstRowName: null, firstRowPoints: null, showsPlaceholderNotice: false, showsGateNotice: false, bodySnippet: null },
    mobile: { navMs: null, performanceLoadMs: null, cardCount: 0, firstCardText: null, showsPlaceholderNotice: false, showsGateNotice: false, bodySnippet: null },
    sameTopEntryAcrossDesktopAndMobile: null,
    errors: [],
  };

  const browser = await chromium.launch({ headless: true });

  try {
    const adminContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await adminContext.addCookies([
      {
        name: "tb_session",
        value: TOKEN,
        url: BASE,
        httpOnly: true,
        sameSite: "Lax",
        secure: true,
      },
    ]);

    const adminPage = await adminContext.newPage();
    adminPage.on("pageerror", (error) => results.errors.push(`admin:${String(error)}`));
    results.admin = {
      ...results.admin,
      ...(await measureGoto(adminPage, `${BASE}/admin/halisaha`)),
    };
    results.admin.loggedIn = !adminPage.url().includes("/login");
    await adminPage.getByText("Players and guests", { exact: false }).first().waitFor({ timeout: 30000 });

    const desktopPage = await adminContext.newPage();
    desktopPage.on("pageerror", (error) => results.errors.push(`desktop:${String(error)}`));
    results.desktop = {
      ...results.desktop,
      ...(await measureGoto(desktopPage, `${BASE}/halisaha`)),
      ...(await inspectDesktopLeaderboard(desktopPage)),
    };

    const mobileContext = await browser.newContext({
      ...devices["iPhone 13"],
    });
    await mobileContext.addCookies([
      {
        name: "tb_session",
        value: TOKEN,
        url: BASE,
        httpOnly: true,
        sameSite: "Lax",
        secure: true,
      },
    ]);

    const mobilePage = await mobileContext.newPage();
    mobilePage.on("pageerror", (error) => results.errors.push(`mobile:${String(error)}`));
    results.mobile = {
      ...results.mobile,
      ...(await measureGoto(mobilePage, `${BASE}/halisaha`)),
      ...(await inspectMobileLeaderboard(mobilePage)),
    };

    if (results.desktop.firstRowName && results.mobile.firstCardText) {
      results.sameTopEntryAcrossDesktopAndMobile =
        results.mobile.firstCardText.toLowerCase().includes(results.desktop.firstRowName.toLowerCase()) &&
        (results.desktop.firstRowPoints ? results.mobile.firstCardText.includes(results.desktop.firstRowPoints) : true);
    }

    await mobileContext.close();
    await adminContext.close();

    console.log(JSON.stringify(results, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
