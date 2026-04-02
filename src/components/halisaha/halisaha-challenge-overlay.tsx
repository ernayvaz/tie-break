"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  finalizeHalisahaAnswersAction,
  unlockHalisahaAnswersAction,
} from "@/app/(app)/halisaha/actions";
import { getHalisahaPlayerPickerOptionGroups } from "@/lib/halisaha/question-option-utils";
import { HalisahaQuestionCard } from "./halisaha-question-card";
import type {
  HalisahaPublicAnswerState,
  HalisahaPublicQuestion,
  HalisahaWinnerVoteSummary,
} from "@/lib/halisaha/server";
import crestAsset from "../../../2_LOGO-fitted.png";

type NumberedQuestion = {
  question: HalisahaPublicQuestion;
  questionNumber: number;
};

type DraftAnswerState = {
  selectedOptionId: string;
  customScoreHome: number | null;
  customScoreAway: number | null;
};

function getEmptyDraftAnswer(): DraftAnswerState {
  return {
    selectedOptionId: "",
    customScoreHome: null,
    customScoreAway: null,
  };
}

function areDraftAnswersEqual(
  left: DraftAnswerState | undefined,
  right: DraftAnswerState | undefined,
) {
  const normalizedLeft = left ?? getEmptyDraftAnswer();
  const normalizedRight = right ?? getEmptyDraftAnswer();
  return (
    normalizedLeft.selectedOptionId === normalizedRight.selectedOptionId &&
    normalizedLeft.customScoreHome === normalizedRight.customScoreHome &&
    normalizedLeft.customScoreAway === normalizedRight.customScoreAway
  );
}

function questionHasPlayerPickerRow(question: HalisahaPublicQuestion) {
  return (
    question.kind === "mvp_prediction" ||
    question.kind === "player_prediction" ||
    question.options.some((option) => option.kind === "player_picker" || Boolean(option.participantId))
  );
}

type WinnerSelectionTone = "home" | "away" | "neutral";

const OPAQUE_WINNER_SAVE_BUTTON_STYLES: Record<
  WinnerSelectionTone,
  {
    fill: string;
    glow: string;
    bubble: string;
    borderColor: string;
    textColor: string;
  }
> = {
  home: {
    fill:
      "linear-gradient(90deg, rgba(144,53,61,1) 0%, rgba(188,83,89,0.98) 54%, rgba(233,160,152,0.82) 100%)",
    glow:
      "radial-gradient(circle at 20% 50%, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.08) 28%, transparent 64%)",
    bubble:
      "radial-gradient(circle, rgba(255,214,210,0.28) 0%, rgba(255,160,154,0.18) 44%, transparent 74%)",
    borderColor: "rgba(241,179,171,0.34)",
    textColor: "#fff8f6",
  },
  away: {
    fill:
      "linear-gradient(270deg, rgba(68,84,189,1) 0%, rgba(95,107,244,0.98) 54%, rgba(171,183,255,0.82) 100%)",
    glow:
      "radial-gradient(circle at 80% 50%, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.08) 28%, transparent 64%)",
    bubble:
      "radial-gradient(circle, rgba(218,225,255,0.28) 0%, rgba(151,164,255,0.18) 44%, transparent 74%)",
    borderColor: "rgba(187,197,255,0.34)",
    textColor: "#f8faff",
  },
  neutral: {
    fill:
      "linear-gradient(180deg, rgba(34,48,45,1), rgba(21,31,29,1))",
    glow:
      "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.04) 28%, transparent 58%)",
    bubble:
      "radial-gradient(circle, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.06) 44%, transparent 72%)",
    borderColor: "rgba(215,231,227,0.18)",
    textColor: "#f4fbf8",
  },
};

/** Desktop overlay (slicer columns): ~20% transparency on the pill; text uses full-opacity styling below. */
const DESKTOP_LOCK_ANSWER_BUTTON_STYLES: Record<
  WinnerSelectionTone,
  {
    fill: string;
    glow: string;
    bubble: string;
    borderColor: string;
    textColor: string;
  }
> = {
  home: {
    fill:
      "linear-gradient(90deg, rgba(144,53,61,0.8) 0%, rgba(188,83,89,0.78) 54%, rgba(233,160,152,0.66) 100%)",
    glow:
      "radial-gradient(circle at 20% 50%, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.06) 28%, transparent 64%)",
    bubble:
      "radial-gradient(circle, rgba(255,214,210,0.22) 0%, rgba(255,160,154,0.14) 44%, transparent 74%)",
    borderColor: "rgba(241,179,171,0.27)",
    textColor: "#ffffff",
  },
  away: {
    fill:
      "linear-gradient(270deg, rgba(68,84,189,0.8) 0%, rgba(95,107,244,0.78) 54%, rgba(171,183,255,0.66) 100%)",
    glow:
      "radial-gradient(circle at 80% 50%, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.06) 28%, transparent 64%)",
    bubble:
      "radial-gradient(circle, rgba(218,225,255,0.22) 0%, rgba(151,164,255,0.14) 44%, transparent 74%)",
    borderColor: "rgba(187,197,255,0.27)",
    textColor: "#ffffff",
  },
  neutral: {
    fill: "linear-gradient(180deg, rgba(34,48,45,0.8), rgba(21,31,29,0.8))",
    glow:
      "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 28%, transparent 58%)",
    bubble:
      "radial-gradient(circle, rgba(255,255,255,0.11) 0%, rgba(255,255,255,0.05) 44%, transparent 72%)",
    borderColor: "rgba(215,231,227,0.14)",
    textColor: "#ffffff",
  },
};

function splitQuestionsIntoWings(questions: NumberedQuestion[]) {
  const leftQuestionCount = Math.ceil(questions.length / 2);

  return {
    leftQuestions: questions.slice(0, leftQuestionCount),
    rightQuestions: questions.slice(leftQuestionCount),
  };
}

function CenterLaneFieldMarks() {
  return (
    <svg
      viewBox="0 0 1000 620"
      preserveAspectRatio="xMidYMid meet"
      className="pointer-events-none absolute inset-0 z-[1] h-full w-full"
      fill="none"
      aria-hidden
    >
      <defs>
        <filter id="challenge-center-soft">
          <feGaussianBlur stdDeviation="1.15" />
        </filter>
      </defs>

      <g
        stroke="rgba(237,244,239,0.16)"
        strokeWidth="4.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#challenge-center-soft)"
      >
        <path d="M500 18V602" />
        <circle cx="500" cy="310" r="86" />
      </g>

      <g
        stroke="rgba(237,244,239,0.42)"
        strokeWidth="2.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M500 18V602" />
        <circle cx="500" cy="310" r="86" />
      </g>

      <circle cx="500" cy="310" r="4" fill="rgba(237,244,239,0.42)" />
    </svg>
  );
}

function FeedbackBanner({
  tone,
  message,
  onDismiss,
}: {
  tone: "error" | "success";
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`w-full rounded-[0.85rem] border px-3 py-2 text-[0.78rem] shadow-[0_12px_24px_rgba(0,0,0,0.16)] ${
        tone === "error"
          ? "border-red-300/25 bg-red-400/10 text-red-100"
          : "border-emerald-300/25 bg-emerald-400/10 text-emerald-100"
      }`}
    >
      {message}
      <button type="button" onClick={onDismiss} className="ml-2 underline">
        Dismiss
      </button>
    </div>
  );
}

function FinalizeAnswersPrompt({
  busy,
  onCancel,
  onConfirm,
}: {
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="pointer-events-auto absolute inset-0 z-[32] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-[rgba(3,8,8,0.6)] backdrop-blur-[8px]" />
      <div className="relative w-full max-w-[24rem] rounded-[1.2rem] border border-white/12 bg-[linear-gradient(180deg,rgba(9,16,15,0.96),rgba(7,12,12,0.9))] p-4 text-left shadow-[0_26px_60px_rgba(0,0,0,0.34)]">
        <div className="text-[0.58rem] font-semibold uppercase tracking-[0.2em] text-[#d4e4df]/56">
          Final confirmation
        </div>
        <h3 className="mt-2 text-[1rem] font-semibold leading-tight text-white">
          Save and lock your answers?
        </h3>
        <p className="mt-2 text-[0.74rem] leading-[1.55] text-white/68">
          After you lock your picks for this match, you will not be able to change them
          again. Once locked, the `WHO WINS` bars will reveal the live user percentages.
        </p>
        <div className="mt-4 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-[0.6rem] text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-white/74 transition-colors duration-300 hover:bg-white/[0.07] disabled:cursor-default disabled:opacity-60"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-full border border-white/14 bg-[linear-gradient(180deg,rgba(214,231,224,0.12),rgba(214,231,224,0.05))] px-3.5 py-[0.6rem] text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_12px_24px_rgba(0,0,0,0.2)] transition-[background-color,box-shadow] duration-300 hover:bg-white/[0.12] disabled:cursor-default disabled:opacity-70"
          >
            {busy ? "Locking..." : "Lock answers"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PlayerPickerModal({
  question,
  selectedOptionId,
  onSelectOption,
  onClose,
}: {
  question: HalisahaPublicQuestion;
  selectedOptionId: string;
  onSelectOption: (optionId: string) => void;
  onClose: () => void;
}) {
  const isMvpPickerQuestion = question.kind === "mvp_prediction";
  const optionGroups = getHalisahaPlayerPickerOptionGroups(question.kind, question.options);

  return (
    <div className="pointer-events-auto absolute inset-0 z-[30] flex items-center justify-center px-4 py-4">
      <button
        type="button"
        aria-label="Close player picker"
        onClick={onClose}
        className="absolute inset-0 bg-[rgba(3,8,8,0.68)] backdrop-blur-[9px]"
      />
      <div className="relative flex max-h-[calc(100%-0.75rem)] w-full max-w-[35rem] flex-col overflow-hidden rounded-[1.18rem] border border-white/12 bg-[linear-gradient(180deg,rgba(10,18,17,0.98),rgba(8,14,14,0.94))] shadow-[0_28px_66px_rgba(0,0,0,0.36)]">
        <div className="border-b border-white/8 px-4 pb-3 pt-4">
          <div className="text-[0.56rem] font-semibold uppercase tracking-[0.2em] text-white/42">
            {isMvpPickerQuestion ? "MVP picker" : "Player picker"}
          </div>
          <div className="mt-2 flex items-start justify-between gap-3">
            <div>
              <h4 className="text-[1rem] font-semibold text-white">
                {isMvpPickerQuestion ? "Choose your MVP candidate" : "Choose one player"}
              </h4>
              <p className="mt-1 text-[0.72rem] leading-[1.5] text-white/62">
                {isMvpPickerQuestion
                  ? "All available players are grouped by team so you can pick quickly without the list being cut off by the question layout."
                  : "Current squad players are grouped by team so you can pick the right name quickly."}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-[0.55rem] text-[0.56rem] font-semibold uppercase tracking-[0.16em] text-white/74 transition-colors hover:bg-white/[0.08]"
            >
              Close
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto px-4 py-4 md:grid-cols-2">
          {optionGroups.map((group) => (
            <div
              key={group.label}
              className="flex min-h-0 flex-col rounded-[0.96rem] border border-white/10 bg-white/[0.04] p-3"
            >
              <div className="text-[0.54rem] font-semibold uppercase tracking-[0.18em] text-white/42">
                {group.label}
              </div>
              <div className="mt-3 min-h-0 space-y-2 overflow-y-auto pr-1">
                {group.options.length > 0 ? (
                  group.options.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        onSelectOption(option.id);
                        onClose();
                      }}
                      className={`flex w-full items-center justify-between gap-2 rounded-[0.78rem] border px-3 py-2 text-left text-[0.74rem] font-medium transition-colors ${
                        selectedOptionId === option.id
                          ? "border-white/22 bg-white/[0.12] text-white"
                          : "border-white/10 bg-black/10 text-white/82 hover:bg-white/[0.06]"
                      }`}
                    >
                      <span className="truncate">{option.label}</span>
                      <span className="text-[0.5rem] uppercase tracking-[0.16em] text-white/38">
                        Pick
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="rounded-[0.78rem] border border-dashed border-white/10 bg-black/10 px-3 py-3 text-[0.72rem] text-white/42">
                    {isMvpPickerQuestion
                      ? "No players are assigned to this group yet."
                      : "No squad players are available in this group yet."}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function OthersAnswersModal({
  question,
  onClose,
}: {
  question: HalisahaPublicQuestion;
  onClose: () => void;
}) {
  return (
    <div className="pointer-events-auto absolute inset-0 z-[30] flex items-center justify-center px-4 py-4">
      <button
        type="button"
        aria-label="Close others answers"
        onClick={onClose}
        className="absolute inset-0 bg-[rgba(3,8,8,0.68)] backdrop-blur-[9px]"
      />
      <div className="relative flex max-h-[calc(100%-0.75rem)] w-full max-w-[35rem] flex-col overflow-hidden rounded-[1.18rem] border border-white/12 bg-[linear-gradient(180deg,rgba(10,18,17,0.98),rgba(8,14,14,0.94))] shadow-[0_28px_66px_rgba(0,0,0,0.36)]">
        <div className="border-b border-white/8 px-4 pb-3 pt-4">
          <div className="text-[0.56rem] font-semibold uppercase tracking-[0.2em] text-white/42">
            Others
          </div>
          <div className="mt-2 flex items-start justify-between gap-3">
            <div>
              <h4 className="text-[1rem] font-semibold text-white">
                See how other players answered
              </h4>
              <p className="mt-1 text-[0.72rem] leading-[1.5] text-white/62">
                {question.prompt}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-[0.55rem] text-[0.56rem] font-semibold uppercase tracking-[0.16em] text-white/74 transition-colors hover:bg-white/[0.08]"
            >
              Close
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {question.otherAnswers.length > 0 ? (
            <div className="space-y-2.5">
              {question.otherAnswers.map((answer) => (
                <div
                  key={`${question.id}-${answer.userId}`}
                  className="rounded-[0.96rem] border border-white/10 bg-white/[0.04] px-3 py-3"
                >
                  <div className="text-[0.78rem] font-semibold text-white">
                    {answer.displayName}
                  </div>
                  <div className="mt-1 text-[0.72rem] leading-[1.45] text-white/68">
                    Answer: <span className="text-white/88">{answer.answerLabel}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[0.96rem] border border-dashed border-white/10 bg-black/10 px-3 py-4 text-[0.74rem] text-white/44">
              No other answers were submitted for this question.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Visual-only: extend fill toward center logos (~10%) without changing shown % labels. */
const WHO_WINS_BAR_FILL_EXTEND = 1.1;

function getCompactWinnerLabel(label: string) {
  const [firstWord] = label.trim().split(/\s+/);
  return firstWord || label;
}

function WinnerVoteButton({
  label,
  displayLabel = label,
  fillPercentage,
  percentageLabel,
  selected,
  align,
  animated,
  disabled,
  compact = false,
  reservePercentageSpace = true,
  onClick,
}: {
  label: string;
  displayLabel?: string;
  fillPercentage: number;
  percentageLabel: number | null;
  selected: boolean;
  align: "left" | "right";
  animated: boolean;
  disabled: boolean;
  compact?: boolean;
  reservePercentageSpace?: boolean;
  onClick: () => void;
}) {
  const visualFillWidth = Math.min(100, fillPercentage * WHO_WINS_BAR_FILL_EXTEND);

  const percentageNode = (
    <span
      className={`shrink-0 self-center font-black leading-none text-white tabular-nums ${
        compact ? "text-[0.96rem]" : "text-[1.04rem]"
      }`}
    >
      {percentageLabel === null ? (
        reservePercentageSpace ? (
          <span
            aria-hidden="true"
            className={`inline-block text-right opacity-0 ${
              compact ? "min-w-[1.8rem]" : "min-w-[2.6rem]"
            }`}
          >
            100%
          </span>
        ) : null
      ) : (
        `${percentageLabel}%`
      )}
    </span>
  );

  const nameNode = (
    <span
      className={`block min-w-0 flex-1 truncate self-center font-semibold uppercase text-white/92 ${
        compact ? "text-[0.76rem] tracking-[0.05em]" : "text-[0.72rem] tracking-[0.08em]"
      } ${align === "right" ? "text-right" : ""}`}
      title={label}
    >
      {displayLabel}
    </span>
  );

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={percentageLabel === null ? label : `${label} ${percentageLabel}%`}
      className={`halisaha-winner-bar relative overflow-hidden border bg-[linear-gradient(180deg,rgba(9,16,15,0.9),rgba(13,24,22,0.64))] text-left shadow-[0_14px_28px_rgba(0,0,0,0.18)] transition-[border-color,box-shadow,transform] duration-300 ${
        compact ? "min-h-[2.72rem] rounded-[0.98rem]" : "min-h-[3.02rem] rounded-[1.04rem]"
      } ${
        selected
          ? "border-white/24 ring-1 ring-white/12"
          : "border-white/10 hover:border-white/16"
      } ${disabled ? "cursor-default" : "cursor-pointer"}`}
    >
      <span
        className={`absolute inset-y-0 ${
          align === "left" ? "left-0" : "right-0"
        } transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          align === "left"
            ? "bg-[linear-gradient(90deg,rgba(157,62,70,0.95),rgba(210,95,100,0.84),rgba(231,155,148,0.42))]"
            : "bg-[linear-gradient(270deg,rgba(76,92,204,0.95),rgba(103,113,255,0.84),rgba(170,182,255,0.42))]"
        }`}
        style={{ width: `${animated ? visualFillWidth : 0}%` }}
      />
      <span
        className={`pointer-events-none absolute ${
          compact ? "inset-y-[16%]" : "inset-y-[18%]"
        } ${
          align === "left" ? "left-[6%]" : "right-[6%]"
        } ${compact ? "w-[40%]" : "w-[38%]"} rounded-full blur-2xl transition-opacity duration-700`}
        style={{
          opacity: animated && visualFillWidth > 0 ? 1 : 0,
          background:
            align === "left"
              ? "radial-gradient(circle, rgba(255,225,220,0.34) 0%, rgba(255,165,158,0.16) 44%, transparent 76%)"
              : "radial-gradient(circle, rgba(221,226,255,0.34) 0%, rgba(147,160,255,0.16) 44%, transparent 76%)",
        }}
      />
      <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),transparent_58%)]" />
      <span
        className={`halisaha-winner-bar-inner relative flex items-center justify-between ${
          compact ? "min-h-[2.72rem] gap-2 px-3 py-[0.58rem]" : "min-h-[3.02rem] gap-3 px-4 py-[0.72rem]"
        }`}
      >
        {align === "right" ? (
          <>
            {percentageNode}
            {nameNode}
          </>
        ) : (
          <>
            {nameNode}
            {percentageNode}
          </>
        )}
      </span>
    </button>
  );
}

export function HalisahaChallengeOverlay({
  matchId,
  questions,
  standardQuestions,
  winnerQuestion,
  winnerVoteSummary,
  userAnswers,
  answersResolved,
  answersLocked,
  viewerCanManageOwnAnswerLock,
  predictionWindowClosed = false,
  winnerPercentagesVisible = false,
  onFinalizePromptVisibilityChange,
  onPlayerPickerVisibilityChange,
  onDraftStateChange,
  compactMobileLayout = false,
}: {
  matchId: string | null;
  questions: HalisahaPublicQuestion[];
  standardQuestions: HalisahaPublicQuestion[];
  winnerQuestion: HalisahaPublicQuestion | null;
  winnerVoteSummary: HalisahaWinnerVoteSummary | null;
  userAnswers: Record<string, HalisahaPublicAnswerState>;
  answersResolved: boolean;
  answersLocked: boolean;
  viewerCanManageOwnAnswerLock: boolean;
  predictionWindowClosed?: boolean;
  winnerPercentagesVisible?: boolean;
  onFinalizePromptVisibilityChange?: (visible: boolean) => void;
  onPlayerPickerVisibilityChange?: (visible: boolean) => void;
  onDraftStateChange?: (dirty: boolean) => void;
  compactMobileLayout?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [animateBars, setAnimateBars] = useState(false);
  const [showFinalizePrompt, setShowFinalizePrompt] = useState(false);
  const [activePlayerPickerQuestionId, setActivePlayerPickerQuestionId] = useState<string | null>(
    null,
  );
  const [activeOthersQuestionId, setActiveOthersQuestionId] = useState<string | null>(null);

  const initialSelections = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(userAnswers).map(([questionId, answer]) => [
          questionId,
          {
            selectedOptionId: answer.selectedOptionId,
            customScoreHome: answer.customScoreHome,
            customScoreAway: answer.customScoreAway,
          } satisfies DraftAnswerState,
        ]),
      ) as Record<string, DraftAnswerState>,
    [userAnswers],
  );
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, DraftAnswerState>>(
    initialSelections,
  );
  const selectedWinnerOptionId = winnerQuestion
    ? selectedAnswers[winnerQuestion.id]?.selectedOptionId ?? ""
    : "";

  useEffect(() => {
    setSelectedAnswers(initialSelections);
  }, [initialSelections]);

  useEffect(() => {
    onFinalizePromptVisibilityChange?.(showFinalizePrompt);
  }, [onFinalizePromptVisibilityChange, showFinalizePrompt]);

  useEffect(
    () => () => {
      onFinalizePromptVisibilityChange?.(false);
    },
    [onFinalizePromptVisibilityChange],
  );

  useEffect(() => {
    onPlayerPickerVisibilityChange?.(activePlayerPickerQuestionId !== null);
  }, [activePlayerPickerQuestionId, onPlayerPickerVisibilityChange]);

  useEffect(
    () => () => {
      onPlayerPickerVisibilityChange?.(false);
    },
    [onPlayerPickerVisibilityChange],
  );

  const hasUnsavedDraftChanges = useMemo(
    () =>
      questions.some(
        (question) => !areDraftAnswersEqual(initialSelections[question.id], selectedAnswers[question.id]),
      ),
    [initialSelections, questions, selectedAnswers],
  );

  useEffect(() => {
    onDraftStateChange?.(hasUnsavedDraftChanges);
  }, [hasUnsavedDraftChanges, onDraftStateChange]);

  useEffect(
    () => () => {
      onDraftStateChange?.(false);
    },
    [onDraftStateChange],
  );

  useEffect(() => {
    if (!activePlayerPickerQuestionId) {
      return;
    }

    if (answersLocked || answersResolved) {
      setActivePlayerPickerQuestionId(null);
    }
  }, [activePlayerPickerQuestionId, answersLocked, answersResolved]);

  useEffect(() => {
    if (!activeOthersQuestionId) {
      return;
    }

    if (!answersResolved) {
      setActiveOthersQuestionId(null);
    }
  }, [activeOthersQuestionId, answersResolved]);

  useEffect(() => {
    setAnimateBars(false);
    const timeoutId = window.setTimeout(() => setAnimateBars(true), 80);
    return () => window.clearTimeout(timeoutId);
  }, [
    selectedWinnerOptionId,
    winnerVoteSummary?.homeOption.percentage,
    winnerVoteSummary?.awayOption.percentage,
  ]);

  const totalPoints = questions.reduce((sum, question) => sum + question.points, 0);
  const answeredCount = questions.reduce(
    (sum, question) => sum + (selectedAnswers[question.id]?.selectedOptionId ? 1 : 0),
    0,
  );
  const optimisticPoints = questions.reduce(
    (sum, question) =>
      sum + (selectedAnswers[question.id]?.selectedOptionId ? question.points : 0),
    0,
  );
  const awardedPoints = Object.values(userAnswers).reduce(
    (sum, answer) => sum + answer.awardedPoints,
    0,
  );
  const stagedSelections = questions
    .filter((question) => selectedAnswers[question.id]?.selectedOptionId)
    .map((question) => ({
      questionId: question.id,
      optionId: selectedAnswers[question.id].selectedOptionId,
      customScoreHome: selectedAnswers[question.id].customScoreHome,
      customScoreAway: selectedAnswers[question.id].customScoreAway,
    }));
  const hasSelections = stagedSelections.length > 0;
  const canRevealWinnerPercentages = winnerPercentagesVisible;
  const viewerCanUnlockAnswers =
    viewerCanManageOwnAnswerLock &&
    answersLocked &&
    !answersResolved &&
    !predictionWindowClosed;
  const predictionsClosed =
    predictionWindowClosed && !answersLocked && !answersResolved && !viewerCanUnlockAnswers;
  const effectiveWinnerVoteSummary = useMemo(() => {
    if (winnerVoteSummary) {
      return winnerVoteSummary;
    }

    if (!winnerQuestion || winnerQuestion.options.length < 2) {
      return null;
    }

    const [homeOption, awayOption] = winnerQuestion.options;
    return {
      questionId: winnerQuestion.id,
      totalVotes: 0,
      homeOption: {
        id: homeOption.id,
        label: homeOption.label,
        voteCount: 0,
        percentage: 0,
      },
      awayOption: {
        id: awayOption.id,
        label: awayOption.label,
        voteCount: 0,
        percentage: 0,
      },
    } satisfies HalisahaWinnerVoteSummary;
  }, [winnerQuestion, winnerVoteSummary]);
  const numberedStandardQuestions = useMemo(
    () =>
      standardQuestions.map((question, index) => ({
        question,
        questionNumber: index + (winnerQuestion ? 2 : 1),
      })),
    [standardQuestions, winnerQuestion],
  );
  const { leftQuestions, rightQuestions } = useMemo(
    () => splitQuestionsIntoWings(numberedStandardQuestions),
    [numberedStandardQuestions],
  );
  const stackedQuestions = numberedStandardQuestions;
  const questionSlotCount = Math.max(leftQuestions.length, rightQuestions.length, 1);
  const activePlayerPickerQuestion = useMemo(
    () =>
      standardQuestions.find(
        (question) =>
          question.id === activePlayerPickerQuestionId &&
          questionHasPlayerPickerRow(question),
      ) ?? null,
    [activePlayerPickerQuestionId, standardQuestions],
  );
  const activeOthersQuestion = useMemo(
    () => questions.find((question) => question.id === activeOthersQuestionId) ?? null,
    [activeOthersQuestionId, questions],
  );
  const winnerSelectionTone = useMemo<WinnerSelectionTone>(() => {
    if (!winnerQuestion || !effectiveWinnerVoteSummary) {
      return "neutral";
    }

    const selectedWinnerOptionId = selectedAnswers[winnerQuestion.id]?.selectedOptionId;
    if (selectedWinnerOptionId === effectiveWinnerVoteSummary.homeOption.id) {
      return "home";
    }
    if (selectedWinnerOptionId === effectiveWinnerVoteSummary.awayOption.id) {
      return "away";
    }

    return "neutral";
  }, [effectiveWinnerVoteSummary, selectedAnswers, winnerQuestion]);
  const saveButtonStyle = compactMobileLayout
    ? OPAQUE_WINNER_SAVE_BUTTON_STYLES[winnerSelectionTone]
    : DESKTOP_LOCK_ANSWER_BUTTON_STYLES[winnerSelectionTone];
  const winnerDisplayState = useMemo(() => {
    if (!winnerQuestion || !effectiveWinnerVoteSummary) {
      return null;
    }

    const isHomeSelected = selectedWinnerOptionId === effectiveWinnerVoteSummary.homeOption.id;
    const isAwaySelected = selectedWinnerOptionId === effectiveWinnerVoteSummary.awayOption.id;

    return {
      homeFillPercentage: canRevealWinnerPercentages
        ? effectiveWinnerVoteSummary.homeOption.percentage
        : isHomeSelected
          ? 100
          : 0,
      awayFillPercentage: canRevealWinnerPercentages
        ? effectiveWinnerVoteSummary.awayOption.percentage
        : isAwaySelected
          ? 100
          : 0,
      homePercentageLabel: canRevealWinnerPercentages
        ? effectiveWinnerVoteSummary.homeOption.percentage
        : null,
      awayPercentageLabel: canRevealWinnerPercentages
        ? effectiveWinnerVoteSummary.awayOption.percentage
        : null,
    };
  }, [
    canRevealWinnerPercentages,
    effectiveWinnerVoteSummary,
    selectedWinnerOptionId,
    winnerQuestion,
  ]);
  const primaryButtonLabel = viewerCanUnlockAnswers
    ? busy
      ? "Unlocking..."
      : "Unlock answers"
    : predictionsClosed
      ? "Predictions closed"
    : busy
      ? "Locking..."
      : "Lock answers";
  const centerPillLabel = answersResolved
    ? "Answers resolved"
    : answersLocked
      ? "Answers locked"
      : primaryButtonLabel;

  const openFinalizePrompt = () => {
    if (!hasSelections) {
      setError("Select at least one answer first.");
      return;
    }

    setError(null);
    setShowFinalizePrompt(true);
  };

  const handleUnlockAnswers = async () => {
    if (!matchId) {
      setError("Match not found.");
      return;
    }

    setBusy(true);
    setError(null);
    const result = await unlockHalisahaAnswersAction(matchId);
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    router.refresh();
  };

  const handleFinalizeAnswers = async () => {
    setShowFinalizePrompt(false);
    setBusy(true);
    setError(null);
    const result = await finalizeHalisahaAnswersAction(stagedSelections);
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    router.refresh();
  };

  if (questions.length === 0) {
    return null;
  }

  const renderQuestionCard = ({
    question,
    questionNumber,
  }: {
    question: HalisahaPublicQuestion;
    questionNumber: number;
  }) => (
    <div
      key={question.id}
      className={compactMobileLayout ? "halisaha-mobile-question-slot shrink-0" : "min-h-0"}
    >
      <HalisahaQuestionCard
        question={question}
        questionNumber={questionNumber}
        initialAnswer={userAnswers[question.id]}
        selectedAnswer={
          selectedAnswers[question.id] ?? getEmptyDraftAnswer()
        }
        onSelectAnswer={(answer) =>
          setSelectedAnswers((current) => ({
            ...current,
            [question.id]: answer,
          }))
        }
        onRequestPlayerPicker={
          questionHasPlayerPickerRow(question)
            ? () => {
                setActiveOthersQuestionId(null);
                setActivePlayerPickerQuestionId(question.id);
              }
            : undefined
        }
        onRequestOthers={
          answersResolved
            ? () => {
                setActivePlayerPickerQuestionId(null);
                setActiveOthersQuestionId(question.id);
              }
            : undefined
        }
        answersResolved={answersResolved}
        answersLocked={answersLocked}
        predictionWindowClosed={predictionsClosed}
        showSaveButton={false}
        layoutMode="overlay"
        compactOverlayLayout={compactMobileLayout}
      />
    </div>
  );

  return (
    <div
      data-mobile-overlay-layout={compactMobileLayout ? "stacked" : undefined}
      className="halisaha-challenge-overlay pointer-events-none absolute inset-0 z-[14]"
    >
      {compactMobileLayout ? null : <CenterLaneFieldMarks />}
      <div
        className={`absolute inset-0 h-full min-h-0 overflow-hidden ${
          compactMobileLayout
            ? "grid grid-rows-[auto_minmax(0,1fr)_auto] gap-[clamp(0.12rem,0.42vh,0.28rem)] px-[0.45%] pb-[0.04%] pt-[0.04%]"
            : "flex flex-col gap-[clamp(0.18rem,0.58vh,0.38rem)] px-[2%] pb-[0.12%] pt-[0.2%]"
        }`}
      >
        {winnerQuestion && effectiveWinnerVoteSummary && winnerDisplayState ? (
          <div
            className={`halisaha-challenge-winner pointer-events-auto z-[3] shrink-0 rounded-[1.04rem] border border-white/10 bg-[linear-gradient(180deg,rgba(8,15,14,0.84),rgba(8,15,14,0.62))] shadow-[0_14px_30px_rgba(0,0,0,0.18)] backdrop-blur-md ${
              compactMobileLayout
                ? "mb-[clamp(0.1rem,0.28vh,0.18rem)] px-2 pb-[0.4rem] pt-[0.36rem]"
                : "mb-[clamp(0.24rem,0.72vh,0.42rem)] px-3.5 pb-[0.74rem] pt-[0.72rem]"
            }`}
          >
            <div className="halisaha-challenge-winner-header mb-[0.58rem] grid items-center gap-2.5 [grid-template-columns:minmax(0,1fr)_auto_minmax(0,1fr)] px-0.5">
              <span className="justify-self-start text-[0.52rem] font-semibold uppercase tracking-[0.16em] text-white/44">
                Question 1
              </span>
              <span className="halisaha-winner-prompt min-w-0 justify-self-center whitespace-nowrap text-center text-[clamp(0.94rem,1.42vw,1.04rem)] font-semibold uppercase leading-none tracking-[0.16em] text-[#d4e4df]/78">
                {winnerQuestion.prompt}
              </span>
              <span className="justify-self-end">
                <span className="inline-flex items-center gap-1.5">
                  {answersResolved ? (
                    <button
                      type="button"
                      onClick={() => {
                        setActivePlayerPickerQuestionId(null);
                        setActiveOthersQuestionId(winnerQuestion.id);
                      }}
                      className="rounded-full border border-white/10 bg-white/[0.045] px-2 py-[0.18rem] text-[0.48rem] font-semibold uppercase tracking-[0.14em] text-[#d4e4df] transition-colors hover:bg-white/[0.09]"
                    >
                      Others
                    </button>
                  ) : null}
                  <span className="rounded-full border border-white/10 bg-white/[0.045] px-2 py-[0.18rem] text-[0.48rem] font-semibold uppercase tracking-[0.14em] text-[#d4e4df]">
                    {winnerQuestion.points} pt
                  </span>
                </span>
              </span>
            </div>

            <div className="halisaha-challenge-winner-grid grid items-center gap-[clamp(0.75rem,1.4vw,1.05rem)] [grid-template-columns:minmax(0,1fr)_clamp(9.7rem,12.6vw,10.35rem)_minmax(0,1fr)]">
              <WinnerVoteButton
                label={effectiveWinnerVoteSummary.homeOption.label}
                displayLabel={
                  compactMobileLayout
                    ? getCompactWinnerLabel(effectiveWinnerVoteSummary.homeOption.label)
                    : effectiveWinnerVoteSummary.homeOption.label
                }
                fillPercentage={winnerDisplayState.homeFillPercentage}
                percentageLabel={winnerDisplayState.homePercentageLabel}
                selected={
                  selectedAnswers[winnerQuestion.id]?.selectedOptionId ===
                  effectiveWinnerVoteSummary.homeOption.id
                }
                align="left"
                animated={animateBars}
                compact={compactMobileLayout}
                reservePercentageSpace={!compactMobileLayout}
                disabled={answersResolved || answersLocked || predictionsClosed || busy}
                onClick={() =>
                  setSelectedAnswers((current) => ({
                    ...current,
                    [winnerQuestion.id]: {
                      selectedOptionId: effectiveWinnerVoteSummary.homeOption.id,
                      customScoreHome: null,
                      customScoreAway: null,
                    },
                  }))
                }
              />

              <div className="halisaha-winner-center relative mx-auto flex h-[3.46rem] w-full max-w-[10.35rem] items-center justify-center overflow-hidden">
                <div className="pointer-events-none absolute inset-[8%] rounded-full bg-[radial-gradient(circle,rgba(143,188,187,0.18),transparent_70%)] blur-xl" />
                <Image
                  src={crestAsset}
                  alt="Match logos"
                  className="relative h-full w-full scale-[1.1] object-contain drop-shadow-[0_12px_22px_rgba(0,0,0,0.18)]"
                  sizes="(min-width: 640px) 10.8rem, 8.8rem"
                  priority
                />
                <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-1 text-[0.58rem] font-semibold italic uppercase tracking-[0.23em] text-white/88 [text-shadow:0_2px_12px_rgba(0,0,0,0.42)]">
                  VS
                </div>
              </div>

              <WinnerVoteButton
                label={effectiveWinnerVoteSummary.awayOption.label}
                displayLabel={
                  compactMobileLayout
                    ? getCompactWinnerLabel(effectiveWinnerVoteSummary.awayOption.label)
                    : effectiveWinnerVoteSummary.awayOption.label
                }
                fillPercentage={winnerDisplayState.awayFillPercentage}
                percentageLabel={winnerDisplayState.awayPercentageLabel}
                selected={
                  selectedAnswers[winnerQuestion.id]?.selectedOptionId ===
                  effectiveWinnerVoteSummary.awayOption.id
                }
                align="right"
                animated={animateBars}
                compact={compactMobileLayout}
                reservePercentageSpace={!compactMobileLayout}
                disabled={answersResolved || answersLocked || predictionsClosed || busy}
                onClick={() =>
                  setSelectedAnswers((current) => ({
                    ...current,
                    [winnerQuestion.id]: {
                      selectedOptionId: effectiveWinnerVoteSummary.awayOption.id,
                      customScoreHome: null,
                      customScoreAway: null,
                    },
                  }))
                }
              />
            </div>
          </div>
        ) : null}

        {compactMobileLayout ? (
          <div className="halisaha-challenge-grid halisaha-challenge-grid-mobile z-[2] min-h-0 pointer-events-none">
            <div className="halisaha-mobile-question-scroll-frame pointer-events-auto relative mx-auto flex h-full min-h-0 w-full max-w-[32rem] overflow-hidden">
              <div className="pointer-events-none absolute inset-x-0 top-0 z-[2] h-[clamp(0.42rem,1.08vh,0.72rem)] bg-[linear-gradient(180deg,rgba(7,13,12,0.82),rgba(7,13,12,0))]" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-[clamp(0.48rem,1.2vh,0.82rem)] bg-[linear-gradient(180deg,rgba(7,13,12,0),rgba(7,13,12,0.86))]" />
              <div className="halisaha-mobile-question-stack relative z-[1] flex h-full min-h-0 w-full flex-col overflow-y-auto pr-[0.1rem]">
                <div className="halisaha-mobile-question-stack-inner flex flex-col gap-[clamp(0.24rem,0.72vh,0.38rem)] pb-[0.2rem]">
                  {stackedQuestions.map(renderQuestionCard)}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="halisaha-challenge-grid z-[2] flex-1 min-h-0 grid grid-cols-[minmax(0,1fr)_clamp(3.7rem,8vw,5.35rem)_minmax(0,1fr)] gap-[1.02%] pointer-events-none">
            <div className="halisaha-challenge-column pointer-events-auto min-h-0 overflow-hidden pr-0.35 pb-0.25">
              <div
                className="halisaha-challenge-column-stack grid h-full min-h-0 gap-[clamp(0.28rem,0.86vh,0.42rem)]"
                style={{ gridTemplateRows: `repeat(${questionSlotCount}, minmax(0, 1fr))` }}
              >
                {leftQuestions.map(renderQuestionCard)}
              </div>
            </div>
            <div className="pointer-events-none" />

            <div className="halisaha-challenge-column pointer-events-auto min-h-0 overflow-hidden pl-0.35 pb-0.25">
              <div
                className="halisaha-challenge-column-stack grid h-full min-h-0 gap-[clamp(0.28rem,0.86vh,0.42rem)]"
                style={{ gridTemplateRows: `repeat(${questionSlotCount}, minmax(0, 1fr))` }}
              >
                {rightQuestions.map(renderQuestionCard)}
              </div>
            </div>
          </div>
        )}

        <div
          className={`halisaha-challenge-footer pointer-events-auto z-[3] flex shrink-0 flex-col items-center gap-[0.12rem] pt-0 ${
            compactMobileLayout ? "mt-0" : "mt-auto"
          }`}
        >
          <div className="w-full max-w-[43rem] space-y-[0.68rem]">
            {error ? (
              <FeedbackBanner tone="error" message={error} onDismiss={() => setError(null)} />
            ) : null}
          </div>

          <div className="relative mt-[0.32rem] w-full max-w-[43rem] pt-[0.38rem]">
            <div className="pointer-events-none absolute inset-x-0 -mx-[clamp(0.72rem,2.15vw,1.15rem)] top-0 -translate-y-[38%] grid items-center gap-[clamp(0.38rem,0.82vw,0.58rem)] px-0 [grid-template-columns:minmax(0,1fr)_auto_minmax(0,1fr)]">
              <span className="h-[3px] rounded-full bg-[linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,0.16)_38%,rgba(255,255,255,0.3))]" />
              <span className="invisible block min-w-[7.4rem] whitespace-nowrap rounded-full border px-4 py-[0.46rem] text-[0.52rem] font-semibold uppercase tracking-[0.18em]">
                {centerPillLabel}
              </span>
              <span className="h-[3px] rounded-full bg-[linear-gradient(90deg,rgba(255,255,255,0.3),rgba(255,255,255,0.16)_62%,rgba(255,255,255,0))]" />
            </div>
            {!answersResolved && !answersLocked && predictionsClosed ? (
              <div className="absolute left-1/2 top-0 z-[4] -translate-x-1/2 -translate-y-[38%] rounded-full border border-[rgba(215,231,227,0.12)] bg-[linear-gradient(180deg,rgba(8,15,14,0.82),rgba(10,17,16,0.58))] px-4 py-[0.46rem] text-[0.52rem] font-semibold uppercase tracking-[0.18em] text-[#f4fbf8] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_10px_22px_rgba(0,0,0,0.18)] backdrop-blur-md">
                Predictions closed
              </div>
            ) : !answersResolved && (!answersLocked || viewerCanUnlockAnswers) ? (
              <button
                type="button"
                onClick={viewerCanUnlockAnswers ? handleUnlockAnswers : openFinalizePrompt}
                disabled={busy || (!hasSelections && !viewerCanUnlockAnswers)}
                className="halisaha-challenge-save absolute left-1/2 top-0 z-[4] min-h-0 min-w-[7.1rem] -translate-x-1/2 -translate-y-[38%] overflow-hidden rounded-full border px-3.5 py-[0.46rem] text-[0.49rem] font-semibold uppercase tracking-[0.18em] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_14px_28px_rgba(0,0,0,0.24)] backdrop-blur-none transition-[border-color,box-shadow,transform] duration-500 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_12px_26px_rgba(0,0,0,0.22)] disabled:cursor-default"
                style={{
                  borderColor: saveButtonStyle.borderColor,
                  color: saveButtonStyle.textColor,
                  backgroundImage: compactMobileLayout
                    ? "linear-gradient(180deg,rgba(11,19,18,1),rgba(10,17,16,1))"
                    : "linear-gradient(180deg,rgba(11,19,18,0.8),rgba(10,17,16,0.8))",
                }}
              >
                <span
                  className={`pointer-events-none absolute inset-y-0 ${
                    winnerSelectionTone === "away" ? "right-0 origin-right" : "left-0 origin-left"
                  } w-full transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    winnerSelectionTone === "neutral" ? "scale-x-0 opacity-0" : "scale-x-100 opacity-100"
                  }`}
                  style={{ backgroundImage: saveButtonStyle.fill }}
                />
                <span
                  className={`pointer-events-none absolute inset-y-[-45%] w-[46%] rounded-full blur-2xl transition-all duration-500 ${
                    winnerSelectionTone === "home"
                      ? "left-[4%] opacity-100"
                      : winnerSelectionTone === "away"
                        ? "left-[50%] opacity-100"
                        : "left-[27%] opacity-0"
                  }`}
                  style={{ backgroundImage: saveButtonStyle.bubble }}
                />
                <span
                  className="pointer-events-none absolute inset-0 opacity-100 transition-opacity duration-500"
                  style={{ backgroundImage: saveButtonStyle.glow }}
                />
                <span
                  className={
                    compactMobileLayout
                      ? "pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_55%)]"
                      : "pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_50%)]"
                  }
                />
                <span
                  className={`relative z-[1] ${
                    compactMobileLayout
                      ? ""
                      : "font-bold [text-shadow:0_1px_0_rgba(0,0,0,0.55),0_0_12px_rgba(0,0,0,0.35)]"
                  }`}
                >
                  {primaryButtonLabel}
                </span>
              </button>
            ) : answersResolved ? (
              <div className="absolute left-1/2 top-0 z-[4] -translate-x-1/2 -translate-y-[38%] rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-[0.46rem] text-[0.52rem] font-semibold uppercase tracking-[0.18em] text-emerald-200 shadow-[0_8px_20px_rgba(0,0,0,0.16)]">
                Answers resolved
              </div>
            ) : (
              <div className="absolute left-1/2 top-0 z-[4] -translate-x-1/2 -translate-y-[38%] rounded-full border border-[#d4e4df]/18 bg-[linear-gradient(180deg,rgba(212,228,223,0.1),rgba(212,228,223,0.05))] px-4 py-[0.46rem] text-[0.52rem] font-semibold uppercase tracking-[0.18em] text-[#ecf6f2] shadow-[0_8px_20px_rgba(0,0,0,0.16)]">
                Answers locked
              </div>
            )}

            <div className="halisaha-challenge-stats mt-0 flex w-full items-center justify-between gap-2 rounded-[0.82rem] border border-white/10 bg-[linear-gradient(180deg,rgba(9,16,15,0.72),rgba(9,16,15,0.54))] px-4 pb-[0.66rem] pt-[0.88rem] shadow-[0_10px_20px_rgba(0,0,0,0.16)] backdrop-blur-md sm:justify-center sm:gap-5 lg:gap-7">
              <div className="halisaha-challenge-stat flex flex-col items-center">
                <span className="halisaha-challenge-stat-label text-[0.48rem] font-semibold uppercase tracking-[0.16em] text-white/40">Questions</span>
                <span className="halisaha-challenge-stat-value mt-[0.08rem] text-[0.88rem] font-bold leading-none text-white">{questions.length}</span>
              </div>
              <div className="halisaha-challenge-stats-divider h-4 w-px bg-white/10" />
              <div className="halisaha-challenge-stat flex flex-col items-center">
                <span className="halisaha-challenge-stat-label text-[0.48rem] font-semibold uppercase tracking-[0.16em] text-white/40">Total Points</span>
                <span className="halisaha-challenge-stat-value mt-[0.08rem] text-[0.88rem] font-bold leading-none text-white">{totalPoints}</span>
              </div>
              <div className="halisaha-challenge-stats-divider h-4 w-px bg-white/10" />
              <div className="halisaha-challenge-stat flex flex-col items-center">
                <span className="halisaha-challenge-stat-label text-[0.48rem] font-semibold uppercase tracking-[0.16em] text-[#d4e4df]/60">Your Answers</span>
                <span className="halisaha-challenge-stat-value mt-[0.08rem] text-[0.88rem] font-bold leading-none text-white">{answeredCount}</span>
              </div>
              <div className="halisaha-challenge-stats-divider h-4 w-px bg-white/10" />
              <div className="halisaha-challenge-stat flex flex-col items-center">
                <span className="halisaha-challenge-stat-label text-[0.48rem] font-semibold uppercase tracking-[0.16em] text-[#d4e4df]/60">Your Points</span>
                <span className="halisaha-challenge-stat-value mt-[0.08rem] text-[0.88rem] font-bold leading-none text-white">
                  {answersResolved ? awardedPoints : optimisticPoints}
                </span>
              </div>
            </div>
          </div>

          <div className="halisaha-challenge-footnote text-center text-[0.44rem] leading-none text-white/42">
            {answersResolved
              ? "Answers have been resolved. Saved picks now show their final result."
              : predictionsClosed
                ? "Predictions closed 5 minutes before kickoff. Saved picks can no longer be updated or locked."
              : answersLocked
                ? "Your picks are locked. WHO WINS now reflects the finalized user percentages."
                : "Questions stay editable until 5 minutes before kickoff, until you lock your answers, or until the admin resolves the match."}
          </div>
        </div>

        {activePlayerPickerQuestion ? (
          <PlayerPickerModal
            question={activePlayerPickerQuestion}
            selectedOptionId={selectedAnswers[activePlayerPickerQuestion.id]?.selectedOptionId ?? ""}
            onSelectOption={(optionId) =>
              setSelectedAnswers((current) => ({
                ...current,
                [activePlayerPickerQuestion.id]: {
                  selectedOptionId: optionId,
                  customScoreHome: null,
                  customScoreAway: null,
                },
              }))
            }
            onClose={() => setActivePlayerPickerQuestionId(null)}
          />
        ) : null}

        {activeOthersQuestion ? (
          <OthersAnswersModal
            question={activeOthersQuestion}
            onClose={() => setActiveOthersQuestionId(null)}
          />
        ) : null}

        {showFinalizePrompt ? (
          <FinalizeAnswersPrompt
            busy={busy}
            onCancel={() => setShowFinalizePrompt(false)}
            onConfirm={handleFinalizeAnswers}
          />
        ) : null}
      </div>
    </div>
  );
}
