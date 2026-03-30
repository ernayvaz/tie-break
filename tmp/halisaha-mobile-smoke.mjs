import fs from "fs/promises";
import path from "path";
import { chromium, devices } from "playwright";

const baseUrl = process.env.HALISAHA_BASE_URL ?? "http://localhost:3015";
const sessionToken = process.env.HALISAHA_SESSION_TOKEN;

if (!sessionToken) {
  throw new Error("HALISAHA_SESSION_TOKEN is required.");
}

const outputDir = path.resolve("tmp", "halisaha-mobile-smoke");
await fs.mkdir(outputDir, { recursive: true });

async function addSessionCookie(context) {
  await context.addCookies([
    {
      name: "tb_session",
      value: sessionToken,
      url: baseUrl,
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
    },
  ]);
}

async function readState(page) {
  return page.evaluate(() => {
    const header = document.getElementById("app-header");
    const shell = document.querySelector(".halisaha-shell");
    const debugBadge = document.querySelector(".halisaha-viewport-debug");
    const pagerTrack = document.querySelector(".halisaha-mobile-pager-track");
    const heroPanel = document.querySelector(".halisaha-mobile-panel-hero");
    const pitchPanel = document.querySelector(".halisaha-mobile-panel-pitch");
    const headerRect = header?.getBoundingClientRect();
    const heroRect = heroPanel?.getBoundingClientRect();
    const pitchRect = pitchPanel?.getBoundingClientRect();

    return {
      htmlDataset: { ...document.documentElement.dataset },
      bodyDataset: { ...document.body.dataset },
      shellDataset: shell
        ? Object.fromEntries(
            Object.entries(shell.dataset).map(([key, value]) => [key, value ?? null]),
          )
        : null,
      header: header
        ? {
            opacity: window.getComputedStyle(header).opacity,
            pointerEvents: window.getComputedStyle(header).pointerEvents,
            transform: window.getComputedStyle(header).transform,
            top: headerRect?.top ?? null,
            bottom: headerRect?.bottom ?? null,
            height: headerRect?.height ?? null,
          }
        : null,
      pagerTrackTransform: pagerTrack ? window.getComputedStyle(pagerTrack).transform : null,
      heroPanel: heroRect
        ? {
            top: heroRect.top,
            bottom: heroRect.bottom,
            height: heroRect.height,
          }
        : null,
      pitchPanel: pitchRect
        ? {
            top: pitchRect.top,
            bottom: pitchRect.bottom,
            height: pitchRect.height,
          }
        : null,
      debugText: debugBadge?.textContent?.replace(/\s+/g, " ").trim() ?? null,
      bodyTextSample: document.body.innerText.replace(/\s+/g, " ").slice(0, 320),
    };
  });
}

async function swipePager(page, direction) {
  await page.evaluate((swipeDirection) => {
    const pager = document.querySelector(".halisaha-mobile-pager");
    if (!(pager instanceof HTMLElement)) {
      throw new Error("Mobile pager not found.");
    }

    const rect = pager.getBoundingClientRect();
    const startY = swipeDirection === "down" ? rect.height * 0.7 : rect.height * 0.3;
    const endY = swipeDirection === "down" ? rect.height * 0.25 : rect.height * 0.75;
    const clientX = rect.left + rect.width / 2;

    const createTouch = (clientY) =>
      new Touch({
        identifier: 1,
        target: pager,
        clientX,
        clientY,
        pageX: clientX,
        pageY: clientY,
        radiusX: 8,
        radiusY: 8,
        force: 0.5,
      });

    const startTouch = createTouch(startY);
    const moveTouch = createTouch(endY);

    pager.dispatchEvent(
      new TouchEvent("touchstart", {
        bubbles: true,
        cancelable: true,
        touches: [startTouch],
        targetTouches: [startTouch],
        changedTouches: [startTouch],
      }),
    );
    pager.dispatchEvent(
      new TouchEvent("touchmove", {
        bubbles: true,
        cancelable: true,
        touches: [moveTouch],
        targetTouches: [moveTouch],
        changedTouches: [moveTouch],
      }),
    );
    pager.dispatchEvent(
      new TouchEvent("touchend", {
        bubbles: true,
        cancelable: true,
        touches: [],
        targetTouches: [],
        changedTouches: [moveTouch],
      }),
    );
  }, direction);
}

async function createContext(config) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext(config);
  await addSessionCookie(context);
  return { browser, context };
}

async function runPortraitScenario() {
  const { browser, context } = await createContext({
    ...devices["iPhone 13"],
  });

  try {
    const page = await context.newPage();
    await page.goto(`${baseUrl}/halisaha?halisaha-debug=1`, {
      waitUntil: "networkidle",
    });
    await page.screenshot({
      path: path.join(outputDir, "portrait-gate.png"),
    });

    return {
      rotateGateVisible: await page.getByText("Rotate your phone to use Halisaha Mode").isVisible(),
      state: await readState(page),
    };
  } finally {
    await context.close();
    await browser.close();
  }
}

async function runLandscapeScenario() {
  const iphone13 = devices["iPhone 13"];
  const { browser, context } = await createContext({
    ...iphone13,
    viewport: { width: 844, height: 390 },
    screen: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });

  try {
    const page = await context.newPage();
    await page.goto(`${baseUrl}/halisaha?halisaha-debug=1`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(500);

    const initialState = await readState(page);
    await page.screenshot({
      path: path.join(outputDir, "landscape-hero.png"),
    });

    await swipePager(page, "down");
    await page.waitForTimeout(650);
    const pitchState = await readState(page);
    await page.screenshot({
      path: path.join(outputDir, "landscape-pitch.png"),
    });

    await swipePager(page, "up");
    await page.waitForTimeout(650);
    const returnedState = await readState(page);
    await page.screenshot({
      path: path.join(outputDir, "landscape-return-hero.png"),
    });

    return {
      initialState,
      pitchState,
      returnedState,
    };
  } finally {
    await context.close();
    await browser.close();
  }
}

async function runDesktopScenario() {
  const { browser, context } = await createContext({
    viewport: { width: 1280, height: 800 },
    screen: { width: 1280, height: 800 },
  });

  try {
    const page = await context.newPage();
    await page.goto(`${baseUrl}/halisaha?halisaha-debug=1`, {
      waitUntil: "networkidle",
    });
    await page.screenshot({
      path: path.join(outputDir, "desktop.png"),
    });

    return {
      state: await readState(page),
    };
  } finally {
    await context.close();
    await browser.close();
  }
}

const results = {
  portrait: await runPortraitScenario(),
  landscape: await runLandscapeScenario(),
  desktop: await runDesktopScenario(),
};

await fs.writeFile(
  path.join(outputDir, "results.json"),
  JSON.stringify(results, null, 2),
  "utf8",
);

console.log(JSON.stringify(results, null, 2));
