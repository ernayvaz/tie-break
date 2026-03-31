import { describe, expect, it } from "vitest";
import {
  buildHalisahaMvpGateState,
  getMatchingFixedScoreOptionIds,
  isCustomScoreExactMatch,
  maskHalisahaAnswerForGate,
  shouldRevealWinnerPercentages,
} from "@/lib/halisaha/rules";

describe("halisaha/rules", () => {
  describe("buildHalisahaMvpGateState", () => {
    it("does not require a post-match vote before the match ends", () => {
      expect(
        buildHalisahaMvpGateState({
          phase: "pre_match",
          hasSubmittedPostMatchVote: false,
        }),
      ).toMatchObject({
        requiresPostMatchVote: false,
        canRevealResults: true,
        buttonLabel: "Go to MVP vote",
      });
    });

    it("keeps results locked until the user submits the MVP vote after the match", () => {
      expect(
        buildHalisahaMvpGateState({
          phase: "post_match_mvp_voting",
          hasSubmittedPostMatchVote: false,
        }),
      ).toMatchObject({
        requiresPostMatchVote: true,
        canRevealResults: false,
      });

      expect(
        buildHalisahaMvpGateState({
          phase: "results_unlocked",
          hasSubmittedPostMatchVote: true,
        }),
      ).toMatchObject({
        requiresPostMatchVote: true,
        canRevealResults: true,
      });
    });

    it("skips the MVP gate for non-participant non-admin viewers after the match", () => {
      expect(
        buildHalisahaMvpGateState({
          phase: "post_match_mvp_voting",
          hasSubmittedPostMatchVote: false,
          shouldRequireVote: false,
        }),
      ).toMatchObject({
        requiresPostMatchVote: false,
        canRevealResults: true,
      });
    });

    it("keeps admin and participant viewers gated until they submit the MVP vote", () => {
      expect(
        buildHalisahaMvpGateState({
          phase: "results_unlocked",
          hasSubmittedPostMatchVote: false,
          shouldRequireVote: true,
        }),
      ).toMatchObject({
        requiresPostMatchVote: true,
        canRevealResults: false,
      });
    });
  });

  describe("maskHalisahaAnswerForGate", () => {
    const baseAnswer = {
      selectedOptionId: "option-1",
      customScoreHome: 2,
      customScoreAway: 0,
      isCorrect: true,
      awardedPoints: 3,
      isFinal: true,
      finalizedAtIso: "2026-03-29T10:00:00.000Z",
    };

    it("keeps the answer details intact when results are visible", () => {
      expect(maskHalisahaAnswerForGate(baseAnswer, false)).toEqual(baseAnswer);
    });

    it("hides correctness and awarded points while keeping the saved selection intact", () => {
      expect(maskHalisahaAnswerForGate(baseAnswer, true)).toEqual({
        ...baseAnswer,
        isCorrect: null,
        awardedPoints: 0,
      });
    });
  });

  describe("shouldRevealWinnerPercentages", () => {
    it("reveals WHO WINS percentages before kickoff only after the user locks answers", () => {
      expect(
        shouldRevealWinnerPercentages({
          phase: "pre_match",
          userAnswersLocked: true,
          canRevealResults: true,
          hasWinnerVoteSummary: true,
        }),
      ).toBe(true);

      expect(
        shouldRevealWinnerPercentages({
          phase: "pre_match",
          userAnswersLocked: false,
          canRevealResults: true,
          hasWinnerVoteSummary: true,
        }),
      ).toBe(false);
    });

    it("keeps WHO WINS percentages hidden until the user locks answers even after kickoff", () => {
      expect(
        shouldRevealWinnerPercentages({
          phase: "results_unlocked",
          userAnswersLocked: true,
          canRevealResults: false,
          hasWinnerVoteSummary: true,
        }),
      ).toBe(true);

      expect(
        shouldRevealWinnerPercentages({
          phase: "results_unlocked",
          userAnswersLocked: false,
          canRevealResults: true,
          hasWinnerVoteSummary: true,
        }),
      ).toBe(false);
    });
  });

  describe("getMatchingFixedScoreOptionIds", () => {
    it("returns only the fixed score options that exactly match the resolved score", () => {
      expect(
        getMatchingFixedScoreOptionIds({
          actualScore: {
            home: 6,
            away: 4,
          },
          options: [
            { id: "correct", label: "6-4", kind: "standard" },
            { id: "wrong", label: "4-6", kind: "standard" },
            { id: "ignored-custom", label: "Your exact score", kind: "custom_score" },
            { id: "ignored-invalid", label: "many goals", kind: "standard" },
          ],
        }),
      ).toEqual(["correct"]);
    });
  });

  describe("isCustomScoreExactMatch", () => {
    it("returns true only for an exact home-away score match", () => {
      expect(
        isCustomScoreExactMatch({
          actualScore: {
            home: 12,
            away: 5,
          },
          customScoreHome: 12,
          customScoreAway: 5,
        }),
      ).toBe(true);

      expect(
        isCustomScoreExactMatch({
          actualScore: {
            home: 12,
            away: 5,
          },
          customScoreHome: 5,
          customScoreAway: 12,
        }),
      ).toBe(false);

      expect(
        isCustomScoreExactMatch({
          actualScore: {
            home: 12,
            away: 5,
          },
          customScoreHome: null,
          customScoreAway: 5,
        }),
      ).toBe(false);
    });
  });
});
