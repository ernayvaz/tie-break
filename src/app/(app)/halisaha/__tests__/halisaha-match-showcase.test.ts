import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { HalisahaPublicSnapshot } from "@/lib/halisaha/server";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    prefetch: _prefetch,
    ...props
  }: {
    href: string;
    children?: ReactNode;
    prefetch?: boolean;
  }) => createElement("a", { href, ...props }, children),
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
    | "right_defender"
    | "left_wing"
    | "center_midfield"
    | "right_wing"
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

function createSnapshot(): HalisahaPublicSnapshot {
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
      kickoffAtIso,
      kickoffLabel: "30 MAR 2026 | 21:00",
      matchDurationMinutes: 60,
      matchEndAtIso,
      mvpVoteEndsAtIso: voteEndsAtIso,
      phase: "pre_match",
      answersResolved: false,
      canRevealResults: false,
    },
    participants: [
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
      requiresPostMatchVote: false,
      hasSubmittedPostMatchVote: false,
      canRevealResults: false,
      title: "Results locked",
      description: "Post-match MVP voting unlocks the results.",
      buttonLabel: "Vote MVP",
      ctaHref: "/halisaha?postMatchVote=1",
    },
    postMatchMvpVote: {
      prompt: "Who was the MVP?",
      votingWindowOpen: false,
      requiresVote: false,
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
  });
});
