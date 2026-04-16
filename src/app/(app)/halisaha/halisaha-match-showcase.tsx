"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  type KeyboardEvent,
  type TouchEvent as ReactTouchEvent,
  type WheelEvent as ReactWheelEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { HalisahaLeaderboardBoard } from "@/components/halisaha/halisaha-leaderboard-board";
import { HalisahaChallengeOverlay } from "@/components/halisaha/halisaha-challenge-overlay";
import { HalisahaPostMatchMvpVote } from "@/components/halisaha/halisaha-post-match-mvp-vote";
import { HalisahaResultsGateCard } from "@/components/halisaha/halisaha-results-gate-card";
import { PrefetchLink } from "@/components/prefetch-link";
import type { HalisahaPositionKey } from "@prisma/client";
import {
  getHalisahaPositionLineGroup,
  getPitchSpot,
  type HalisahaPositionLineGroup,
} from "@/lib/halisaha/config";
import {
  HALISAHA_MOBILE_VIEWPORT_FALLBACK_LONG_SIDE_PX,
  HALISAHA_MOBILE_VIEWPORT_FALLBACK_SHORT_SIDE_PX,
  isHalisahaPhoneLikeViewport,
  shouldUseHalisahaMobileMatchdayPager,
} from "@/lib/halisaha/mobile-landscape";
import { getHalisahaPredictionLockAt } from "@/lib/halisaha/match-state";
import { shouldRevealWinnerPercentages } from "@/lib/halisaha/rules";
import type { HalisahaPublicSnapshot } from "@/lib/halisaha/server";
import { IconHomeCompact } from "@/components/icons/nav-icons";
import crestAsset from "../../../../2_LOGO-fitted.png";
import midfieldBallAsset from "../../../../TOP 2.png";
import trophyAsset from "../../../../kupa.png";

type PlayerSpot = {
  name: string;
  x: number;
  y: number;
  positionKey: HalisahaPositionKey;
  lineGroup: HalisahaPositionLineGroup | null;
};

type ShowcaseTab = "matchday" | "leaderboard";
type MobileLandscapePanel = "hero" | "pitch";
type MobileViewportState = {
  isPhoneLike: boolean;
  isLandscape: boolean;
  viewportWidth: number;
  viewportHeight: number;
  hasCoarsePointer: boolean;
  maxTouchPoints: number;
};

const PITCH_TRANSITION_TIMEOUT_MS = 280;
const MOBILE_PAGER_TOUCH_THRESHOLD_PX = 28;
const MOBILE_PAGER_WHEEL_THRESHOLD_PX = 18;
const MOBILE_PAGER_COOLDOWN_MS = 320;
const MOBILE_VIEWPORT_SETTLE_DELAYS_MS = [120, 320, 760] as const;

function getStableViewportDimensions() {
  if (typeof window === "undefined") {
    return {
      viewportWidth: 0,
      viewportHeight: 0,
    };
  }

  const widthCandidates = [
    window.innerWidth,
    document.documentElement.clientWidth,
    Math.round(window.visualViewport?.width ?? 0),
  ].filter((value) => Number.isFinite(value) && value > 0);
  const heightCandidates = [
    window.innerHeight,
    document.documentElement.clientHeight,
    Math.round(window.visualViewport?.height ?? 0),
  ].filter((value) => Number.isFinite(value) && value > 0);

  return {
    viewportWidth: widthCandidates.length > 0 ? Math.max(...widthCandidates) : window.innerWidth,
    viewportHeight:
      heightCandidates.length > 0 ? Math.max(...heightCandidates) : window.innerHeight,
  };
}

function syncHalisahaViewportHeightVar(viewportHeight: number) {
  if (typeof document === "undefined" || viewportHeight <= 0) {
    return;
  }

  document.documentElement.style.setProperty("--halisaha-page-viewport-height", `${viewportHeight}px`);
}

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

  const { viewportWidth, viewportHeight } = getStableViewportDimensions();
  const hasCoarsePointer =
    window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;

  return {
    isPhoneLike: isHalisahaPhoneLikeViewport({
      viewportWidth,
      viewportHeight,
      hasCoarsePointer,
      maxTouchPoints: navigator.maxTouchPoints,
    }),
    isLandscape:
      window.matchMedia("(orientation: landscape)").matches || viewportWidth > viewportHeight,
    viewportWidth,
    viewportHeight,
    hasCoarsePointer,
    maxTouchPoints: navigator.maxTouchPoints,
  };
}

function createInitialMobileViewportState(initialPhoneLikeViewport: boolean): MobileViewportState {
  return {
    isPhoneLike: initialPhoneLikeViewport,
    isLandscape: false,
    viewportWidth: initialPhoneLikeViewport ? HALISAHA_MOBILE_VIEWPORT_FALLBACK_SHORT_SIDE_PX : 0,
    viewportHeight: initialPhoneLikeViewport ? HALISAHA_MOBILE_VIEWPORT_FALLBACK_LONG_SIDE_PX : 0,
    hasCoarsePointer: initialPhoneLikeViewport,
    maxTouchPoints: initialPhoneLikeViewport ? 1 : 0,
  };
}

function hasSameMobileViewportState(
  current: MobileViewportState,
  next: MobileViewportState,
) {
  return (
    current.isPhoneLike === next.isPhoneLike &&
    current.isLandscape === next.isLandscape &&
    current.viewportWidth === next.viewportWidth &&
    current.viewportHeight === next.viewportHeight &&
    current.hasCoarsePointer === next.hasCoarsePointer &&
    current.maxTouchPoints === next.maxTouchPoints
  );
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
  initialPhoneLikeViewport = false,
}: {
  snapshot: HalisahaPublicSnapshot;
  viewerCanManageOwnAnswerLock: boolean;
  forcePostMatchMvpVote?: boolean;
  initialPhoneLikeViewport?: boolean;
}) {
  const searchParams = useSearchParams();
  const shouldForceVoteOverlay =
    forcePostMatchMvpVote &&
    snapshot.postMatchMvpVote.requiresVote &&
    !snapshot.postMatchMvpVote.hasUserVoted;
  const shouldAutoOpenVoteOverlay = shouldForceVoteOverlay;
  const [showLineups, setShowLineups] = useState(shouldAutoOpenVoteOverlay);
  const [activeTab, setActiveTab] = useState<ShowcaseTab>("matchday");
  const [isTabTransitionPending, startTabTransition] = useTransition();
  const [isPitchTransitionPending, startPitchTransition] = useTransition();
  const [mobileLandscapePanel, setMobileLandscapePanel] =
    useState<MobileLandscapePanel>("hero");
  const [mobileViewportState, setMobileViewportState] = useState<MobileViewportState>(() =>
    createInitialMobileViewportState(initialPhoneLikeViewport),
  );
  const mobilePagerRef = useRef<HTMLDivElement | null>(null);
  const viewportSyncRef = useRef<(() => void) | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const touchTargetRef = useRef<EventTarget | null>(null);
  const lastPanelChangeAtRef = useRef(0);
  const kickoffAt = useMemo(
    () => new Date(snapshot.match.kickoffAtIso),
    [snapshot.match.kickoffAtIso],
  );
  const [countdown, setCountdown] = useState(() => formatCountdown(kickoffAt));
  const [predictionWindowClosed, setPredictionWindowClosed] = useState(
    () => new Date() >= getHalisahaPredictionLockAt({ kickoffAt }),
  );
  const observerVoteNoticeStorageKey = useMemo(
    () =>
      snapshot.match.id && snapshot.postMatchMvpVote.voteEndsAtIso
        ? `halisaha-observer-vote-notice:${snapshot.match.id}:${snapshot.postMatchMvpVote.voteEndsAtIso}`
        : null,
    [snapshot.match.id, snapshot.postMatchMvpVote.voteEndsAtIso],
  );
  const shouldShowObserverVoteNotice =
    snapshot.gate.mode === "waiting_for_vote_window" &&
    snapshot.match.phase === "post_match_mvp_voting";
  const [showObserverVoteNotice, setShowObserverVoteNotice] = useState(false);
  const homeLineup = useMemo(() => buildTeamLineup(snapshot, "home"), [snapshot]);
  const awayLineup = useMemo(() => buildTeamLineup(snapshot, "away"), [snapshot]);
  const viewerCanRevealWinnerPercentages = shouldRevealWinnerPercentages({
    phase: snapshot.match.phase,
    userAnswersLocked: snapshot.userAnswersLocked,
    canRevealResults: snapshot.match.canRevealResults,
    hasWinnerVoteSummary: Boolean(snapshot.winnerVoteSummary),
  });

  const hasPublishedHalisahaQuestions = snapshot.questions.length > 0;
  const shouldShowPostMatchMvpVoteForLayout =
    snapshot.postMatchMvpVote.requiresVote && !snapshot.postMatchMvpVote.hasUserVoted;
  const halisahaPitchOverlayOpen =
    activeTab === "matchday" &&
    showLineups &&
    (shouldShowPostMatchMvpVoteForLayout || hasPublishedHalisahaQuestions);
  const shouldForceMobilePreview =
    process.env.NODE_ENV !== "production" && searchParams.get("halisaha-force-mobile") === "1";
  const forcedMobilePanelParam =
    process.env.NODE_ENV !== "production" ? searchParams.get("halisaha-panel") : null;
  const forcedMobilePanel =
    forcedMobilePanelParam === "pitch" || forcedMobilePanelParam === "hero"
      ? forcedMobilePanelParam
      : null;
  const shouldUseMobilePager = shouldUseHalisahaMobileMatchdayPager({
    isPhoneLikeViewport: shouldForceMobilePreview ? true : mobileViewportState.isPhoneLike,
    isMatchdayTab: activeTab === "matchday",
  });
  const isCompactMobileViewport =
    shouldForceMobilePreview ||
    initialPhoneLikeViewport ||
    (mobileViewportState.viewportWidth > 0 && mobileViewportState.viewportWidth <= 767);
  const isImmersiveMobileMatchday =
    shouldUseMobilePager;
  const shouldShowViewportDebug =
    process.env.NODE_ENV !== "production" && searchParams.get("halisaha-debug") === "1";
  const isInteractionTransitionPending =
    isTabTransitionPending || isPitchTransitionPending;

  useEffect(() => {
    const tick = () => setCountdown(formatCountdown(kickoffAt));
    tick();
    const interval = window.setInterval(tick, 60_000);
    return () => window.clearInterval(interval);
  }, [kickoffAt]);

  useEffect(() => {
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
  }, [kickoffAt]);

  useEffect(() => {
    if (!shouldShowObserverVoteNotice || !observerVoteNoticeStorageKey) {
      setShowObserverVoteNotice(false);
      return;
    }

    try {
      if (window.localStorage.getItem(observerVoteNoticeStorageKey) === "1") {
        setShowObserverVoteNotice(false);
        return;
      }
    } catch {
      // Persisting the notice is best-effort.
    }

    setShowObserverVoteNotice(true);
  }, [observerVoteNoticeStorageKey, shouldShowObserverVoteNotice]);

  const dismissObserverVoteNotice = useCallback(() => {
    if (observerVoteNoticeStorageKey) {
      try {
        window.localStorage.setItem(observerVoteNoticeStorageKey, "1");
      } catch {
        // Persisting the notice is best-effort.
      }
    }

    setShowObserverVoteNotice(false);
  }, [observerVoteNoticeStorageKey]);

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

  useLayoutEffect(() => {
    const visualViewport = window.visualViewport;
    let frameId = 0;
    let cancelled = false;
    let settleTimeoutIds: number[] = [];
    const syncViewportState = () => {
      const nextState = getMobileLandscapeViewportState();
      syncHalisahaViewportHeightVar(nextState.viewportHeight);
      setMobileViewportState((current) =>
        hasSameMobileViewportState(current, nextState) ? current : nextState,
      );
    };
    const clearSettlingTimers = () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
        frameId = 0;
      }
      settleTimeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
      settleTimeoutIds = [];
    };
    const scheduleViewportStateSync = () => {
      clearSettlingTimers();
      syncViewportState();
      frameId = window.requestAnimationFrame(() => {
        syncViewportState();
      });
      settleTimeoutIds = MOBILE_VIEWPORT_SETTLE_DELAYS_MS.map((delay) =>
        window.setTimeout(() => {
          syncViewportState();
        }, delay),
      );
    };
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        scheduleViewportStateSync();
      }
    };

    viewportSyncRef.current = scheduleViewportStateSync;
    scheduleViewportStateSync();
    if (document.fonts?.ready) {
      document.fonts.ready
        .then(() => {
          if (!cancelled) {
            scheduleViewportStateSync();
          }
        })
        .catch(() => undefined);
    }

    window.addEventListener("resize", scheduleViewportStateSync);
    window.addEventListener("orientationchange", scheduleViewportStateSync);
    window.addEventListener("load", scheduleViewportStateSync);
    window.addEventListener("pageshow", scheduleViewportStateSync);
    window.addEventListener("focus", scheduleViewportStateSync);
    visualViewport?.addEventListener("resize", scheduleViewportStateSync);
    visualViewport?.addEventListener("scroll", scheduleViewportStateSync);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      viewportSyncRef.current = null;
      clearSettlingTimers();
      window.removeEventListener("resize", scheduleViewportStateSync);
      window.removeEventListener("orientationchange", scheduleViewportStateSync);
      window.removeEventListener("load", scheduleViewportStateSync);
      window.removeEventListener("pageshow", scheduleViewportStateSync);
      window.removeEventListener("focus", scheduleViewportStateSync);
      visualViewport?.removeEventListener("resize", scheduleViewportStateSync);
      visualViewport?.removeEventListener("scroll", scheduleViewportStateSync);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useLayoutEffect(() => {
    if (!(shouldForceMobilePreview || (mobileViewportState.isPhoneLike && activeTab === "matchday"))) {
      return;
    }

    const scheduleViewportSync = viewportSyncRef.current;
    if (!scheduleViewportSync) {
      return;
    }

    scheduleViewportSync();
    const frameId = window.requestAnimationFrame(() => {
      scheduleViewportSync();
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [
    activeTab,
    mobileLandscapePanel,
    mobileViewportState.isPhoneLike,
    shouldForceMobilePreview,
    showLineups,
  ]);

  useEffect(() => {
    if (!mobileViewportState.isPhoneLike) {
      return;
    }

    const { documentElement, body } = document;
    const previousHtmlOverflowY = documentElement.style.overflowY;
    const previousBodyOverflowY = body.style.overflowY;
    const previousHtmlOverscrollBehaviorY = documentElement.style.overscrollBehaviorY;
    const previousBodyOverscrollBehaviorY = body.style.overscrollBehaviorY;

    if (isImmersiveMobileMatchday) {
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
  }, [isImmersiveMobileMatchday, mobileViewportState.isPhoneLike]);

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

  useEffect(() => {
    if (!shouldForceMobilePreview || !forcedMobilePanel) {
      return;
    }

    setMobileLandscapePanel(forcedMobilePanel);
  }, [forcedMobilePanel, shouldForceMobilePreview]);

  const handleTabChange = useCallback(
    (nextTab: ShowcaseTab) => {
      if (nextTab === activeTab) {
        return;
      }

      startTabTransition(() => {
        setActiveTab(nextTab);

        if (shouldAutoOpenVoteOverlay) {
          setShowLineups(true);
          return;
        }

        if (nextTab === "leaderboard") {
          setShowLineups(false);
        }
      });
    },
    [activeTab, shouldAutoOpenVoteOverlay, startTabTransition],
  );

  const handleShowLineupsToggle = useCallback(() => {
    startPitchTransition(() => {
      setShowLineups((current) => !current);
    });
  }, [startPitchTransition]);

  useEffect(() => {
    if (!isImmersiveMobileMatchday) {
      setMobileLandscapePanel("hero");
      return;
    }

    setMobileLandscapePanel(forcedMobilePanel ?? "hero");
  }, [forcedMobilePanel, isImmersiveMobileMatchday, snapshot.match.id]);

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

  const heroShell = (
    <div
      className={`halisaha-hero-shell flex flex-col sm:gap-4 ${
        isImmersiveMobileMatchday
          ? "relative h-full justify-start border-b-0 gap-4 pb-2.5 sm:pb-3"
          : activeTab === "leaderboard" && isCompactMobileViewport
            ? "gap-2 border-b border-white/10 pb-2 sm:pb-3"
            : "gap-4 border-b border-white/10 pb-2.5 sm:pb-3"
      }`}
    >
      <HalisahaShowcaseTabs
        activeTab={activeTab}
        title={snapshot.match.title}
        onTabChange={handleTabChange}
        transitioning={isTabTransitionPending}
      />
      <HalisahaHeroSummary
        homeTeamName={snapshot.match.homeTeamName}
        awayTeamName={snapshot.match.awayTeamName}
        kickoffLabel={snapshot.match.kickoffLabel}
        venueName={snapshot.match.venueName}
        countdown={countdown}
        compactHorizontal={activeTab === "leaderboard" && isCompactMobileViewport}
      />
      {activeTab === "matchday" && isCompactMobileViewport ? <MobileHeroScrollCue /> : null}
    </div>
  );

  const pitchBoard = (
    <PitchBoard
      showLineups={showLineups}
      onToggle={handleShowLineupsToggle}
      homeTeamName={snapshot.match.homeTeamName}
      awayTeamName={snapshot.match.awayTeamName}
      homeLineup={homeLineup}
      awayLineup={awayLineup}
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
      useMobileScreen2Layout={isImmersiveMobileMatchday}
    />
  );

  const leaderboardPanel = (
    <div className="mt-1 flex min-h-0 flex-1 flex-col overflow-hidden">
      {!snapshot.gate.canRevealResults ? (
        <HalisahaResultsGateCard
          eyebrow={getGateEyebrow(snapshot.gate.mode)}
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
      aria-busy={isInteractionTransitionPending}
      className={`halisaha-shell relative isolate flex min-h-full flex-1 flex-col overflow-hidden rounded-[1.35rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.012),rgba(255,255,255,0.006))] px-3.5 py-3.5 text-white shadow-[0_22px_58px_rgba(0,0,0,0.24)] sm:rounded-[1.8rem] sm:px-4 sm:py-3.5 ${
        activeTab === "leaderboard"
          ? "lg:min-h-[calc(100dvh-5.25rem)]"
          : "lg:h-[calc(100dvh-5.25rem)] lg:min-h-0"
      }`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.005),transparent_26%,transparent_78%,rgba(255,255,255,0.006)_100%)]" />
      <ObserverVoteWindowNotice
        open={showObserverVoteNotice}
        onDismiss={dismissObserverVoteNotice}
      />

      {isImmersiveMobileMatchday ? (
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
        <div
          className={`halisaha-shell-body relative flex min-h-0 flex-1 flex-col ${
            activeTab === "leaderboard" && isCompactMobileViewport
              ? "gap-[6px]"
              : "gap-2"
          }`}
        >
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
            immersive {String(isImmersiveMobileMatchday)} | panel {mobileLandscapePanel}
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
  transitioning = false,
}: {
  activeTab: ShowcaseTab;
  title: string;
  onTabChange: (nextTab: ShowcaseTab) => void;
  transitioning?: boolean;
}) {
  const tabChrome =
    "inline-flex min-h-[2.5rem] items-center rounded-[1rem] border border-white/12 bg-white/[0.045] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]";

  return (
    <div
      className={`flex max-w-full flex-wrap items-stretch gap-2 transition-[opacity,transform] ${
        transitioning ? "opacity-90" : "opacity-100"
      }`}
      aria-busy={transitioning}
    >
      <div className={tabChrome}>
        <PrefetchLink
          href="/schedule"
          className="inline-flex h-full min-h-[2.25rem] min-w-[2.35rem] items-center justify-center rounded-[0.8rem] px-2.5 text-white/72 transition-[transform,color,background-color] active:scale-[0.98] hover:bg-white/[0.06] hover:text-white/88 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(12,12,12,0.9)]"
          aria-label="Back to Schedule"
          title="Schedule"
        >
          <IconHomeCompact />
        </PrefetchLink>
      </div>
      <div className={`${tabChrome} max-w-fit`}>
        <button
          type="button"
          onClick={() => onTabChange("matchday")}
          className={`inline-flex h-full min-h-[2.25rem] items-center rounded-[0.8rem] border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] transition-[transform,color,background-color,border-color] active:scale-[0.985] ${
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
          className={`inline-flex h-full min-h-[2.25rem] items-center rounded-[0.8rem] border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] transition-[transform,color,background-color,border-color] active:scale-[0.985] ${
            activeTab === "leaderboard"
              ? "border-white/10 bg-white/[0.07] text-white/82"
              : "border-transparent bg-transparent text-white/46 hover:text-white/68"
          }`}
        >
          Leaderboard
        </button>
      </div>
    </div>
  );
}

function HalisahaHeroSummary({
  homeTeamName,
  awayTeamName,
  kickoffLabel,
  venueName,
  countdown,
  compactHorizontal = false,
}: {
  homeTeamName: string;
  awayTeamName: string;
  kickoffLabel: string;
  venueName: string;
  countdown: string;
  compactHorizontal?: boolean;
}) {
  if (compactHorizontal) {
    return (
      <div className="halisaha-hero relative flex min-h-0 translate-y-[4px] flex-row items-center gap-3 overflow-hidden">
        {/* Left: team names + venue */}
        <div className="halisaha-hero-primary min-w-0 flex-1 shrink">
          <h1 className="halisaha-team-name text-[clamp(1.05rem,4.2vw,1.55rem)] font-semibold uppercase leading-[0.84] tracking-[0.012em] text-white">
            {homeTeamName}
          </h1>
          <div className="halisaha-away-vs-row mt-[0.05rem] flex flex-wrap items-baseline gap-x-2 gap-y-0">
            <span className="halisaha-vs-label shrink-0 translate-x-px text-[0.46rem] font-semibold uppercase tracking-[0.3em] text-white/54">
              vs
            </span>
            <p className="halisaha-team-name min-w-0 flex-1 text-[clamp(1.05rem,4.2vw,1.55rem)] font-semibold uppercase leading-[0.84] tracking-[0.012em] text-white">
              {awayTeamName}
            </p>
          </div>
          <div className="halisaha-venue-row mt-1 flex min-w-0 -translate-x-[15px] -translate-y-[8px] items-center gap-1.5">
            <div className="relative h-[2.4rem] w-[2.4rem] shrink-0">
              <Image
                src={trophyAsset}
                alt=""
                fill
                sizes="2.4rem"
                className="object-contain opacity-60"
                style={{ filter: "brightness(1.04) contrast(1.04) saturate(0.68) sepia(0.14) hue-rotate(148deg)" }}
              />
            </div>
            <div className="halisaha-venue-meta flex min-w-0 flex-col gap-0">
              <div className="halisaha-venue-kicker truncate text-[0.54rem] font-medium uppercase tracking-[0.22em] text-white/60">
                {kickoffLabel}
              </div>
              <div className="halisaha-venue-name truncate text-[0.66rem] font-medium uppercase tracking-[0.2em] text-white/80">
                {venueName}
              </div>
            </div>
          </div>
        </div>

        {/* Right: crests + countdown */}
        <div className="halisaha-hero-secondary halisaha-crest-stage shrink-0 -translate-y-[6px] flex flex-col items-center text-center">
          {/* Crest shifted upward for alignment with team block */}
          <div className="relative w-[6.4rem] -mt-[10px]">
            <RaynetCrest />
          </div>
          {/* Countdown sits below the crest, not overlapping */}
          <div className="halisaha-countdown-stage mt-[-0.3rem] flex flex-col items-center">
            <div className="halisaha-countdown-label text-[0.3rem] font-semibold uppercase leading-none tracking-[0.28em] text-[#d2e5e5]/80">
              Kickoff countdown
            </div>
            <div className="halisaha-countdown-value mt-[0.18rem] text-[0.62rem] font-black leading-none tracking-[0.06em] text-white tabular-nums">
              {countdown}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="halisaha-hero relative flex min-h-0 flex-col gap-1.25 sm:gap-1.5 lg:pr-[25.25rem] xl:pr-[28.5rem]">
      <div className="halisaha-hero-primary min-w-0 shrink-0">
        <h1 className="halisaha-team-name text-[clamp(2.55rem,6.8vw,5.7rem)] font-semibold uppercase leading-[0.78] tracking-[0.015em] text-white">
          {homeTeamName}
        </h1>
        <div className="halisaha-hero-post-home flex min-w-0 flex-col">
          <div className="halisaha-away-vs-row mt-[-0.06rem] flex flex-wrap items-end gap-x-3 gap-y-0">
            <span className="halisaha-vs-label shrink-0 pb-[0.18rem] text-[0.94rem] font-semibold uppercase tracking-[0.34em] text-white/56 sm:text-[1.08rem]">
              vs
            </span>
            <p className="halisaha-team-name min-w-0 flex-1 text-[clamp(2.55rem,6.8vw,5.7rem)] font-semibold uppercase leading-[0.78] tracking-[0.015em] text-white">
              {awayTeamName}
            </p>
          </div>

          <div className="halisaha-venue-row mt-0 flex min-w-0 items-center gap-3">
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
      </div>

      <div className="halisaha-hero-secondary halisaha-crest-stage mt-2 text-center sm:mt-2.5 lg:absolute lg:right-[-3.5rem] lg:top-[-1.8625rem] lg:mt-0 lg:w-[24rem] xl:right-[-4.05rem] xl:top-[-2.1125rem] xl:w-[27.6rem]">
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

function MobileHeroScrollCue() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[max(0.32rem,env(safe-area-inset-bottom,0px))] flex flex-col items-center justify-end px-4 text-center">
      <div className="text-[0.52rem] font-semibold uppercase tracking-[0.26em] text-white/52">
        Swipe up
      </div>
      <div className="halisaha-mobile-swipe-cue-arrow mt-[0.55rem] h-[0.72rem] w-[1.2rem]" aria-hidden />
      <div className="mt-[0.55rem] flex items-center justify-center">
        <div className="relative flex h-[2.72rem] w-[1.08rem] items-end justify-center rounded-full border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] px-[0.22rem] py-[0.28rem] shadow-[0_14px_28px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.03)]">
          <span className="halisaha-mobile-swipe-cue-dot h-[0.34rem] w-[0.34rem] rounded-full bg-[rgba(240,247,245,0.86)] shadow-[0_0_10px_rgba(255,255,255,0.14)]" />
        </div>
      </div>
      <div className="mt-[0.7rem] text-[0.42rem] font-medium uppercase tracking-[0.24em] text-white/26">
        for lineups
      </div>
    </div>
  );
}

function getGateEyebrow(mode: HalisahaPublicSnapshot["gate"]["mode"]) {
  return mode === "waiting_for_vote_window"
    ? "MVP voting in progress"
    : "MVP vote required";
}

function ObserverVoteWindowNotice({
  open,
  onDismiss,
}: {
  open: boolean;
  onDismiss: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(3,8,8,0.72)] px-4 backdrop-blur-[8px]">
      <div className="w-full max-w-[28rem] rounded-[1.2rem] border border-white/12 bg-[linear-gradient(180deg,rgba(9,16,15,0.96),rgba(7,12,12,0.92))] p-5 text-white shadow-[0_26px_60px_rgba(0,0,0,0.34)]">
        <div className="text-[0.56rem] font-semibold uppercase tracking-[0.2em] text-white/42">
          MVP voting update
        </div>
        <h3 className="mt-2 text-[1.02rem] font-semibold leading-tight text-white">
          Match results unlock after the 24-hour MVP vote
        </h3>
        <p className="mt-2 text-[0.78rem] leading-[1.65] text-white/68">
          The admin and the players who took part in this match are voting for the MVP during a
          24-hour window. When that window ends, the final MVP, correct answers, and leaderboard
          will become visible here.
        </p>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-full border border-white/14 bg-white/[0.08] px-4 py-[0.7rem] text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-white transition-colors hover:bg-white/[0.12]"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
}

function PitchBoard({
  showLineups,
  onToggle,
  homeTeamName,
  awayTeamName,
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
  useMobileScreen2Layout,
}: {
  showLineups: boolean;
  onToggle: () => void;
  homeTeamName: string;
  awayTeamName: string;
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
  useMobileScreen2Layout: boolean;
}) {
  const router = useRouter();
  const hasPublishedQuestions = questions.length > 0;
  const shouldShowPostMatchMvpVote =
    postMatchMvpVote.requiresVote && !postMatchMvpVote.hasUserVoted;
  const hasOverlayContent = shouldShowPostMatchMvpVote || hasPublishedQuestions;
  const showChallengeSurface = showLineups && hasOverlayContent;
  const usePortraitMobilePitch = useMobileScreen2Layout;
  const useCompactMobileChallengeLayout =
    useMobileScreen2Layout && showChallengeSurface;
  const useClosedPortraitPitchLayout = usePortraitMobilePitch && !showLineups;
  const renderInlineMobileBall = useCompactMobileChallengeLayout;
  const renderCenteredPitchBall = !renderInlineMobileBall;
  const [renderChallengeOverlay, setRenderChallengeOverlay] = useState(showChallengeSurface);
  const [isFinalizePromptOpen, setIsFinalizePromptOpen] = useState(false);
  const [isPlayerPickerOpen, setIsPlayerPickerOpen] = useState(false);
  const [hasUnsavedChallengeDrafts, setHasUnsavedChallengeDrafts] = useState(false);
  const lastSnapshotRefreshAtRef = useRef(Date.now());
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

  const refreshSnapshotIfSafe = useCallback(() => {
    if (hasUnsavedChallengeDrafts || overlayBlocksBall) {
      return;
    }
    const now = Date.now();
    if (now - lastSnapshotRefreshAtRef.current < 1500) {
      return;
    }
    lastSnapshotRefreshAtRef.current = now;
    router.refresh();
  }, [hasUnsavedChallengeDrafts, overlayBlocksBall, router]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refreshSnapshotIfSafe();
      }
    };

    window.addEventListener("focus", refreshSnapshotIfSafe, { passive: true });
    window.addEventListener("pageshow", refreshSnapshotIfSafe, { passive: true });
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", refreshSnapshotIfSafe);
      window.removeEventListener("pageshow", refreshSnapshotIfSafe);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshSnapshotIfSafe]);

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col ${
        useMobileScreen2Layout ? "gap-[0.42rem]" : "gap-1.5"
      }`}
    >
      <div className="halisaha-pitch-caption flex items-start justify-between gap-3 uppercase text-white/52">
        <div className="flex items-center gap-2.5">
          {renderInlineMobileBall ? (
            <MidfieldBallButton
              showLineups={showLineups}
              promptOpen={overlayBlocksBall}
              compactMobileBall
              inlineCompactBall
              label={
                shouldShowPostMatchMvpVote
                  ? showLineups
                    ? "Hide MVP vote"
                    : "Reveal MVP vote"
                  : undefined
              }
              onToggle={onToggle}
            />
          ) : null}
          <span
            className={`halisaha-pitch-format-label font-medium leading-none tracking-[0.18em] ${
              renderInlineMobileBall
                ? "text-[calc(3.15rem/6)] sm:text-[calc(3.15rem/6)]"
                : "text-[0.5rem] sm:text-[0.55rem]"
            }`}
          >
            7V7
          </span>
        </div>
        <span className="halisaha-pitch-status-label max-w-[68%] text-right text-[0.46rem] font-medium leading-[1.16] tracking-[0.18em] sm:max-w-none sm:text-[0.5rem]">
          {statusLabel}
        </span>
      </div>

      <div
        data-mobile-pitch-state={
          !showLineups && usePortraitMobilePitch
            ? "closed-portrait"
            : useCompactMobileChallengeLayout
              ? "open-compact"
              : undefined
        }
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
              ? "bg-[linear-gradient(180deg,rgba(255,255,255,0.016),transparent_22%,transparent_82%,rgba(255,255,255,0.026)),radial-gradient(circle_at_14%_112%,rgba(143,188,187,0.08),transparent_30%),radial-gradient(circle_at_86%_112%,rgba(94,129,172,0.06),transparent_32%)]"
              : "bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_24%,transparent_76%,rgba(255,255,255,0.018)),radial-gradient(circle_at_18%_10%,rgba(255,255,255,0.03),transparent_22%),radial-gradient(circle_at_84%_12%,rgba(255,255,255,0.025),transparent_24%),radial-gradient(circle_at_50%_100%,rgba(255,255,255,0.02),transparent_38%)]"
          }`}
        />

        <div
          className={`relative flex h-full min-h-[15.75rem] w-full min-w-0 justify-center sm:min-h-[19.25rem] ${
            useClosedPortraitPitchLayout ? "items-end pb-[0.28rem]" : "items-center"
          }`}
        >
          {/* Match SVG viewBox 1000×620: contain in parent so letterboxing is even (same band top/bottom as left/right). */}
          <div
            data-mobile-pitch-stage={usePortraitMobilePitch ? "portrait" : undefined}
            className={`halisaha-pitch-stage relative ${
              usePortraitMobilePitch
                ? "aspect-[620/1000] h-full max-h-full w-auto max-w-full"
                : "aspect-[1000/620] h-full max-h-full w-auto max-w-full"
            } min-h-0 min-w-0`}
          >
            <div
              className={`halisaha-pitch-stage-canvas transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                usePortraitMobilePitch
                  ? `absolute left-1/2 top-1/2 ${
                      showLineups
                        ? "h-[62.6%] w-[162.9%]"
                        : "h-[62.8%] w-[163.4%]"
                    } -translate-x-1/2 -translate-y-1/2 rotate-90`
                  : "absolute inset-0"
              }`}
            >
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
                  <PitchOverlay
                    homeTeamName={homeTeamName}
                    awayTeamName={awayTeamName}
                    homeLineup={homeLineup}
                    awayLineup={awayLineup}
                    showClosedTeamLabels={!showLineups}
                    portraitClosedLayout={usePortraitMobilePitch}
                    portraitNameDropShadow={showLineups}
                    stackThreeWordNames={useClosedPortraitPitchLayout}
                    closedPortraitDefenderInwardShift={
                      useClosedPortraitPitchLayout ? CLOSED_PORTRAIT_DEFENDER_INWARD_SVG_UNITS : 0
                    }
                    closedMidfieldTowardOwnGoalShiftSvgUnits={
                      !showLineups ? CLOSED_MIDFIELD_TOWARD_OWN_GOAL_SVG_UNITS : 0
                    }
                  />
                </div>
              ) : null}
            </div>
          </div>
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
                  onDraftStateChange={setHasUnsavedChallengeDrafts}
                  compactMobileLayout={useCompactMobileChallengeLayout}
                />
              )}
            </div>
          ) : null}
          {renderCenteredPitchBall ? (
            <MidfieldBallButton
              showLineups={showLineups}
              promptOpen={overlayBlocksBall}
              compactMobileBall={useCompactMobileChallengeLayout}
              closedPortraitNudgeUp={useClosedPortraitPitchLayout}
              label={
                shouldShowPostMatchMvpVote
                  ? showLineups
                    ? "Hide MVP vote"
                    : "Reveal MVP vote"
                  : undefined
              }
              onToggle={onToggle}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

const PITCH_VIEWBOX_HEIGHT = 620;
/** ViewBox units: mobilde slicer kapalıyken defans isimlerini sahada merkeze doğru */
const CLOSED_PORTRAIT_DEFENDER_INWARD_SVG_UNITS = 10;
/** ViewBox units: slicer kapalıyken sadece orta saha isimlerini kendi kalelerine doğru 1u çek */
const CLOSED_MIDFIELD_TOWARD_OWN_GOAL_SVG_UNITS = 1;

function normalizeClosedPitchTeamLabel(name: string) {
  return name.trim().replace(/\s+/g, " ").toUpperCase();
}

function ClosedPitchTeamLabel({
  side,
  teamName,
}: {
  side: "left" | "right";
  teamName: string;
}) {
  const normalizedTeamName = normalizeClosedPitchTeamLabel(teamName);
  const isLeft = side === "left";
  const lineStartX = isLeft ? 52 : 768;
  const lineEndX = isLeft ? 232 : 948;
  const kickerY = 575;
  const labelY = 592;
  const textWidth = 162;
  const shouldConstrain = normalizedTeamName.length > 15;
  const alignment = isLeft ? "start" : "end";
  const textX = isLeft ? 52 : 948;
  const accentCircleX = isLeft ? 44 : 956;

  return (
    <g data-pitch-team-label-side={side} aria-hidden="true">
      <circle
        cx={accentCircleX}
        cy={592}
        r="2.9"
        fill="rgba(245,248,246,0.84)"
        stroke="rgba(0,0,0,0.55)"
        strokeWidth="0.85"
      />
      <path
        d={`M${lineStartX} 592 H${lineEndX}`}
        stroke="rgba(235,241,238,0.22)"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
      <text
        x={textX}
        y={kickerY}
        textAnchor={alignment}
        fill="rgba(230,236,233,0.42)"
        fontSize="6.2"
        fontWeight="600"
        letterSpacing="3.1"
        fontFamily="system-ui, sans-serif"
      >
        {isLeft ? "HOME CLUB" : "AWAY CLUB"}
      </text>
      <text
        x={textX}
        y={labelY}
        textAnchor={alignment}
        fill="rgba(247,250,248,0.92)"
        stroke="rgba(8,10,10,0.82)"
        strokeWidth="0.9"
        paintOrder="stroke"
        fontSize="13.4"
        fontWeight="700"
        letterSpacing="2.9"
        fontFamily="system-ui, sans-serif"
        {...(shouldConstrain
          ? {
              textLength: textWidth,
              lengthAdjust: "spacingAndGlyphs" as const,
            }
          : {})}
      >
        {normalizedTeamName}
      </text>
    </g>
  );
}

function ClosedPortraitPitchTeamLabels({
  homeTeamName,
  awayTeamName,
}: {
  homeTeamName: string;
  awayTeamName: string;
}) {
  return (
    <>
      <ClosedPortraitPitchTeamLabel
        dataSide="left"
        kicker="HOME CLUB"
        teamName={homeTeamName}
        anchorX={52}
        anchorY={592}
      />
      <ClosedPortraitPitchTeamLabel
        dataSide="right"
        kicker="AWAY CLUB"
        teamName={awayTeamName}
        anchorX={948}
        anchorY={592}
      />
    </>
  );
}

function ClosedPortraitPitchTeamLabel({
  dataSide,
  kicker,
  teamName,
  anchorX,
  anchorY,
}: {
  dataSide: "left" | "right";
  kicker: string;
  teamName: string;
  anchorX: number;
  anchorY: number;
}) {
  const normalizedTeamName = normalizeClosedPitchTeamLabel(teamName);
  const textWidth = 126;
  const shouldConstrain = normalizedTeamName.length > 14;

  return (
    <g
      data-pitch-team-label-layout="portrait"
      data-pitch-team-label-side={dataSide}
      transform={`translate(${anchorX} ${anchorY}) rotate(-90)`}
      aria-hidden="true"
    >
      <circle
        cx="-8"
        cy="0"
        r="2.4"
        fill="rgba(245,248,246,0.82)"
        stroke="rgba(0,0,0,0.52)"
        strokeWidth="0.75"
      />
      <path
        d="M0 0 H58"
        stroke="rgba(235,241,238,0.24)"
        strokeWidth="1.05"
        strokeLinecap="round"
      />
      <text
        x="0"
        y="-8.8"
        textAnchor="start"
        fill="rgba(230,236,233,0.38)"
        fontSize="4.8"
        fontWeight="600"
        letterSpacing="2.3"
        fontFamily="system-ui, sans-serif"
      >
        {kicker}
      </text>
      <text
        x="0"
        y="12"
        textAnchor="start"
        fill="rgba(247,250,248,0.9)"
        stroke="rgba(8,10,10,0.78)"
        strokeWidth="0.78"
        paintOrder="stroke"
        fontSize="9.15"
        fontWeight="700"
        letterSpacing="1.55"
        fontFamily="system-ui, sans-serif"
        {...(shouldConstrain
          ? {
              textLength: textWidth,
              lengthAdjust: "spacingAndGlyphs" as const,
            }
          : {})}
      >
        {normalizedTeamName}
      </text>
    </g>
  );
}

/** Nudge first-line tspan (em) so stacked 3-word labels in each occupied line share a line. */
function computeStackedFirstLineDyEmExtra(
  players: ReadonlyArray<PlayerSpot>,
): Map<HalisahaPositionKey, number> {
  const out = new Map<HalisahaPositionKey, number>();
  const groupedPlayers = new Map<HalisahaPositionLineGroup, PlayerSpot[]>();

  for (const player of players) {
    if (!player.lineGroup || player.lineGroup === "goalkeeper") {
      continue;
    }

    if (!groupedPlayers.has(player.lineGroup)) {
      groupedPlayers.set(player.lineGroup, []);
    }
    groupedPlayers.get(player.lineGroup)?.push(player);
  }

  for (const inGroup of groupedPlayers.values()) {
    if (inGroup.length < 2) continue;

    const avgY = inGroup.reduce((sum, p) => sum + p.y, 0) / inGroup.length;
    for (const player of inGroup) {
      out.set(player.positionKey, ((avgY - player.y) / PITCH_VIEWBOX_HEIGHT) * 2.6);
    }
  }

  return out;
}

function PitchOverlay({
  homeTeamName,
  awayTeamName,
  homeLineup,
  awayLineup,
  showClosedTeamLabels = false,
  portraitClosedLayout = false,
  portraitNameDropShadow = true,
  stackThreeWordNames = false,
  closedPortraitDefenderInwardShift = 0,
  closedMidfieldTowardOwnGoalShiftSvgUnits = 0,
}: {
  homeTeamName: string;
  awayTeamName: string;
  homeLineup: PlayerSpot[];
  awayLineup: PlayerSpot[];
  showClosedTeamLabels?: boolean;
  portraitClosedLayout?: boolean;
  /** Mobile portrait pitch: extra name drop-shadow when lineup slicers are open; off when closed. */
  portraitNameDropShadow?: boolean;
  stackThreeWordNames?: boolean;
  closedPortraitDefenderInwardShift?: number;
  /** ViewBox units: only midfield labels nudged toward own goal while slicers stay closed. */
  closedMidfieldTowardOwnGoalShiftSvgUnits?: number;
}) {
  const homeLine1DyExtra = useMemo(
    () => (stackThreeWordNames ? computeStackedFirstLineDyEmExtra(homeLineup) : new Map()),
    [homeLineup, stackThreeWordNames],
  );
  const awayLine1DyExtra = useMemo(
    () => (stackThreeWordNames ? computeStackedFirstLineDyEmExtra(awayLineup) : new Map()),
    [awayLineup, stackThreeWordNames],
  );

  return (
    <svg
      viewBox="0 0 1000 620"
      preserveAspectRatio="xMidYMid meet"
      className="absolute inset-0 z-10 h-full w-full"
      fill="none"
    >
      {showClosedTeamLabels ? (
        portraitClosedLayout ? (
          <ClosedPortraitPitchTeamLabels
            homeTeamName={homeTeamName}
            awayTeamName={awayTeamName}
          />
        ) : (
          <>
            <ClosedPitchTeamLabel side="left" teamName={homeTeamName} />
            <ClosedPitchTeamLabel side="right" teamName={awayTeamName} />
          </>
        )
      ) : null}

      {homeLineup.map((player) => (
        <PitchPlayerLabel
          key={`home-${player.name}`}
          player={player}
          side="left"
          portraitClosedLayout={portraitClosedLayout}
          nameDropShadow={portraitClosedLayout && portraitNameDropShadow}
          stackThreeWordNames={stackThreeWordNames}
          stackedFirstLineDyEmExtra={homeLine1DyExtra}
          defenderInwardShiftSvgUnits={closedPortraitDefenderInwardShift}
          midfieldTowardOwnGoalShiftSvgUnits={closedMidfieldTowardOwnGoalShiftSvgUnits}
        />
      ))}

      {awayLineup.map((player) => (
        <PitchPlayerLabel
          key={`away-${player.name}`}
          player={player}
          side="right"
          portraitClosedLayout={portraitClosedLayout}
          nameDropShadow={portraitClosedLayout && portraitNameDropShadow}
          stackThreeWordNames={stackThreeWordNames}
          stackedFirstLineDyEmExtra={awayLine1DyExtra}
          defenderInwardShiftSvgUnits={closedPortraitDefenderInwardShift}
          midfieldTowardOwnGoalShiftSvgUnits={closedMidfieldTowardOwnGoalShiftSvgUnits}
        />
      ))}
    </svg>
  );
}

function MidfieldBallButton({
  showLineups,
  promptOpen,
  compactMobileBall = false,
  inlineCompactBall = false,
  closedPortraitNudgeUp = false,
  label,
  onToggle,
}: {
  showLineups: boolean;
  promptOpen: boolean;
  compactMobileBall?: boolean;
  inlineCompactBall?: boolean;
  closedPortraitNudgeUp?: boolean;
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
      className={`${
        inlineCompactBall
          ? `relative ${promptOpen ? "z-[12]" : "z-20"} shrink-0`
          : `absolute left-1/2 ${promptOpen ? "z-[12]" : "z-20"} -translate-x-1/2 -translate-y-1/2`
      } flex items-center justify-center appearance-none border-0 bg-transparent p-0 outline-none ring-0 transition-[width,height,box-shadow,transform,top] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] focus:outline-none focus-visible:outline-none focus-visible:ring-0 ${
        showLineups
          ? compactMobileBall
            ? inlineCompactBall
              ? "h-[3.15rem] w-[3.15rem] shadow-none"
              : "h-[2.88rem] w-[2.88rem] shadow-none sm:h-[3.05rem] sm:w-[3.05rem]"
            : "h-[4.32rem] w-[4.32rem] shadow-none sm:h-[4.5rem] sm:w-[4.5rem]"
          : "aspect-square w-[12.16%] min-w-[6.12rem] max-w-[7.36rem] shadow-[0_12px_22px_rgba(0,0,0,0.2)]"
      }`}
      style={{
        top: inlineCompactBall
          ? undefined
          : showLineups
            ? "calc(50% + 4px)"
            : closedPortraitNudgeUp
              ? "calc(50% + 1.5px)"
              : "calc(50% + 4.5px)",
        transform: inlineCompactBall
          ? undefined
          : `translate(${showLineups ? "-50%" : "calc(-50% - 0.5px)"}, -50%) scale(${showLineups ? 0.98 : 1})`,
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
            ? compactMobileBall
              ? inlineCompactBall
                ? "h-[3.15rem] w-[3.15rem] shadow-[0_5px_16px_rgba(0,0,0,0.2)]"
                : "h-[2.58rem] w-[2.58rem] shadow-[0_4px_12px_rgba(0,0,0,0.18)]"
              : "h-[3.87rem] w-[3.87rem] shadow-[0_6px_18px_rgba(0,0,0,0.2)]"
            : "h-full w-full"
        }`}
      >
        <Image
          src={midfieldBallAsset}
          alt=""
          fill
          sizes={
            showLineups
              ? compactMobileBall
                ? inlineCompactBall
                  ? "3.15rem"
                  : "(min-width: 640px) 2.58rem, 2.58rem"
                : "(min-width: 640px) 3.87rem, 3.87rem"
              : "(min-width: 640px) 9.2rem, 7.65rem"
          }
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
    <div className="halisaha-crest-scale-wrap relative aspect-[757/433] w-full overflow-visible">
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

function splitThreeWordPlayerName(
  name: string,
  enabled: boolean,
): { mode: "single"; text: string } | { mode: "stack"; first: string; second: string } {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (enabled && words.length === 3) {
    return {
      mode: "stack",
      first: `${words[0]} ${words[1]}`.toUpperCase(),
      second: words[2].toUpperCase(),
    };
  }
  return { mode: "single", text: name.trim().toUpperCase() };
}

function PitchPlayerLabel({
  player,
  side,
  portraitClosedLayout = false,
  nameDropShadow = false,
  stackThreeWordNames = false,
  stackedFirstLineDyEmExtra,
  defenderInwardShiftSvgUnits = 0,
  midfieldTowardOwnGoalShiftSvgUnits = 0,
}: {
  player: PlayerSpot;
  side: "left" | "right";
  portraitClosedLayout?: boolean;
  nameDropShadow?: boolean;
  stackThreeWordNames?: boolean;
  stackedFirstLineDyEmExtra?: ReadonlyMap<HalisahaPositionKey, number>;
  defenderInwardShiftSvgUnits?: number;
  midfieldTowardOwnGoalShiftSvgUnits?: number;
}) {
  const labelRotation = portraitClosedLayout ? -90 : side === "left" ? -90 : 90;
  // Larger font + heavy outline in portrait-closed for crisp legibility on small screens
  const fontSize = portraitClosedLayout ? 20.5 : 11.9;
  const strokeWidth = portraitClosedLayout ? 2.8 : 0.72;
  const strokeColor = portraitClosedLayout ? "rgba(0,0,0,0.96)" : "rgba(20,6,6,0.88)";
  const letterSpacing = portraitClosedLayout ? 1.65 : 1.1;
  const lines = splitThreeWordPlayerName(player.name, stackThreeWordNames);
  const line1DyExtraEm =
    lines.mode === "stack" ? (stackedFirstLineDyEmExtra?.get(player.positionKey) ?? 0) : 0;
  /** No negative base dy: a −0.55em offset vertically centers the two-line block and misaligns line 1 vs single-line names (slicers closed). */
  const line1DyEm = line1DyExtraEm;
  const isDefender = player.lineGroup === "defense";
  const inward = defenderInwardShiftSvgUnits > 0 && isDefender ? defenderInwardShiftSvgUnits : 0;
  const towardOwn =
    midfieldTowardOwnGoalShiftSvgUnits > 0 && player.lineGroup === "midfield"
      ? midfieldTowardOwnGoalShiftSvgUnits
      : 0;
  // Home (left): own goal is −x. Away (right): own goal is +x.
  const labelX = player.x + (side === "left" ? inward - towardOwn : -inward + towardOwn);

  return (
    <g transform={`translate(${labelX} ${player.y}) rotate(${labelRotation})`}>
      {/* Drop-shadow pass: only when mobile portrait + lineup slicers open */}
      {nameDropShadow && (
        <text
          x="0"
          y="1.5"
          textAnchor="middle"
          dominantBaseline="central"
          fill="none"
          stroke="rgba(0,0,0,0.55)"
          strokeWidth={portraitClosedLayout ? 5.5 : 1.4}
          fontSize={fontSize}
          fontWeight="650"
          letterSpacing={letterSpacing}
          fontFamily="system-ui, sans-serif"
          aria-hidden
        >
          {lines.mode === "single" ? (
            lines.text
          ) : (
            <>
              <tspan x="0" dy={`${line1DyEm}em`}>{lines.first}</tspan>
              <tspan x="0" dy="1.12em">{lines.second}</tspan>
            </>
          )}
        </text>
      )}
      <text
        x="0"
        y="0"
        textAnchor="middle"
        dominantBaseline="central"
        fill="#FF6B6B"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        paintOrder="stroke"
        fontSize={fontSize}
        fontWeight="650"
        letterSpacing={letterSpacing}
        fontFamily="system-ui, sans-serif"
      >
        {lines.mode === "single" ? (
          lines.text
        ) : (
          <>
            <tspan x="0" dy={`${line1DyEm}em`}>
              {lines.first}
            </tspan>
            <tspan x="0" dy="1.12em">
              {lines.second}
            </tspan>
          </>
        )}
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

export function buildTeamLineup(
  snapshot: HalisahaPublicSnapshot,
  teamSide: "home" | "away",
) {
  const formation =
    teamSide === "home" ? snapshot.match.homeFormation : snapshot.match.awayFormation;

  return snapshot.participants
    .filter((participant) => participant.teamSide === teamSide)
    .map((participant) => {
      const spot = getPitchSpot(teamSide, formation, participant.positionKey);
      if (!spot) return null;

      return {
        name: participant.displayName,
        x: spot.x,
        y: spot.y,
        positionKey: participant.positionKey,
        lineGroup: getHalisahaPositionLineGroup(formation, participant.positionKey),
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
