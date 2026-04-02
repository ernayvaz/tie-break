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

function normalizeText(value) {
  return value.replace(/\s+/g, " ").trim();
}

function collectDuplicates(values) {
  const counts = new Map();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value);
}

async function ensureQuestionOverlayOpen(page) {
  let choosePlayerButton = page.getByRole("button", { name: /^choose player$/i }).first();
  if ((await choosePlayerButton.count()) > 0 && await choosePlayerButton.isVisible().catch(() => false)) {
    return choosePlayerButton;
  }

  let toggle = null;
  for (const delayMs of [0, 1000, 2000]) {
    if (delayMs > 0) {
      await page.waitForTimeout(delayMs);
    }

    const toggleButtons = page.locator("button[aria-label]");
    const toggleCount = await toggleButtons.count();

    for (let index = 0; index < toggleCount; index += 1) {
      const candidate = toggleButtons.nth(index);
      const label = await candidate.getAttribute("aria-label");
      if (label && /reveal lineups|hide lineups|reveal mvp vote|hide mvp vote/i.test(label)) {
        const visible = await candidate.isVisible().catch(() => false);
        if (visible) {
          toggle = candidate;
          break;
        }
        if (!toggle) {
          toggle = candidate;
        }
      }
    }
    if (toggle) {
      break;
    }
  }

  if (!toggle) {
    throw new Error("Could not find match overlay toggle button");
  }

  const toggleLabel = await toggle.getAttribute("aria-label");
  if (toggleLabel && /reveal/i.test(toggleLabel)) {
    await toggle.click({ force: true });
    await page.waitForTimeout(1200);
  }

  choosePlayerButton = page.getByRole("button", { name: /^choose player$/i }).first();
  try {
    await choosePlayerButton.waitFor({ timeout: 20000 });
  } catch (error) {
    const buttonLabels = await page
      .locator("button")
      .evaluateAll((elements) =>
        elements
          .map((element) => (element.textContent ?? "").replace(/\s+/g, " ").trim())
          .filter(Boolean)
          .slice(0, 50),
      );
    const bodySnippet = normalizeText(await page.locator("body").innerText()).slice(0, 700);
    throw new Error(
      `Choose player button not found after opening overlay. Buttons: ${JSON.stringify(buttonLabels)}. Body: ${bodySnippet}`,
      { cause: error },
    );
  }
  return choosePlayerButton;
}

async function inspectPicker(page) {
  const choosePlayerButton = await ensureQuestionOverlayOpen(page);
  await choosePlayerButton.click();

  const modalHeading = page.getByText(/choose one player|choose your mvp candidate/i).first();
  await modalHeading.waitFor({ timeout: 20000 });

  const optionButtons = page.locator("button").filter({ hasText: /pick/i });
  const count = await optionButtons.count();
  const labels = [];
  for (let index = 0; index < count; index += 1) {
    const text = normalizeText(await optionButtons.nth(index).innerText());
    labels.push(text.replace(/\s+pick$/i, "").trim());
  }

  return {
    choosePlayerButtonCount: await page.getByRole("button", { name: /^choose player$/i }).count(),
    pickerOptionLabels: labels,
    duplicatePickerLabels: collectDuplicates(labels),
  };
}

async function main() {
  if (!TOKEN) {
    throw new Error("Set TB_SESSION env to a production admin session token");
  }

  const results = {
    admin: { navMs: null, performanceLoadMs: null, loggedIn: false },
    desktop: { navMs: null, performanceLoadMs: null, choosePlayerButtonCount: 0, pickerOptionLabels: [], duplicatePickerLabels: [] },
    mobile: { navMs: null, performanceLoadMs: null, choosePlayerButtonCount: 0, pickerOptionLabels: [], duplicatePickerLabels: [] },
    errors: [],
  };

  const browser = await chromium.launch({ headless: true });

  try {
    const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await desktopContext.addCookies([
      {
        name: "tb_session",
        value: TOKEN,
        url: BASE,
        httpOnly: true,
        sameSite: "Lax",
        secure: true,
      },
    ]);

    const adminPage = await desktopContext.newPage();
    adminPage.on("pageerror", (error) => results.errors.push(`admin:${String(error)}`));
    results.admin = {
      ...results.admin,
      ...(await measureGoto(adminPage, `${BASE}/admin/halisaha`)),
    };
    results.admin.loggedIn = !adminPage.url().includes("/login");
    await adminPage.getByText("Players and guests", { exact: false }).first().waitFor({ timeout: 30000 });

    const desktopPage = await desktopContext.newPage();
    desktopPage.on("pageerror", (error) => results.errors.push(`desktop:${String(error)}`));
    results.desktop = {
      ...results.desktop,
      ...(await measureGoto(desktopPage, `${BASE}/halisaha`)),
      ...(await inspectPicker(desktopPage)),
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
      ...(await inspectPicker(mobilePage)),
    };

    await mobileContext.close();
    await desktopContext.close();

    console.log(JSON.stringify(results, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
