import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { HalisahaPublicSnapshot } from "@/lib/halisaha/server";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({
    prefetch: () => Promise.resolve(),
  }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children?: ReactNode;
    prefetch?: boolean;
  }) => {
    const { prefetch, ...anchorProps } = props;
    void prefetch;
    return createElement("a", { href, ...anchorProps }, children);
  },
}));

vi.mock("next/image", () => ({
  default: (props: {
    src: string | { src?: string };
    alt: string;
    fill?: boolean;
    priority?: boolean;
  }) => {
    const { src, alt, ...imgProps } = props;

    // Strip Next.js-only props so the test render stays warning-free.
    delete imgProps.fill;
    delete imgProps.priority;

    return createElement("img", {
      src: typeof src === "string" ? src : src?.src,
      alt,
      ...imgProps,
    });
  },
}));

function createParticipant(
  id: string,
  displayName: string,
  teamSide: "home" | "away",
  positionKey:
    | "goalkeeper"
    | "left_defender"
    | "center_defender"
    | "right_defender"
    | "left_wing"
    | "left_midfielder"
    | "center_midfield"
    | "right_midfielder"
    | "right_wing"
    | "left_forward"
    | "right_forward"
    | "striker",
  displayOrder: number,
) {
  return {
    id,
    displayName,
    teamSide,
    positionKey,
    positionLabel: positionKey,
    displayOrder,
  };
}

function createSnapshot(input?: {
  homeFormation?: HalisahaPublicSnapshot["match"]["homeFormation"];
  awayFormation?: HalisahaPublicSnapshot["match"]["awayFormation"];
  participants?: HalisahaPublicSnapshot["participants"];
  requiresPostMatchVote?: boolean;
}): HalisahaPublicSnapshot {
  const kickoffAtIso = "2026-03-30T18:00:00.000Z";
  const matchEndAtIso = "2026-03-30T19:00:00.000Z";
  const voteEndsAtIso = "2026-03-30T20:00:00.000Z";

  return {
    match: {
      id: "match-1",
      title: "RayNET Matchday Show",
      homeTeamName: "Raynet Glory",
      awayTeamName: "Flexera Club",
      venueName: "Hitabspor Arena",
      homeFormation: input?.homeFormation ?? "f1_2_3_1",
      awayFormation: input?.awayFormation ?? "f1_2_3_1",
      kickoffAtIso,
      kickoffLabel: "30 MAR 2026 | 21:00",
      matchDurationMinutes: 60,
      matchEndAtIso,
      mvpVoteEndsAtIso: voteEndsAtIso,
      phase: "pre_match",
      answersResolved: false,
      canRevealResults: true,
    },
    participants:
      input?.participants ?? [
        createParticipant("home-gk", "Ata Ekren", "home", "goalkeeper", 1),
        createParticipant("home-ld", "Deniz Akar", "home", "left_defender", 2),
        createParticipant("home-rd", "Berkay Sahin", "home", "right_defender", 3),
        createParticipant("home-lw", "Ege Ozturk", "home", "left_wing", 4),
        createParticipant("home-cm", "Eren Durak", "home", "center_midfield", 5),
        createParticipant("home-rw", "Eren Ayvaz", "home", "right_wing", 6),
        createParticipant("home-st", "Ata Sezgin", "home", "striker", 7),
        createParticipant("away-gk", "Abdullaki Toy", "away", "goalkeeper", 8),
        createParticipant("away-ld", "Ahmet Ozgur Korkmaz", "away", "left_defender", 9),
        createParticipant("away-rd", "Abdullah Akaydin", "away", "right_defender", 10),
        createParticipant("away-lw", "Arda Karabel", "away", "left_wing", 11),
        createParticipant("away-cm", "Anil Sezgin", "away", "center_midfield", 12),
        createParticipant("away-rw", "Alptug Kafkasli", "away", "right_wing", 13),
        createParticipant("away-st", "Arda Tuna", "away", "striker", 14),
      ],
    questions: [],
    standardQuestions: [],
    winnerQuestion: null,
    winnerVoteSummary: null,
    userAnswers: {},
    userAnswersLocked: false,
    gate: {
      phase: "pre_match",
      mode: "open",
      requiresPostMatchVote: false,
      hasSubmittedPostMatchVote: false,
      canRevealResults: true,
      title: "Results available",
      description: "Your saved answers stay visible here until the match ends.",
      buttonLabel: "Open Matchday",
      ctaHref: "/halisaha",
    },
    postMatchMvpVote: {
      prompt: "Who was the MVP?",
      votingWindowOpen: false,
      requiresVote: input?.requiresPostMatchVote ?? false,
      hasUserVoted: false,
      voteEndsAtIso,
      resolvedParticipantId: null,
      resolvedParticipantName: null,
      userVoteParticipantId: null,
      userVoteSubmittedAtIso: null,
      userVoteIsCorrect: null,
      participants: [],
    },
    results: [],
  };
}

describe("HalisahaMatchShowcase mobile render", () => {
  it("renders the bottom scroll cue for the compact mobile first screen", async () => {
    const ReactModule = await import("react");
    Object.assign(globalThis, { React: ReactModule });
    const { HalisahaMatchShowcase } = await import("../halisaha-match-showcase");
    const html = renderToStaticMarkup(
      createElement(HalisahaMatchShowcase, {
        snapshot: createSnapshot(),
        viewerCanManageOwnAnswerLock: false,
        initialPhoneLikeViewport: true,
      }),
    );

    expect(html).toContain("Swipe up");
    expect(html).toContain("for lineups");
    expect(html).not.toContain("Scroll down");
    expect(html).not.toContain("Share lineup image");
  }, 10_000);

  it("renders premium pitch team labels when the lineup slicers stay closed", async () => {
    const ReactModule = await import("react");
    Object.assign(globalThis, { React: ReactModule });
    const { HalisahaMatchShowcase } = await import("../halisaha-match-showcase");
    const html = renderToStaticMarkup(
      createElement(HalisahaMatchShowcase, {
        snapshot: createSnapshot(),
        viewerCanManageOwnAnswerLock: false,
      }),
    );

    expect(html).toContain('data-pitch-team-label-side="left"');
    expect(html).toContain('data-pitch-team-label-side="right"');
    expect(html).toContain("RAYNET GLORY");
    expect(html).toContain("FLEXERA CLUB");
  });

  it("renders premium portrait pitch team labels for the phone layout", async () => {
    const ReactModule = await import("react");
    Object.assign(globalThis, { React: ReactModule });
    const { HalisahaMatchShowcase } = await import("../halisaha-match-showcase");
    const html = renderToStaticMarkup(
      createElement(HalisahaMatchShowcase, {
        snapshot: createSnapshot(),
        viewerCanManageOwnAnswerLock: false,
        initialPhoneLikeViewport: true,
      }),
    );

    expect(html).toContain('data-pitch-team-label-layout="portrait"');
    expect(html).toContain("HOME CLUB");
    expect(html).toContain("AWAY CLUB");
  });

  it("uses formation-specific pitch coordinates for alternate tactics", async () => {
    const { buildTeamLineup } = await import("../halisaha-match-showcase");
    const snapshot = createSnapshot({
      homeFormation: "f1_3_2_1",
      awayFormation: "f1_2_3_1",
      participants: [
        createParticipant("home-gk", "Home Keeper", "home", "goalkeeper", 10),
        createParticipant("home-cd", "Center Wall", "home", "center_defender", 30),
        createParticipant("home-rm", "Right Engine", "home", "right_midfielder", 60),
        createParticipant("away-gk", "Away Keeper", "away", "goalkeeper", 10),
        createParticipant("away-st", "Away Striker", "away", "striker", 70),
      ],
    });

    const homeLineup = buildTeamLineup(snapshot, "home");

    expect(homeLineup).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Center Wall",
          x: 208,
          y: 310,
          positionKey: "center_defender",
        }),
        expect.objectContaining({
          name: "Right Engine",
          x: 326,
          y: 400,
          positionKey: "right_midfielder",
        }),
      ]),
    );
  });
});
