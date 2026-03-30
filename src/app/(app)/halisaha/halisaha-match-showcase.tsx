"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  type KeyboardEvent,
  type TouchEvent as ReactTouchEvent,
  type WheelEvent as ReactWheelEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { HalisahaLeaderboardBoard } from "@/components/halisaha/halisaha-leaderboard-board";
import { HalisahaChallengeOverlay } from "@/components/halisaha/halisaha-challenge-overlay";
import { HalisahaPostMatchMvpVote } from "@/components/halisaha/halisaha-post-match-mvp-vote";
import { HalisahaResultsGateCard } from "@/components/halisaha/halisaha-results-gate-card";
import { getPitchSpot } from "@/lib/halisaha/config";
import { isHalisahaPhoneLikeViewport } from "@/lib/halisaha/mobile-landscape";
import { getHalisahaPredictionLockAt } from "@/lib/halisaha/match-state";
import { shouldRevealWinnerPercentages } from "@/lib/halisaha/rules";
import type { HalisahaPublicSnapshot } from "@/lib/halisaha/server";
import crestAsset from "../../../../2_LOGO-fitted.png";
import midfieldBallAsset from "../../../../TOP 2.png";
import trophyAsset from "../../../../kupa.png";

type PlayerSpot = {
  name: string;
  x: number;
  y: number;
};

type ShowcaseTab = "matchday" | "leaderboard";
type MobileLandscapePanel = "hero" | "pitch";

const PITCH_TRANSITION_TIMEOUT_MS = 280;
const MOBILE_PAGER_TOUCH_THRESHOLD_PX = 18;
const MOBILE_PAGER_WHEEL_THRESHOLD_PX = 18;
const MOBILE_PAGER_COOLDOWN_MS = 320;

function getMobileLandscapeViewportState() {
  if (typeof window === "undefined") {
    return {
      isPhoneLike: false,
      isLandscape: false,
      viewportWidth: 0,
      viewportHeight: 0,
      hasCoarsePointer: false,
      maxTouchPoints: 0,
    };
  }

  const widthCandidates = [
    window.innerWidth,
    document.documentElement.clientWidth,
    Math.round(window.visualViewport?.width ?? Number.POSITIVE_INFINITY),
  ].filter((value) => Number.isFinite(value) && value > 0);
  const heightCandidates = [
    window.innerHeight,
    document.documentElement.clientHeight,
    Math.round(window.visualViewport?.height ?? Number.POSITIVE_INFINITY),
  ].filter((value) => Number.isFinite(value) && value > 0);
  const viewportWidth = widthCandidates.length > 0 ? Math.min(...widthCandidates) : window.innerWidth;
  const viewportHeight =
    heightCandidates.length > 0 ? Math.min(...heightCandidates) : window.innerHeight;
  const hasCoarsePointer =
    window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;

  return {
    isPhoneLike: isHalisahaPhoneLikeViewport({
      viewportWidth,
      viewportHeight,
      hasCoarsePointer,
      maxTouchPoints: navigator.maxTouchPoints,
    }),
    isLandscape: window.matchMedia("(orientation: landscape)").matches,
    viewportWidth,
    viewportHeight,
    hasCoarsePointer,
    maxTouchPoints: navigator.maxTouchPoints,
  };
}

async function tryRequestLandscapeOrientation() {
  if (typeof window === "undefined") {
    return;
  }

  const orientation = window.screen?.orientation as
    | (ScreenOrientation & {
        lock?: (orientation: "portrait" | "landscape" | "any") => Promise<void>;
      })
    | undefined;
  if (!orientation?.lock) {
    return;
  }

  try {
    await orientation.lock("landscape");
  } catch {
    // Best-effort only: browsers often require fullscreen or a trusted gesture.
  }
}

function getGestureTargetElement(target: EventTarget | null) {
  if (target instanceof HTMLElement) {
    return target;
  }

  if (target instanceof Node) {
    return target.parentElement;
  }

  return null;
}

function canScrollableAncestorConsumeDirection(
  target: EventTarget | null,
  boundary: HTMLElement | null,
  direction: "up" | "down",
) {
  const startElement = getGestureTargetElement(target);
  if (!startElement || !boundary) {
    return false;
  }

  let current: HTMLElement | null = startElement;
  while (current && current !== boundary) {
    const overflowY = window.getComputedStyle(current).overflowY;
    const canScrollHere =
      (overflowY === "auto" || overflowY === "scroll") &&
      current.scrollHeight > current.clientHeight + 1;

    if (canScrollHere) {
      if (direction === "down") {
        return current.scrollTop + current.clientHeight < current.scrollHeight - 1;
      }

      return current.scrollTop > 0;
    }

    current = current.parentElement;
  }

  return false;
}

export function HalisahaMatchShowcase({
  snapshot,
  viewerCanManageOwnAnswerLock,
  forcePostMatchMvpVote = false,
}: {
  snapshot: HalisahaPublicSnapshot;
  viewerCanManageOwnAnswerLock: boolean;
  forcePostMatchMvpVote?: boolean;
}) {
  const searchParams = useSearchParams();
  const shouldForceVoteOverlay =
    forcePostMatchMvpVote &&
    snapshot.postMatchMvpVote.requiresVote &&
    !snapshot.postMatchMvpVote.hasUserVoted;
  const shouldPreviewAdminMvpVote =
    viewerCanManageOwnAnswerLock &&
    snapshot.userAnswersLocked &&
    !snapshot.postMatchMvpVote.hasUserVoted &&
    !snapshot.postMatchMvpVote.requiresVote;
  const shouldAutoOpenVoteOverlay = shouldForceVoteOverlay || shouldPreviewAdminMvpVote;
  const [showLineups, setShowLineups] = useState(shouldAutoOpenVoteOverlay);
  const [activeTab, setActiveTab] = useState<ShowcaseTab>("matchday");
  const [mobileLandscapePanel, setMobileLandscapePanel] =
    useState<MobileLandscapePanel>("hero");
  const [mobileViewportState, setMobileViewportState] = useState(() =>
    getMobileLandscapeViewportState(),
  );
  const mobilePagerRef = useRef<HTMLDivElement | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const touchTargetRef = useRef<EventTarget | null>(null);
  const lastPanelChangeAtRef = useRef(0);
  const kickoffAt = useMemo(
    () => new Date(snapshot.match.kickoffAtIso),
    [snapshot.match.kickoffAtIso],
  );
  const [countdown, setCountdown] = useState(() => formatCountdown(kickoffAt));
  const [predictionWindowClosed, setPredictionWindowClosed] = useState(() =>
    viewerCanManageOwnAnswerLock ? false : new Date() >= getHalisahaPredictionLockAt({ kickoffAt }),
  );
  const homeTeam = {
    name: snapshot.match.homeTeamName,
    lineup: buildTeamLineup(snapshot, "home"),
  };
  const awayTeam = {
    name: snapshot.match.awayTeamName,
    lineup: buildTeamLineup(snapshot, "away"),
  };
  const viewerCanRevealWinnerPercentages = shouldRevealWinnerPercentages({
    phase: snapshot.match.phase,
    userAnswersLocked: snapshot.userAnswersLocked,
    canRevealResults: snapshot.match.canRevealResults,
    hasWinnerVoteSummary: Boolean(snapshot.winnerVoteSummary),
  });

  const hasPublishedHalisahaQuestions = snapshot.questions.length > 0;
  const shouldPreviewAdminMvpVoteForLayout =
    viewerCanManageOwnAnswerLock &&
    snapshot.userAnswersLocked &&
    !snapshot.postMatchMvpVote.hasUserVoted &&
    !snapshot.postMatchMvpVote.requiresVote;
  const shouldShowPostMatchMvpVoteForLayout =
    (snapshot.postMatchMvpVote.requiresVote || shouldPreviewAdminMvpVoteForLayout) &&
    !snapshot.postMatchMvpVote.hasUserVoted;
  const halisahaPitchOverlayOpen =
    activeTab === "matchday" &&
    showLineups &&
    (shouldShowPostMatchMvpVoteForLayout || hasPublishedHalisahaQuestions);
  const shouldRequireMobileLandscape = mobileViewportState.isPhoneLike;
  const shouldShowRotateGate =
    shouldRequireMobileLandscape && !mobileViewportState.isLandscape;
  const isImmersiveMobileMatchday =
    shouldRequireMobileLandscape &&
    mobileViewportState.isLandscape &&
    activeTab === "matchday";
  const shouldShowViewportDebug =
    process.env.NODE_ENV !== "production" && searchParams.get("halisaha-debug") === "1";

  useEffect(() => {
    const tick = () => setCountdown(formatCountdown(kickoffAt));
    tick();
    const interval = window.setInterval(tick, 60_000);
    return () => window.clearInterval(interval);
  }, [kickoffAt]);

  useEffect(() => {
    if (viewerCanManageOwnAnswerLock) {
      setPredictionWindowClosed(false);
      return;
    }

    const predictionLockAt = getHalisahaPredictionLockAt({ kickoffAt });
    const updateState = () => {
      setPredictionWindowClosed(new Date() >= predictionLockAt);
    };

    updateState();
    if (predictionLockAt.getTime() <= Date.now()) {
      return;
    }

    const timeoutId = window.setTimeout(updateState, predictionLockAt.getTime() - Date.now());
    return () => window.clearTimeout(timeoutId);
  }, [kickoffAt, viewerCanManageOwnAnswerLock]);

  useEffect(() => {
    const { documentElement, body } = document;
    const previousHtmlOverflowX = documentElement.style.overflowX;
    const previousBodyOverflowX = body.style.overflowX;

    documentElement.style.overflowX = "hidden";
    body.style.overflowX = "hidden";

    return () => {
      documentElement.style.overflowX = previousHtmlOverflowX;
      body.style.overflowX = previousBodyOverflowX;
    };
  }, []);

  useEffect(() => {
    const updateViewportState = () => {
      setMobileViewportState(getMobileLandscapeViewportState());
    };

    updateViewportState();

    window.addEventListener("resize", updateViewportState);
    window.addEventListener("orientationchange", updateViewportState);

    return () => {
      window.removeEventListener("resize", updateViewportState);
      window.removeEventListener("orientationchange", updateViewportState);
    };
  }, []);

  useEffect(() => {
    if (!shouldShowRotateGate) {
      return;
    }

    void tryRequestLandscapeOrientation();
  }, [shouldShowRotateGate]);

  useEffect(() => {
    if (!shouldRequireMobileLandscape) {
      return;
    }

    const { documentElement, body } = document;
    const previousHtmlOverflowY = documentElement.style.overflowY;
    const previousBodyOverflowY = body.style.overflowY;
    const previousHtmlOverscrollBehaviorY = documentElement.style.overscrollBehaviorY;
    const previousBodyOverscrollBehaviorY = body.style.overscrollBehaviorY;
    const shouldLockVerticalViewport = shouldShowRotateGate || isImmersiveMobileMatchday;

    if (shouldLockVerticalViewport) {
      documentElement.style.overflowY = "hidden";
      body.style.overflowY = "hidden";
      documentElement.style.overscrollBehaviorY = "none";
      body.style.overscrollBehaviorY = "none";
    }

    return () => {
      documentElement.style.overflowY = previousHtmlOverflowY;
      body.style.overflowY = previousBodyOverflowY;
      documentElement.style.overscrollBehaviorY = previousHtmlOverscrollBehaviorY;
      body.style.overscrollBehaviorY = previousBodyOverscrollBehaviorY;
    };
  }, [isImmersiveMobileMatchday, shouldRequireMobileLandscape, shouldShowRotateGate]);

  useEffect(() => {
    const { documentElement, body } = document;

    if (!isImmersiveMobileMatchday) {
      delete documentElement.dataset.halisahaMobileLandscape;
      delete documentElement.dataset.halisahaMobilePanel;
      delete body.dataset.halisahaMobileLandscape;
      delete body.dataset.halisahaMobilePanel;
      return;
    }

    documentElement.dataset.halisahaMobileLandscape = "true";
    documentElement.dataset.halisahaMobilePanel = mobileLandscapePanel;
    body.dataset.halisahaMobileLandscape = "true";
    body.dataset.halisahaMobilePanel = mobileLandscapePanel;

    return () => {
      delete documentElement.dataset.halisahaMobileLandscape;
      delete documentElement.dataset.halisahaMobilePanel;
      delete body.dataset.halisahaMobileLandscape;
      delete body.dataset.halisahaMobilePanel;
    };
  }, [isImmersiveMobileMatchday, mobileLandscapePanel]);

  useEffect(() => {
    if (!shouldAutoOpenVoteOverlay) {
      return;
    }

    setActiveTab("matchday");
    setShowLineups(true);
  }, [shouldAutoOpenVoteOverlay]);

  const handleTabChange = (nextTab: ShowcaseTab) => {
    setActiveTab(nextTab);

    if (shouldAutoOpenVoteOverlay) {
      setShowLineups(true);
      return;
    }

    if (nextTab === "leaderboard") {
      setShowLineups(false);
    }
  };

  useEffect(() => {
    if (!isImmersiveMobileMatchday) {
      setMobileLandscapePanel("hero");
      return;
    }

    setMobileLandscapePanel("hero");
  }, [isImmersiveMobileMatchday, snapshot.match.id]);

  const resetPagerTouchState = useCallback(() => {
    touchStartYRef.current = null;
    touchTargetRef.current = null;
  }, []);

  const trySwitchMobileLandscapePanel = useCallback((
    direction: "up" | "down",
    target: EventTarget | null,
  ) => {
    if (!isImmersiveMobileMatchday) {
      return false;
    }

    const boundary = mobilePagerRef.current;
    const targetElement = getGestureTargetElement(target);
    if (!boundary || !targetElement || !boundary.contains(targetElement)) {
      return false;
    }

    if (direction === "down" && mobileLandscapePanel !== "hero") {
      return false;
    }

    if (direction === "up" && mobileLandscapePanel !== "pitch") {
      return false;
    }

    if (direction === "up" && showLineups) {
      return false;
    }

    if (canScrollableAncestorConsumeDirection(target, boundary, direction)) {
      return false;
    }

    const now = Date.now();
    if (now - lastPanelChangeAtRef.current < MOBILE_PAGER_COOLDOWN_MS) {
      return false;
    }

    lastPanelChangeAtRef.current = now;
    setMobileLandscapePanel(direction === "down" ? "pitch" : "hero");
    return true;
  }, [isImmersiveMobileMatchday, mobileLandscapePanel, showLineups]);

  const handleMobilePagerWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!isImmersiveMobileMatchday) {
      return;
    }

    if (Math.abs(event.deltaY) < MOBILE_PAGER_WHEEL_THRESHOLD_PX) {
      return;
    }

    const direction = event.deltaY > 0 ? "down" : "up";
    if (trySwitchMobileLandscapePanel(direction, event.target)) {
      event.preventDefault();
    }
  };

  const handleMobilePagerTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (!isImmersiveMobileMatchday) {
      return;
    }

    touchStartYRef.current = event.touches[0]?.clientY ?? null;
    touchTargetRef.current = event.target;
  };

  const handleMobilePagerTouchMove = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (!isImmersiveMobileMatchday || touchStartYRef.current === null) {
      return;
    }

    const currentY = event.touches[0]?.clientY;
    if (typeof currentY !== "number") {
      return;
    }

    const deltaY = currentY - touchStartYRef.current;
    if (Math.abs(deltaY) < MOBILE_PAGER_TOUCH_THRESHOLD_PX) {
      return;
    }

    const direction = deltaY < 0 ? "down" : "up";
    if (trySwitchMobileLandscapePanel(direction, touchTargetRef.current)) {
      event.preventDefault();
      resetPagerTouchState();
    }
  };

  const handleRequestLandscape = async () => {
    await tryRequestLandscapeOrientation();
    setMobileViewportState(getMobileLandscapeViewportState());
  };

  useEffect(() => {
    if (!isImmersiveMobileMatchday) {
      return;
    }

    const handleWindowWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) < MOBILE_PAGER_WHEEL_THRESHOLD_PX) {
        return;
      }

      const direction = event.deltaY > 0 ? "down" : "up";
      if (trySwitchMobileLandscapePanel(direction, event.target)) {
        event.preventDefault();
      }
    };

    const handleWindowTouchStart = (event: TouchEvent) => {
      touchStartYRef.current = event.touches[0]?.clientY ?? null;
      touchTargetRef.current = event.target;
    };

    const handleWindowTouchMove = (event: TouchEvent) => {
      if (touchStartYRef.current === null) {
        return;
      }

      const currentY = event.touches[0]?.clientY;
      if (typeof currentY !== "number") {
        return;
      }

      const deltaY = currentY - touchStartYRef.current;
      if (Math.abs(deltaY) < MOBILE_PAGER_TOUCH_THRESHOLD_PX) {
        return;
      }

      const direction = deltaY < 0 ? "down" : "up";
      if (trySwitchMobileLandscapePanel(direction, touchTargetRef.current)) {
        event.preventDefault();
        resetPagerTouchState();
      }
    };

    const handleWindowTouchEnd = () => {
      resetPagerTouchState();
    };

    window.addEventListener("wheel", handleWindowWheel, { passive: false });
    window.addEventListener("touchstart", handleWindowTouchStart, { passive: true });
    window.addEventListener("touchmove", handleWindowTouchMove, { passive: false });
    window.addEventListener("touchend", handleWindowTouchEnd, { passive: true });
    window.addEventListener("touchcancel", handleWindowTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("wheel", handleWindowWheel);
      window.removeEventListener("touchstart", handleWindowTouchStart);
      window.removeEventListener("touchmove", handleWindowTouchMove);
      window.removeEventListener("touchend", handleWindowTouchEnd);
      window.removeEventListener("touchcancel", handleWindowTouchEnd);
    };
  }, [isImmersiveMobileMatchday, resetPagerTouchState, trySwitchMobileLandscapePanel]);

  const heroShell = (
    <div
      className={`halisaha-hero-shell flex flex-col gap-4 pb-2.5 sm:gap-4 sm:pb-3 ${
        isImmersiveMobileMatchday ? "h-full justify-start border-b-0" : "border-b border-white/10"
      }`}
    >
      <HalisahaShowcaseTabs
        activeTab={activeTab}
        title={snapshot.match.title}
        onTabChange={handleTabChange}
      />
      <HalisahaHeroSummary
        homeTeamName={homeTeam.name}
        awayTeamName={awayTeam.name}
        kickoffLabel={snapshot.match.kickoffLabel}
        venueName={snapshot.match.venueName}
        countdown={countdown}
      />
    </div>
  );

  const pitchBoard = (
    <PitchBoard
      showLineups={showLineups}
      onToggle={() => setShowLineups((current) => !current)}
      homeLineup={homeTeam.lineup}
      awayLineup={awayTeam.lineup}
      questions={snapshot.questions}
      standardQuestions={snapshot.standardQuestions}
      winnerQuestion={snapshot.winnerQuestion}
      winnerVoteSummary={snapshot.winnerVoteSummary}
      userAnswers={snapshot.userAnswers}
      answersResolved={snapshot.match.answersResolved}
      answersLocked={snapshot.userAnswersLocked}
      postMatchMvpVote={snapshot.postMatchMvpVote}
      matchId={snapshot.match.id}
      viewerCanManageOwnAnswerLock={viewerCanManageOwnAnswerLock}
      predictionWindowClosed={predictionWindowClosed}
      viewerCanRevealWinnerPercentages={viewerCanRevealWinnerPercentages}
    />
  );

  const leaderboardPanel = (
    <div className="mt-1 rounded-[1.3rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.02))] p-3 shadow-[0_20px_54px_rgba(0,0,0,0.24)] sm:rounded-[1.55rem] sm:p-4">
      {snapshot.gate.requiresPostMatchVote && !snapshot.gate.canRevealResults ? (
        <HalisahaResultsGateCard
          title={snapshot.gate.title}
          description={snapshot.gate.description}
          href={snapshot.gate.ctaHref}
          buttonLabel={snapshot.gate.buttonLabel}
        />
      ) : (
        <HalisahaLeaderboardBoard
          results={snapshot.results}
          answersResolved={snapshot.match.answersResolved}
        />
      )}
    </div>
  );

  return (
    <section
      data-active-tab={activeTab}
      data-halisaha-pitch-overlay={halisahaPitchOverlayOpen ? "open" : undefined}
      data-mobile-landscape={isImmersiveMobileMatchday ? "true" : undefined}
      data-mobile-landscape-panel={isImmersiveMobileMatchday ? mobileLandscapePanel : undefined}
      data-mobile-orientation-gate={shouldShowRotateGate ? "true" : undefined}
      className={`halisaha-shell relative isolate flex min-h-[calc(100dvh-5.2rem)] flex-col overflow-hidden rounded-[1.35rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.025),rgba(255,255,255,0.01))] px-3.5 py-3.5 text-white shadow-[0_22px_58px_rgba(0,0,0,0.24)] sm:rounded-[1.8rem] sm:px-4 sm:py-3.5 ${
        activeTab === "leaderboard"
          ? "lg:min-h-[calc(100dvh-5.25rem)]"
          : "lg:h-[calc(100dvh-5.25rem)] lg:min-h-0"
      }`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_10%,rgba(255,255,255,0.06),transparent_20%),radial-gradient(circle_at_86%_18%,rgba(255,255,255,0.04),transparent_24%)]" />

      {shouldShowRotateGate ? (
        <div className="relative flex min-h-0 flex-1 flex-col">
          <HalisahaRotateGate
            title={snapshot.match.title}
            homeTeamName={homeTeam.name}
            awayTeamName={awayTeam.name}
            onRequestLandscape={() => void handleRequestLandscape()}
          />
        </div>
      ) : isImmersiveMobileMatchday ? (
        <div
          ref={mobilePagerRef}
          className="halisaha-mobile-pager relative flex min-h-0 flex-1 overflow-hidden"
          onWheel={handleMobilePagerWheel}
          onTouchStart={handleMobilePagerTouchStart}
          onTouchMove={handleMobilePagerTouchMove}
          onTouchEnd={resetPagerTouchState}
          onTouchCancel={resetPagerTouchState}
        >
          <div
            className="halisaha-mobile-pager-track flex h-full w-full flex-col transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{
              transform:
                mobileLandscapePanel === "hero"
                  ? "translate3d(0, 0, 0)"
                  : "translate3d(0, -100%, 0)",
            }}
          >
            <div className="halisaha-mobile-panel halisaha-mobile-panel-hero flex h-full min-h-0 shrink-0 basis-full flex-col overflow-hidden">
              {heroShell}
            </div>
            <div className="halisaha-mobile-panel halisaha-mobile-panel-pitch flex h-full min-h-0 shrink-0 basis-full flex-col overflow-hidden">
              {pitchBoard}
            </div>
          </div>
        </div>
      ) : (
        <div className="halisaha-shell-body relative flex min-h-0 flex-1 flex-col gap-2">
          {heroShell}
          {activeTab === "matchday" ? pitchBoard : leaderboardPanel}
        </div>
      )}

      {shouldShowViewportDebug ? (
        <div className="halisaha-viewport-debug pointer-events-none absolute bottom-2 left-2 z-[45] rounded-[0.7rem] border border-white/14 bg-[rgba(5,10,10,0.84)] px-2.5 py-2 text-[0.58rem] font-medium leading-[1.45] text-white/84 shadow-[0_12px_28px_rgba(0,0,0,0.28)]">
          <div>
            viewport {mobileViewportState.viewportWidth} x {mobileViewportState.viewportHeight}
          </div>
          <div>
            phone {String(mobileViewportState.isPhoneLike)} | landscape{" "}
            {String(mobileViewportState.isLandscape)}
          </div>
          <div>
            coarse {String(mobileViewportState.hasCoarsePointer)} | touch{" "}
            {mobileViewportState.maxTouchPoints}
          </div>
          <div>
            gate {String(shouldShowRotateGate)} | immersive {String(isImmersiveMobileMatchday)} |
            panel {mobileLandscapePanel}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function HalisahaShowcaseTabs({
  activeTab,
  title,
  onTabChange,
}: {
  activeTab: ShowcaseTab;
  title: string;
  onTabChange: (nextTab: ShowcaseTab) => void;
}) {
  return (
    <div className="inline-flex max-w-fit items-center rounded-[1rem] border border-white/12 bg-white/[0.045] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <button
        type="button"
        onClick={() => onTabChange("matchday")}
        className={`rounded-[0.8rem] border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] transition-colors ${
          activeTab === "matchday"
            ? "border-white/10 bg-white/[0.07] text-white/82"
            : "border-transparent bg-transparent text-white/46 hover:text-white/68"
        }`}
      >
        {title}
      </button>
      <button
        type="button"
        onClick={() => onTabChange("leaderboard")}
        className={`rounded-[0.8rem] border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] transition-colors ${
          activeTab === "leaderboard"
            ? "border-white/10 bg-white/[0.07] text-white/82"
            : "border-transparent bg-transparent text-white/46 hover:text-white/68"
        }`}
      >
        Leaderboard
      </button>
    </div>
  );
}

function HalisahaHeroSummary({
  homeTeamName,
  awayTeamName,
  kickoffLabel,
  venueName,
  countdown,
}: {
  homeTeamName: string;
  awayTeamName: string;
  kickoffLabel: string;
  venueName: string;
  countdown: string;
}) {
  return (
    <div className="halisaha-hero relative flex flex-col gap-1.25 sm:gap-1.5 lg:pr-[25.25rem] xl:pr-[28.5rem]">
      <div className="min-w-0">
        <h1 className="halisaha-team-name text-[clamp(2.55rem,6.8vw,5.7rem)] font-semibold uppercase leading-[0.78] tracking-[0.015em] text-white">
          {homeTeamName}
        </h1>
        <div className="mt-[-0.06rem] flex flex-wrap items-end gap-x-3 gap-y-0">
          <span className="halisaha-vs-label pb-[0.18rem] text-[0.94rem] font-semibold uppercase tracking-[0.34em] text-white/56 sm:text-[1.08rem]">
            vs
          </span>
          <p className="halisaha-team-name text-[clamp(2.55rem,6.8vw,5.7rem)] font-semibold uppercase leading-[0.78] tracking-[0.015em] text-white">
            {awayTeamName}
          </p>
        </div>

        <div className="mt-0 flex min-w-0 items-center gap-3">
          <CupGlyph />
          <div className="halisaha-venue-meta flex min-w-0 flex-col justify-center gap-[0.14rem]">
            <div className="halisaha-venue-kicker text-[11px] font-medium uppercase tracking-[0.24em] text-white/70 sm:text-[12px]">
              {kickoffLabel}
            </div>
            <div className="halisaha-venue-name text-[15px] font-medium uppercase tracking-[0.22em] text-white/88 sm:text-[18px]">
              {venueName}
            </div>
          </div>
        </div>
      </div>

      <div className="halisaha-crest-stage mt-2 text-center sm:mt-2.5 lg:absolute lg:right-[-3.5rem] lg:top-[-1.8625rem] lg:mt-0 lg:w-[24rem] xl:right-[-4.05rem] xl:top-[-2.1125rem] xl:w-[27.6rem]">
        <div className="relative w-full">
          <RaynetCrest />
          <div className="halisaha-countdown-stage absolute left-1/2 top-full mt-[calc(-1.9rem-10px)] -translate-x-1/2">
            <div className="relative flex min-w-[8.6rem] flex-col items-center">
              <div className="halisaha-countdown-label text-[0.44rem] font-semibold uppercase leading-none tracking-[0.34em] text-[#d2e5e5] [text-shadow:0_2px_10px_rgba(136,192,208,0.12)] sm:text-[0.48rem]">
                Kickoff countdown
              </div>
              <div className="halisaha-countdown-value mt-1 text-[1.54rem] font-black leading-none tracking-[0.06em] text-white tabular-nums [text-shadow:0_4px_16px_rgba(136,192,208,0.18)] sm:text-[1.76rem]">
                {countdown}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HalisahaRotateGate({
  title,
  homeTeamName,
  awayTeamName,
  onRequestLandscape,
}: {
  title: string;
  homeTeamName: string;
  awayTeamName: string;
  onRequestLandscape: () => void;
}) {
  return (
    <div className="halisaha-rotate-gate flex h-full min-h-0 flex-col items-center justify-center text-center">
      <div className="mx-auto flex max-w-[34rem] flex-col items-center rounded-[1.35rem] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.025))] px-5 py-5 shadow-[0_24px_56px_rgba(0,0,0,0.28)]">
        <RotateDeviceGlyph />
        <div className="mt-4 text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-white/52">
          Mobile landscape required
        </div>
        <h2 className="mt-2 text-[1.24rem] font-semibold leading-tight text-white">
          Rotate your phone to use Halisaha Mode
        </h2>
        <p className="mt-3 text-[0.82rem] leading-[1.6] text-white/68">
          Halisaha Matchday is designed as a full-width mobile landscape experience. Keep the
          top site menu visible, rotate your device, then continue in horizontal mode.
        </p>
        <p className="mt-4 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-white/44">
          {title}
        </p>
        <p className="mt-1 text-[0.94rem] font-medium uppercase tracking-[0.08em] text-white/86">
          {homeTeamName} vs {awayTeamName}
        </p>
        <button
          type="button"
          onClick={onRequestLandscape}
          className="mt-5 rounded-full border border-white/14 bg-white/[0.08] px-4 py-[0.78rem] text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-white shadow-[0_14px_28px_rgba(0,0,0,0.2)] transition-colors hover:bg-white/[0.13]"
        >
          I rotated my phone
        </button>
      </div>
    </div>
  );
}

function RotateDeviceGlyph() {
  return (
    <svg
      viewBox="0 0 120 120"
      aria-hidden
      className="h-16 w-16 text-white/84"
      fill="none"
    >
      <rect
        x="23"
        y="17"
        width="42"
        height="74"
        rx="9"
        stroke="currentColor"
        strokeWidth="4.5"
        opacity="0.38"
      />
      <rect
        x="58"
        y="43"
        width="39"
        height="26"
        rx="7"
        stroke="currentColor"
        strokeWidth="4.5"
      />
      <path
        d="M77 27c9.8 2.2 17.7 10 20 19.8"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.72"
      />
      <path
        d="M99 42.8L97.3 48l-4.9-2.3"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.72"
      />
    </svg>
  );
}

function PitchBoard({
  showLineups,
  onToggle,
  homeLineup,
  awayLineup,
  questions,
  standardQuestions,
  winnerQuestion,
  winnerVoteSummary,
  userAnswers,
  answersResolved,
  answersLocked,
  postMatchMvpVote,
  matchId,
  viewerCanManageOwnAnswerLock,
  predictionWindowClosed,
  viewerCanRevealWinnerPercentages,
}: {
  showLineups: boolean;
  onToggle: () => void;
  homeLineup: PlayerSpot[];
  awayLineup: PlayerSpot[];
  questions: HalisahaPublicSnapshot["questions"];
  standardQuestions: HalisahaPublicSnapshot["standardQuestions"];
  winnerQuestion: HalisahaPublicSnapshot["winnerQuestion"];
  winnerVoteSummary: HalisahaPublicSnapshot["winnerVoteSummary"];
  userAnswers: HalisahaPublicSnapshot["userAnswers"];
  answersResolved: boolean;
  answersLocked: boolean;
  postMatchMvpVote: HalisahaPublicSnapshot["postMatchMvpVote"];
  matchId: string | null;
  viewerCanManageOwnAnswerLock: boolean;
  predictionWindowClosed: boolean;
  viewerCanRevealWinnerPercentages: boolean;
}) {
  const hasPublishedQuestions = questions.length > 0;
  const shouldPreviewAdminMvpVote =
    viewerCanManageOwnAnswerLock &&
    answersLocked &&
    !postMatchMvpVote.hasUserVoted &&
    !postMatchMvpVote.requiresVote;
  const shouldShowPostMatchMvpVote =
    (postMatchMvpVote.requiresVote || shouldPreviewAdminMvpVote) &&
    !postMatchMvpVote.hasUserVoted;
  const hasOverlayContent = shouldShowPostMatchMvpVote || hasPublishedQuestions;
  const showChallengeSurface = showLineups && hasOverlayContent;
  const [renderChallengeOverlay, setRenderChallengeOverlay] = useState(showChallengeSurface);
  const [isFinalizePromptOpen, setIsFinalizePromptOpen] = useState(false);
  const [isPlayerPickerOpen, setIsPlayerPickerOpen] = useState(false);
  const overlayBlocksBall =
    isFinalizePromptOpen || isPlayerPickerOpen || shouldShowPostMatchMvpVote;
  const shouldRenderMatchdayPitchOverlay =
    !showChallengeSurface || !renderChallengeOverlay;
  const statusLabel =
    shouldShowPostMatchMvpVote
      ? showLineups
        ? "Press the ball to close MVP voting"
        : "Press the ball to vote for MVP"
      : showLineups
        ? hasPublishedQuestions
          ? "Press the ball to hide predictions"
          : "No questions published yet"
        : "Press the ball to enter match mode";

  useEffect(() => {
    if (showChallengeSurface) {
      setRenderChallengeOverlay(true);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setRenderChallengeOverlay(false);
    }, PITCH_TRANSITION_TIMEOUT_MS);

    return () => window.clearTimeout(timeoutId);
  }, [showChallengeSurface]);

  useEffect(() => {
    if (!showChallengeSurface) {
      setIsFinalizePromptOpen(false);
      setIsPlayerPickerOpen(false);
    }
  }, [showChallengeSurface]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5">
      <div className="halisaha-pitch-caption flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.18em] text-white/52 sm:text-[11px]">
        <span>7V7</span>
        <span>{statusLabel}</span>
      </div>

      <div
        className={`halisaha-pitch-board relative min-h-0 flex-1 overflow-hidden rounded-[1.3rem] border border-white/10 p-2 shadow-[0_20px_54px_rgba(0,0,0,0.24)] transition-[background-image,box-shadow,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] sm:rounded-[1.55rem] sm:p-2.5 ${
          showLineups
            ? "bg-[linear-gradient(180deg,rgba(62,104,92,0.988),rgba(28,56,50,0.995),rgba(11,22,20,0.999))]"
            : "bg-[radial-gradient(circle_at_14%_18%,rgba(255,255,255,0.08),transparent_18%),radial-gradient(circle_at_82%_26%,rgba(255,255,255,0.05),transparent_22%),radial-gradient(circle_at_48%_70%,rgba(255,255,255,0.035),transparent_18%),linear-gradient(180deg,rgba(45,45,45,0.995),rgba(23,23,23,0.999),rgba(12,12,12,1))]"
        } scale-100`}
      >
        <div
          className={`pointer-events-none absolute inset-0 ${showLineups ? "opacity-[0.075]" : "opacity-[0.16]"}`}
          style={{
            backgroundImage: showLineups
              ? "repeating-linear-gradient(0deg, rgba(231,243,237,0.08) 0px, rgba(231,243,237,0.08) 1px, transparent 1px, transparent 22px), repeating-linear-gradient(90deg, rgba(214,231,224,0.042) 0px, rgba(214,231,224,0.042) 1px, transparent 1px, transparent 28px)"
              : "repeating-linear-gradient(0deg, rgba(255,255,255,0.02) 0px, rgba(255,255,255,0.02) 1px, transparent 1px, transparent 22px), repeating-linear-gradient(90deg, rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 1px, transparent 1px, transparent 28px), radial-gradient(circle_at_14%_18%, rgba(255,255,255,0.12) 0px, transparent 96px), radial-gradient(circle_at_82%_26%, rgba(255,255,255,0.08) 0px, transparent 130px), radial-gradient(circle_at_48%_70%, rgba(255,255,255,0.05) 0px, transparent 110px), radial-gradient(circle_at_52%_48%, rgba(255,255,255,0.04) 0px, transparent 210px)",
          }}
        />
        <div
          className={`pointer-events-none absolute inset-0 ${
            showLineups
              ? "bg-[radial-gradient(circle_at_12%_16%,rgba(143,188,187,0.24),transparent_20%),radial-gradient(circle_at_84%_12%,rgba(94,129,172,0.18),transparent_24%),radial-gradient(circle_at_50%_102%,rgba(255,255,255,0.08),transparent_34%)]"
              : "bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_24%,transparent_76%,rgba(255,255,255,0.018)),radial-gradient(circle_at_18%_10%,rgba(255,255,255,0.03),transparent_22%),radial-gradient(circle_at_84%_12%,rgba(255,255,255,0.025),transparent_24%),radial-gradient(circle_at_50%_100%,rgba(255,255,255,0.02),transparent_38%)]"
          }`}
        />

        <div className="relative flex h-full min-h-[15.75rem] w-full min-w-0 items-center justify-center sm:min-h-[19.25rem]">
          {/* Match SVG viewBox 1000×620: contain in parent so letterboxing is even (same band top/bottom as left/right). */}
          <div className="relative aspect-[1000/620] h-full max-h-full w-auto max-w-full min-h-0 min-w-0">
          <div
            className={`pointer-events-none absolute inset-y-0 left-0 z-[1] w-1/2 origin-right rounded-l-[1.2rem] border-r border-white/6 transition-transform duration-300 ${
              showLineups
                ? "bg-[linear-gradient(180deg,rgba(17,29,26,0.52),rgba(10,16,15,0.24))]"
                : "bg-[linear-gradient(180deg,rgba(48,48,48,0.68),rgba(24,24,24,0.58))]"
            } ${
              showLineups ? "scale-x-100" : "scale-x-0"
            }`}
          />
          <div
            className={`pointer-events-none absolute inset-y-0 right-0 z-[1] w-1/2 origin-left rounded-r-[1.2rem] border-l border-white/6 transition-transform duration-300 ${
              showLineups
                ? "bg-[linear-gradient(180deg,rgba(19,31,28,0.56),rgba(11,17,15,0.26))]"
                : "bg-[linear-gradient(180deg,rgba(48,48,48,0.72),rgba(22,22,22,0.6))]"
            } ${
              showLineups ? "scale-x-100" : "scale-x-0"
            }`}
          />

          <PitchLines showLineups={showLineups} />
          {shouldRenderMatchdayPitchOverlay ? (
            <div
              aria-hidden={showChallengeSurface}
              className={`absolute inset-0 z-10 transition-[opacity,transform,filter] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                showChallengeSurface
                  ? "pointer-events-none opacity-0 blur-[10px] scale-[1.028]"
                  : "opacity-100 blur-0 scale-100"
              }`}
            >
              <PitchOverlay homeLineup={homeLineup} awayLineup={awayLineup} />
            </div>
          ) : null}
          {renderChallengeOverlay ? (
            <div
              aria-hidden={!showChallengeSurface}
              className={`absolute inset-0 ${overlayBlocksBall ? "z-[22]" : "z-[14]"} transition-[opacity,transform,filter] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                showChallengeSurface
                  ? "opacity-100 blur-0 scale-100"
                  : "pointer-events-none opacity-0 blur-[12px] scale-[0.985]"
              }`}
            >
              {shouldShowPostMatchMvpVote ? (
                <HalisahaPostMatchMvpVote
                  matchId={matchId}
                  voteState={postMatchMvpVote}
                  previewMode={shouldPreviewAdminMvpVote}
                />
              ) : (
                <HalisahaChallengeOverlay
                  matchId={matchId}
                  questions={questions}
                  standardQuestions={standardQuestions}
                  winnerQuestion={winnerQuestion}
                  winnerVoteSummary={winnerVoteSummary}
                  userAnswers={userAnswers}
                  answersResolved={answersResolved}
                  answersLocked={answersLocked}
                  viewerCanManageOwnAnswerLock={viewerCanManageOwnAnswerLock}
                  predictionWindowClosed={predictionWindowClosed}
                  winnerPercentagesVisible={viewerCanRevealWinnerPercentages}
                  onFinalizePromptVisibilityChange={setIsFinalizePromptOpen}
                  onPlayerPickerVisibilityChange={setIsPlayerPickerOpen}
                />
              )}
            </div>
          ) : null}
          <MidfieldBallButton
            showLineups={showLineups}
            promptOpen={overlayBlocksBall}
            label={
              shouldShowPostMatchMvpVote
                ? showLineups
                  ? "Hide MVP vote"
                  : "Reveal MVP vote"
                : undefined
            }
            onToggle={onToggle}
          />
          </div>
        </div>
      </div>
    </div>
  );
}

function PitchOverlay({
  homeLineup,
  awayLineup,
}: {
  homeLineup: PlayerSpot[];
  awayLineup: PlayerSpot[];
}) {
  return (
    <svg
      viewBox="0 0 1000 620"
      preserveAspectRatio="xMidYMid meet"
      className="absolute inset-0 z-10 h-full w-full"
      fill="none"
    >
      {homeLineup.map((player) => (
        <PitchPlayerLabel
          key={`home-${player.name}`}
          player={player}
          side="left"
        />
      ))}

      {awayLineup.map((player) => (
        <PitchPlayerLabel
          key={`away-${player.name}`}
          player={player}
          side="right"
        />
      ))}
    </svg>
  );
}

function MidfieldBallButton({
  showLineups,
  promptOpen,
  label,
  onToggle,
}: {
  showLineups: boolean;
  promptOpen: boolean;
  label?: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.currentTarget.blur();
        onToggle();
      }}
      onMouseUp={(event) => event.currentTarget.blur()}
      onFocus={(event) => event.currentTarget.blur()}
      onKeyDown={(event) => handleBallKeyDown(event, onToggle)}
      aria-pressed={showLineups}
      aria-label={label ?? (showLineups ? "Hide lineups" : "Reveal lineups")}
      tabIndex={-1}
      className={`absolute left-1/2 ${promptOpen ? "z-[12]" : "z-20"} flex items-center justify-center -translate-x-1/2 -translate-y-1/2 appearance-none border-0 bg-transparent p-0 outline-none ring-0 transition-[width,height,box-shadow,transform,top] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] focus:outline-none focus-visible:outline-none focus-visible:ring-0 ${
        showLineups
          ? "h-[4.32rem] w-[4.32rem] shadow-none sm:h-[4.5rem] sm:w-[4.5rem]"
          : "aspect-square w-[12.16%] min-w-[6.12rem] max-w-[7.36rem] shadow-[0_12px_22px_rgba(0,0,0,0.2)]"
      }`}
      style={{
        top: showLineups ? "calc(50% + 4px)" : "calc(50% + 4.5px)",
        transform: `translate(${showLineups ? "-50%" : "calc(-50% - 0.5px)"}, -50%) scale(${showLineups ? 0.98 : 1})`,
        WebkitTapHighlightColor: "transparent",
        outline: "none",
        border: "none",
        background: "transparent",
        boxShadow: showLineups ? "none" : undefined,
      }}
    >
      <div
        className={`relative overflow-hidden rounded-full transition-[width,height,transform,box-shadow] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          showLineups
            ? "h-[3.87rem] w-[3.87rem] shadow-[0_6px_18px_rgba(0,0,0,0.2)]"
            : "h-full w-full"
        }`}
      >
        <Image
          src={midfieldBallAsset}
          alt=""
          fill
          sizes={showLineups ? "(min-width: 640px) 3.87rem, 3.87rem" : "(min-width: 640px) 9.2rem, 7.65rem"}
          className={`pointer-events-none rounded-full object-cover object-center transition-transform duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            showLineups ? "scale-[1.04]" : "scale-[1.46]"
          }`}
          priority
        />
      </div>
    </button>
  );
}

function PitchLines({
  showLineups,
}: {
  showLineups: boolean;
}) {
  if (!showLineups) {
    return (
      <svg
        viewBox="0 0 1000 620"
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 h-full w-full"
        fill="none"
        aria-hidden
      >
        <defs>
          <filter id="chalk-soft-closed">
            <feGaussianBlur stdDeviation="1.35" />
          </filter>
          <filter id="chalk-noise-closed">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.85"
              numOctaves="2"
              seed="4"
              stitchTiles="stitch"
            />
            <feColorMatrix
              type="matrix"
              values="1 0 0 0 0
                      0 1 0 0 0
                      0 0 1 0 0
                      0 0 0 0.08 0"
            />
          </filter>
        </defs>

        <rect
          x="0"
          y="0"
          width="1000"
          height="620"
          fill="rgba(255,255,255,0.14)"
          filter="url(#chalk-noise-closed)"
        />

        <g
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="5.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#chalk-soft-closed)"
        >
          <rect x="18" y="18" width="964" height="584" rx="2" />
          <path d="M500 18V602" />
          <circle cx="500" cy="310" r="86" />
          <rect x="18" y="138" width="150" height="344" />
          <rect x="18" y="201" width="74" height="218" />
          <rect x="832" y="138" width="150" height="344" />
          <rect x="908" y="201" width="74" height="218" />
          <path d="M168 246 A78 78 0 0 1 168 374" />
          <path d="M832 246 A78 78 0 0 0 832 374" />
          <path d="M18 46 A28 28 0 0 1 46 18" />
          <path d="M18 574 A28 28 0 0 0 46 602" />
          <path d="M954 18 A28 28 0 0 1 982 46" />
          <path d="M954 602 A28 28 0 0 0 982 574" />
        </g>

        <g
          stroke="rgba(248,248,245,0.74)"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="18" y="18" width="964" height="584" rx="2" />
          <path d="M500 18V602" />
          <circle cx="500" cy="310" r="86" />
          <rect x="18" y="138" width="150" height="344" />
          <rect x="18" y="201" width="74" height="218" />
          <rect x="832" y="138" width="150" height="344" />
          <rect x="908" y="201" width="74" height="218" />
          <path d="M168 246 A78 78 0 0 1 168 374" />
          <path d="M832 246 A78 78 0 0 0 832 374" />
          <path d="M18 46 A28 28 0 0 1 46 18" />
          <path d="M18 574 A28 28 0 0 0 46 602" />
          <path d="M954 18 A28 28 0 0 1 982 46" />
          <path d="M954 602 A28 28 0 0 0 982 574" />
        </g>

        <circle
          cx="500"
          cy="310"
          r="5"
          fill="rgba(248,248,245,0.84)"
          stroke="none"
        />
        <circle
          cx="128"
          cy="310"
          r="4.6"
          fill="rgba(248,248,245,0.74)"
          stroke="none"
        />
        <circle
          cx="872"
          cy="310"
          r="4.6"
          fill="rgba(248,248,245,0.74)"
          stroke="none"
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 1000 620"
      preserveAspectRatio="xMidYMid meet"
      className="absolute inset-0 h-full w-full"
      fill="none"
      aria-hidden
    >
      <defs>
        <filter id="chalk-soft">
          <feGaussianBlur stdDeviation="1.15" />
        </filter>
      </defs>

      <g
        transform="translate(2 -1)"
        stroke={showLineups ? "rgba(225,238,230,0.06)" : "rgba(255,255,255,0.18)"}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#chalk-soft)"
      >
        <rect x="18" y="18" width="964" height="584" rx="8" />
        <path d="M500 18V602" />
        <circle cx="500" cy="310" r="86" />
        <rect x="18" y="155" width="124" height="310" />
        <rect x="18" y="220" width="58" height="180" />
        <rect x="858" y="155" width="124" height="310" />
        <rect x="924" y="220" width="58" height="180" />
      </g>

      <g
        stroke={showLineups ? "rgba(233,243,237,0.25)" : "rgba(255,255,255,0.76)"}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="18" y="18" width="964" height="584" rx="8" />
        <path d="M500 18V602" />
        <circle cx="500" cy="310" r="86" />
        <circle
          cx="500"
          cy="310"
          r="4"
          fill={showLineups ? "rgba(233,243,237,0.25)" : "rgba(255,255,255,0.76)"}
          stroke="none"
        />
        <rect x="18" y="155" width="124" height="310" />
        <rect x="18" y="220" width="58" height="180" />
        <rect x="858" y="155" width="124" height="310" />
        <rect x="924" y="220" width="58" height="180" />
      </g>
    </svg>
  );
}

function CupGlyph() {
  return (
    <div className="relative w-[3.1rem] shrink-0 sm:w-[3.7rem]">
      <div className="pointer-events-none absolute inset-[14%] rounded-full bg-[radial-gradient(circle,rgba(143,188,187,0.2),transparent_66%)] blur-xl" />
      <Image
        src={trophyAsset}
        alt="Trophy icon"
        className="relative h-auto w-full object-contain drop-shadow-[0_10px_22px_rgba(0,0,0,0.2)]"
        style={{
          transform: "scaleX(1.3) scaleY(1.15)",
          transformOrigin: "center center",
          filter:
            "brightness(1.04) contrast(1.04) saturate(0.68) sepia(0.14) hue-rotate(148deg)",
        }}
        priority
      />
    </div>
  );
}

function RaynetCrest() {
  return (
    <div className="relative aspect-[757/433] w-full overflow-visible">
      <div className="pointer-events-none absolute inset-[7%] rounded-[2rem] bg-[radial-gradient(circle_at_20%_40%,rgba(143,188,187,0.14),transparent_30%),radial-gradient(circle_at_80%_36%,rgba(129,161,193,0.12),transparent_32%)] blur-2xl" />
      <Image
        src={crestAsset}
        alt="RayNET crest"
        fill
        sizes="(min-width: 1280px) 27.6rem, 24rem"
        className="object-contain object-center drop-shadow-[0_20px_38px_rgba(10,16,22,0.24)]"
        priority
      />
    </div>
  );
}

function PitchPlayerLabel({
  player,
  side,
}: {
  player: PlayerSpot;
  side: "left" | "right";
}) {
  return (
    <g transform={`translate(${player.x} ${player.y}) rotate(${side === "left" ? "-90" : "90"})`}>
      <text
        x="0"
        y="0"
        textAnchor="middle"
        dominantBaseline="central"
        fill="#E45F5F"
        stroke="rgba(42,4,4,0.82)"
        strokeWidth="0.42"
        paintOrder="stroke"
        fontSize="11.9"
        fontWeight="650"
        letterSpacing="1.1"
        fontFamily="system-ui, sans-serif"
      >
        {player.name.toUpperCase()}
      </text>
    </g>
  );
}

function handleBallKeyDown(
  event: KeyboardEvent<HTMLElement>,
  onToggle: () => void,
) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    onToggle();
  }
}

function buildTeamLineup(
  snapshot: HalisahaPublicSnapshot,
  teamSide: "home" | "away",
) {
  return snapshot.participants
    .filter((participant) => participant.teamSide === teamSide)
    .map((participant) => {
      const spot = getPitchSpot(teamSide, participant.positionKey);
      if (!spot) return null;

      return {
        name: participant.displayName,
        x: spot.x,
        y: spot.y,
      } satisfies PlayerSpot;
    })
    .filter((player): player is PlayerSpot => player !== null);
}

function formatCountdown(target: Date) {
  const diffMs = Math.max(0, target.getTime() - Date.now());
  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (totalMinutes % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}
