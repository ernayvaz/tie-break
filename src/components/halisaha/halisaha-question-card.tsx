"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { submitHalisahaAnswerAction } from "@/app/(app)/halisaha/actions";
import type {
  HalisahaPublicAnswerState,
  HalisahaPublicQuestion,
} from "@/lib/halisaha/server";

export function HalisahaQuestionCard({
  question,
  initialAnswer,
  answersResolved,
  answersLocked = false,
  predictionWindowClosed = false,
  onError,
  onSuccess,
  selectedAnswer: controlledSelectedAnswer,
  onSelectAnswer,
  questionNumber,
  showSaveButton = true,
  layoutMode = "default",
  onRequestPlayerPicker,
  compactOverlayLayout = false,
}: {
  question: HalisahaPublicQuestion;
  initialAnswer?: HalisahaPublicAnswerState;
  answersResolved: boolean;
  answersLocked?: boolean;
  predictionWindowClosed?: boolean;
  onError?: (message: string) => void;
  onSuccess?: (message: string) => void;
  selectedAnswer?: {
    selectedOptionId: string;
    customScoreHome: number | null;
    customScoreAway: number | null;
  };
  onSelectAnswer?: (answer: {
    selectedOptionId: string;
    customScoreHome: number | null;
    customScoreAway: number | null;
  }) => void;
  questionNumber?: number;
  showSaveButton?: boolean;
  layoutMode?: "default" | "overlay";
  onRequestPlayerPicker?: () => void;
  compactOverlayLayout?: boolean;
}) {
  const router = useRouter();
  const [internalAnswer, setInternalAnswer] = useState({
    selectedOptionId: initialAnswer?.selectedOptionId ?? "",
    customScoreHome: initialAnswer?.customScoreHome ?? null,
    customScoreAway: initialAnswer?.customScoreAway ?? null,
  });
  const [busy, setBusy] = useState(false);
  const [isPlayerPickerOpen, setIsPlayerPickerOpen] = useState(false);
  const selectedAnswer = controlledSelectedAnswer ?? internalAnswer;
  const selectedOptionId = selectedAnswer.selectedOptionId;
  const isOverlayLayout = layoutMode === "overlay";
  const useCompactOverlayLayout = isOverlayLayout && compactOverlayLayout;
  const correctOption = question.options.find((option) => option.isCorrect) ?? null;
  const isMvpPredictionQuestion = question.kind === "mvp_prediction";
  const participantOptions = useMemo(
    () => question.options.filter((option) => option.participantId),
    [question.options],
  );
  const pickerPlaceholderOption = useMemo<HalisahaPublicQuestion["options"][number] | null>(() => {
    const storedPlaceholder = question.options.find((option) => option.kind === "player_picker");
    if (storedPlaceholder) {
      return storedPlaceholder;
    }

    if (isMvpPredictionQuestion || participantOptions.length > 0) {
      return {
        id: `${question.id}-player-picker`,
        label: "Choose player",
        kind: "player_picker",
        participantId: null,
        teamSide: null,
        resolvedScoreHome: null,
        resolvedScoreAway: null,
        sortOrder: participantOptions[0]?.sortOrder ?? 0,
        isCorrect: false,
      };
    }

    return null;
  }, [isMvpPredictionQuestion, participantOptions, question.id, question.options]);
  const visibleOptions = useMemo(() => {
    const baseOptions = question.options.filter(
      (option) => !option.participantId && option.kind !== "player_picker",
    );

    return pickerPlaceholderOption
      ? [...baseOptions, pickerPlaceholderOption].sort(
          (left, right) => left.sortOrder - right.sortOrder,
        )
      : baseOptions;
  }, [pickerPlaceholderOption, question.options]);
  const selectedOption = question.options.find((option) => option.id === selectedOptionId) ?? null;
  const selectedNumericOption =
    selectedOption &&
    (selectedOption.kind === "custom_score" || selectedOption.kind === "custom_number")
      ? selectedOption
      : null;
  const selectedPlayerOption =
    selectedOption && selectedOption.participantId ? selectedOption : null;
  const hasPlayerPickerRow = Boolean(pickerPlaceholderOption);
  const isPredictionWindowClosed =
    predictionWindowClosed && !answersLocked && !answersResolved;
  const isReadOnly = answersResolved || answersLocked || isPredictionWindowClosed || busy;
  const resolvedButPending = answersResolved && !question.resolved;

  useEffect(() => {
    if (controlledSelectedAnswer === undefined) {
      setInternalAnswer({
        selectedOptionId: initialAnswer?.selectedOptionId ?? "",
        customScoreHome: initialAnswer?.customScoreHome ?? null,
        customScoreAway: initialAnswer?.customScoreAway ?? null,
      });
    }
  }, [
    controlledSelectedAnswer,
    initialAnswer?.customScoreAway,
    initialAnswer?.customScoreHome,
    initialAnswer?.selectedOptionId,
  ]);

  const updateAnswer = (nextAnswer: {
    selectedOptionId: string;
    customScoreHome: number | null;
    customScoreAway: number | null;
  }) => {
    if (isReadOnly) {
      return;
    }

    if (onSelectAnswer) {
      onSelectAnswer(nextAnswer);
      return;
    }

    setInternalAnswer(nextAnswer);
  };

  const handleSelectOption = (optionId: string) => {
    const nextOption = question.options.find((option) => option.id === optionId);
    const keepsNumericValues =
      nextOption?.kind === "custom_score" || nextOption?.kind === "custom_number";
    updateAnswer({
      selectedOptionId: optionId,
      customScoreHome: keepsNumericValues ? selectedAnswer.customScoreHome : null,
      customScoreAway:
        nextOption?.kind === "custom_score" ? selectedAnswer.customScoreAway : null,
    });
  };

  const handleCustomNumericChange = (
    optionId: string,
    side: "home" | "away",
    rawValue: string,
  ) => {
    const trimmedValue = rawValue.trim();
    const nextValue =
      trimmedValue === "" ? null : /^\d+$/.test(trimmedValue) ? Number(trimmedValue) : null;
    const targetOption = question.options.find((option) => option.id === optionId);

    updateAnswer({
      selectedOptionId: optionId,
      customScoreHome:
        side === "home" ? nextValue : selectedAnswer.customScoreHome,
      customScoreAway:
        targetOption?.kind === "custom_score" && side === "away"
          ? nextValue
          : targetOption?.kind === "custom_score"
            ? selectedAnswer.customScoreAway
            : null,
    });
  };

  const handleSave = async () => {
    if (!selectedOptionId) {
      onError?.("Select an option first.");
      return;
    }

    if (selectedOption?.kind === "player_picker") {
      onError?.("Choose one player before saving this answer.");
      return;
    }

    if (selectedNumericOption) {
      if (selectedAnswer.customScoreHome === null) {
        onError?.(
          selectedNumericOption.kind === "custom_score"
            ? "Enter both home and away values for your custom score."
            : "Enter a whole number for your prediction.",
        );
        return;
      }

      if (
        selectedNumericOption.kind === "custom_score" &&
        selectedAnswer.customScoreAway === null
      ) {
        onError?.("Enter both home and away values for your custom score.");
        return;
      }
    }

    setBusy(true);
    const result = await submitHalisahaAnswerAction(question.id, selectedOptionId, {
      home: selectedAnswer.customScoreHome,
      away: selectedAnswer.customScoreAway,
    });
    setBusy(false);

    if (!result.ok) {
      onError?.(result.error);
      return;
    }

    onSuccess?.(result.message ?? "Answer saved.");
    router.refresh();
  };

  const helperText = useMemo(() => {
    if (resolvedButPending) {
      if (isMvpPredictionQuestion) {
        return "The final MVP is still being decided by community voting.";
      }
      return "This question is still pending.";
    }

    if (question.resolved && answersResolved) {
      if (initialAnswer?.isCorrect) {
        return `You earned ${initialAnswer.awardedPoints} point(s).`;
      }
      if (initialAnswer) {
        if (isMvpPredictionQuestion && correctOption) {
          return `Final MVP: ${correctOption.label}.`;
        }
        if (
          selectedNumericOption?.kind === "custom_score" &&
          selectedNumericOption.resolvedScoreHome !== null &&
          selectedNumericOption.resolvedScoreAway !== null
        ) {
          return `Actual score: ${selectedNumericOption.resolvedScoreHome}-${selectedNumericOption.resolvedScoreAway}.`;
        }
        if (
          selectedNumericOption?.kind === "custom_number" &&
          selectedNumericOption.resolvedScoreHome !== null
        ) {
          return `Actual value: ${selectedNumericOption.resolvedScoreHome}.`;
        }
        if (selectedPlayerOption && correctOption) {
          return `Correct player: ${correctOption.label}.`;
        }
        if (selectedOption && correctOption) {
          return `Correct answer: ${correctOption.label}.`;
        }
        return "This answer did not score.";
      }
      return "No answer submitted.";
    }

    if (isPredictionWindowClosed) {
      return "Predictions closed 5 minutes before kickoff.";
    }

    if (answersLocked) {
      return "Answers locked.";
    }

    if (!showSaveButton) {
      return "";
    }

    if (selectedPlayerOption) {
      return selectedOptionId
        ? isMvpPredictionQuestion
          ? "You can still change your MVP pick until answers are locked."
          : "You can still change this player pick until answers are locked."
        : isMvpPredictionQuestion
          ? "Choose one player and save your MVP pick."
          : "Choose one player and save your answer.";
    }

    if (selectedNumericOption) {
      if (selectedNumericOption.kind === "custom_number") {
        return selectedAnswer.customScoreHome !== null
          ? "You can still change this numeric prediction until answers are locked."
          : "Enter one whole number to save this prediction.";
      }

      return selectedAnswer.customScoreHome !== null &&
        selectedAnswer.customScoreAway !== null
        ? "You can still change your exact-score pick until answers are locked."
        : "Enter both score values to save your exact-score pick.";
    }

    return selectedOptionId
        ? "You can still update this answer until the match is resolved."
      : hasPlayerPickerRow && visibleOptions.length === 1
        ? isMvpPredictionQuestion
          ? "Choose one player and save your MVP pick."
          : "Choose one player and save your answer."
        : "Pick one option and save your answer.";
  }, [
    answersLocked,
    answersResolved,
    correctOption,
    hasPlayerPickerRow,
    initialAnswer,
    isPredictionWindowClosed,
    isMvpPredictionQuestion,
    question.resolved,
    resolvedButPending,
    selectedAnswer.customScoreAway,
    selectedAnswer.customScoreHome,
    selectedNumericOption,
    selectedOption,
    selectedOptionId,
    selectedPlayerOption,
    showSaveButton,
    visibleOptions.length,
  ]);
  const shouldShowFooter = !isOverlayLayout && (showSaveButton || answersResolved || Boolean(helperText));
  const mvpTeamGroups = useMemo(
    () => ({
      home: participantOptions.filter((option) => option.teamSide === "home"),
      away: participantOptions.filter((option) => option.teamSide === "away"),
    }),
    [participantOptions],
  );
  const hasCorrectParticipant = participantOptions.some((option) => option.isCorrect);
  const overlayOptionGapClass = useCompactOverlayLayout
    ? "gap-[clamp(0.2rem,0.54vh,0.3rem)]"
    : "gap-[clamp(0.22rem,0.64vh,0.34rem)]";
  const overlayOptionHeightClass = useCompactOverlayLayout
    ? "h-[clamp(1.76rem,3.72vh,1.96rem)]"
    : "h-[clamp(1.84rem,4.18vh,2.08rem)]";
  const overlayOptionMinHeightClass = useCompactOverlayLayout
    ? "min-h-[clamp(1.68rem,3.48vh,1.92rem)]"
    : "min-h-[clamp(1.72rem,4.05vh,2.04rem)]";
  const overlayOptionTextClass = useCompactOverlayLayout
    ? "text-center text-[0.62rem] leading-[1.04]"
    : "text-center text-[0.66rem] leading-[1.08]";
  const overlayOptionGridStyle = isOverlayLayout
    ? {
        gridTemplateColumns:
          visibleOptions.length > 0
            ? visibleOptions
                .map((option) =>
                  option.kind === "custom_score" ||
                  option.kind === "custom_number" ||
                  option.kind === "player_picker"
                    ? "minmax(0, 1.72fr)"
                    : "minmax(0, 0.9fr)",
                )
                .join(" ")
            : "minmax(0, 1fr)",
      }
    : undefined;
  const compactOverlaySurfaceClass = useCompactOverlayLayout
    ? "border-white/14 shadow-[0_14px_30px_rgba(0,0,0,0.22)] backdrop-blur-[7px]"
    : "border-white/12 shadow-[0_10px_24px_rgba(0,0,0,0.15)] backdrop-blur-[2px]";
  const compactOverlayNeutralOptionClass = useCompactOverlayLayout
    ? "border-white/12 bg-[rgba(6,12,11,0.38)] hover:bg-[rgba(255,255,255,0.08)]"
    : "border-white/12 bg-black/10 hover:bg-white/[0.05]";
  const compactOverlaySelectedOptionClass = useCompactOverlayLayout
    ? "border-[#d9e6e2]/38 bg-white/[0.14] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
    : "border-[#d9e6e2]/34 bg-white/[0.115] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]";
  const compactOverlayReadValueClass = useCompactOverlayLayout
    ? "border-white/12 bg-[rgba(6,12,11,0.44)] text-white/90"
    : "border-white/12 bg-black/10 text-white/86";
  const compactOverlayMvpActionClass = useCompactOverlayLayout
    ? "border-white/14 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.05))] hover:bg-[rgba(255,255,255,0.11)]"
    : "border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] hover:bg-white/[0.09]";
  const compactOverlayScoreInputClass = useCompactOverlayLayout
    ? "border-white/12 bg-[rgba(6,12,11,0.46)]"
    : "border-white/12 bg-black/15";

  return (
    <article
      className={`halisaha-question-card relative flex ${
        useCompactOverlayLayout ? "h-auto shrink-0" : "h-full min-h-0"
      } flex-col overflow-hidden rounded-[0.92rem] border ${compactOverlaySurfaceClass} ${
        isOverlayLayout
          ? useCompactOverlayLayout
            ? "halisaha-question-card-compact justify-between bg-[linear-gradient(180deg,rgba(7,13,12,0.84),rgba(10,18,17,0.62))] px-[clamp(0.48rem,1.26vw,0.68rem)] py-[clamp(0.34rem,0.78vh,0.48rem)]"
            : "justify-between bg-[linear-gradient(180deg,rgba(7,13,12,0.68),rgba(10,18,17,0.36))] px-[clamp(0.5rem,1.45vw,0.78rem)] py-[clamp(0.4rem,0.96vh,0.56rem)]"
          : "bg-[linear-gradient(180deg,rgba(7,13,12,0.58),rgba(10,18,17,0.26))] px-[clamp(0.5rem,1.45vw,0.78rem)] py-[clamp(0.4rem,0.96vh,0.56rem)]"
      }`}
    >
      <div
        className={`flex items-start justify-between ${
          useCompactOverlayLayout
            ? "gap-2.1 min-h-[2rem]"
            : isOverlayLayout
              ? "gap-2.5 min-h-[2.18rem]"
              : "gap-2.5"
        }`}
      >
        <div
          className={`min-w-0 ${
            useCompactOverlayLayout
              ? "flex min-h-[2rem] flex-col justify-start"
              : isOverlayLayout
                ? "flex min-h-[2.18rem] flex-col justify-start"
                : ""
          }`}
        >
          <div className="text-[0.52rem] font-semibold uppercase tracking-[0.16em] text-white/44">
            Question {questionNumber ?? question.sortOrder}
          </div>
          <h3
            className={`halisaha-question-title mt-[clamp(0.1rem,0.32vh,0.18rem)] font-semibold text-white ${
              isOverlayLayout
                ? useCompactOverlayLayout
                  ? "max-h-[1.7rem] overflow-hidden text-[0.7rem] leading-[0.82rem] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]"
                  : "max-h-[1.82rem] overflow-hidden text-[0.76rem] leading-[0.9rem] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]"
                : "text-[0.8rem] leading-[1.2]"
            }`}
          >
            {question.prompt}
          </h3>
        </div>
        <div className="shrink-0 rounded-full border border-white/10 bg-white/[0.045] px-2 py-[0.18rem] text-[0.48rem] font-semibold uppercase tracking-[0.14em] text-[#d4e4df]">
          {question.points} pt
        </div>
      </div>

      <div
        className={`flex min-h-0 flex-1 flex-col ${
          useCompactOverlayLayout
            ? "mt-[clamp(0.2rem,0.56vh,0.32rem)] justify-center"
            : isOverlayLayout
              ? "mt-[clamp(0.3rem,0.82vh,0.46rem)] justify-center"
              : "mt-[clamp(0.3rem,0.82vh,0.46rem)]"
        }`}
      >
        <div
          className={
            isOverlayLayout
              ? `grid w-full min-w-0 items-stretch ${overlayOptionGapClass}`
              : `flex flex-wrap ${overlayOptionGapClass}`
          }
          style={overlayOptionGridStyle}
        >
          {visibleOptions.map((option) => {
            const isPickerControl = option.kind === "player_picker";
            const isSelected = isPickerControl
              ? Boolean(selectedPlayerOption)
              : selectedOptionId === option.id;
            const isCorrect = isPickerControl
              ? Boolean(question.resolved && selectedPlayerOption?.isCorrect)
              : option.isCorrect;
            const isIncorrectSelected = isPickerControl
              ? question.resolved &&
                Boolean(selectedPlayerOption) &&
                initialAnswer?.selectedOptionId === selectedPlayerOption?.id &&
                initialAnswer?.isCorrect === false
              : question.resolved &&
                initialAnswer?.selectedOptionId === option.id &&
                initialAnswer?.isCorrect === false;
            const showResolutionMeta = isPickerControl
              ? !isOverlayLayout &&
                question.resolved &&
                (Boolean(selectedPlayerOption) || hasCorrectParticipant)
              : !isOverlayLayout &&
                question.resolved &&
                (initialAnswer?.selectedOptionId === option.id || isCorrect);

            if (isPickerControl) {
              return (
                <div key={option.id} className="space-y-2">
                  <div
                    className={`grid ${overlayOptionGapClass} ${
                      useCompactOverlayLayout
                        ? "grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]"
                        : "sm:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (isReadOnly) {
                          return;
                        }
                        if (isOverlayLayout && onRequestPlayerPicker) {
                          onRequestPlayerPicker();
                          return;
                        }
                        setIsPlayerPickerOpen(true);
                      }}
                      disabled={isReadOnly || participantOptions.length === 0}
                      className={`halisaha-mvp-control flex ${
                        isOverlayLayout ? overlayOptionHeightClass : overlayOptionMinHeightClass
                      } items-center justify-center overflow-hidden rounded-[0.72rem] border ${compactOverlayMvpActionClass} px-3 ${
                        isOverlayLayout ? "py-[0.24rem]" : "py-[0.34rem]"
                      } text-[0.66rem] font-semibold uppercase leading-[1.08] tracking-[0.16em] text-white/84 transition-colors disabled:cursor-default disabled:text-white/38`}
                    >
                      {participantOptions.length === 0 ? "No players yet" : "Choose player"}
                    </button>
                    <div
                      className={`halisaha-mvp-control flex ${
                        isOverlayLayout ? overlayOptionHeightClass : overlayOptionMinHeightClass
                      } items-center overflow-hidden rounded-[0.72rem] border px-3 ${
                        isOverlayLayout ? "py-[0.24rem]" : "py-[0.34rem]"
                      } text-[0.66rem] font-medium leading-[1.08] ${
                        isCorrect
                          ? "border-emerald-300/38 bg-emerald-400/10 text-emerald-100"
                          : isIncorrectSelected
                            ? "border-rose-300/28 bg-rose-400/10 text-rose-100"
                            : compactOverlayReadValueClass
                      }`}
                    >
                      <span className="truncate leading-[1.14]">
                        {selectedPlayerOption?.label ?? "No player selected yet"}
                      </span>
                    </div>
                  </div>
                  {showResolutionMeta ? (
                    <div className="flex items-center gap-1 text-[0.44rem] font-semibold uppercase tracking-[0.12em]">
                      {selectedPlayerOption ? (
                        <span className="rounded-full border border-white/12 bg-white/[0.08] px-1.5 py-[0.15rem] text-white/60">
                          Your answer
                        </span>
                      ) : null}
                      {isCorrect ? (
                        <span className="rounded-full border border-emerald-300/30 bg-emerald-400/12 px-1.5 py-[0.15rem] text-emerald-200">
                          Correct
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            }

            if (option.kind === "custom_score" || option.kind === "custom_number") {
              return (
                <label
                  key={option.id}
                  className={`flex min-w-0 items-center rounded-[0.72rem] border transition-[border-color,background-color,box-shadow] ${
                    isOverlayLayout
                      ? `${overlayOptionHeightClass} w-full gap-1 px-[0.52rem] py-[0.22rem]`
                      : "min-h-[2.24rem] flex-1 gap-2 px-2.5 py-[0.42rem]"
                  } ${
                    isCorrect
                      ? "border-emerald-300/50 bg-emerald-400/10"
                      : isIncorrectSelected
                        ? "border-rose-300/30 bg-rose-400/10"
                        : isSelected
                          ? compactOverlaySelectedOptionClass
                          : compactOverlayNeutralOptionClass
                  }`}
                >
                  <input
                    type="radio"
                    name={`question-${question.id}`}
                    value={option.id}
                    checked={isSelected}
                    onChange={(event) => handleSelectOption(event.target.value)}
                    disabled={isReadOnly}
                    className="sr-only"
                  />
                  <span
                    className={`shrink-0 font-medium uppercase text-white/58 ${
                      isOverlayLayout
                        ? "min-w-[1.72rem] text-[0.48rem] tracking-[0.08em]"
                        : "text-[0.68rem] tracking-[0.12em]"
                    }`}
                  >
                    {isOverlayLayout ? "Yours" : option.label}
                  </span>
                  <div className="ml-auto flex min-w-0 items-center gap-[0.24rem]">
                    <input
                      value={
                        selectedOptionId === option.id
                          ? (selectedAnswer.customScoreHome ?? "").toString()
                          : ""
                      }
                      onFocus={() => handleSelectOption(option.id)}
                      onChange={(event) =>
                        handleCustomNumericChange(option.id, "home", event.target.value)
                      }
                      inputMode="numeric"
                      disabled={isReadOnly}
                      className={`rounded-[0.6rem] border ${compactOverlayScoreInputClass} px-1 text-center font-semibold text-white outline-none placeholder:text-white/24 ${
                        isOverlayLayout
                          ? "h-[1.3rem] w-[2.18rem] text-[0.66rem]"
                          : "h-8 w-12 px-2 text-[0.78rem]"
                      }`}
                      placeholder="0"
                    />
                    {option.kind === "custom_score" ? (
                      <>
                        <span
                          className={`shrink-0 text-white/42 ${
                            isOverlayLayout ? "text-[0.62rem]" : ""
                          }`}
                        >
                          -
                        </span>
                        <input
                          value={
                            selectedOptionId === option.id
                              ? (selectedAnswer.customScoreAway ?? "").toString()
                              : ""
                          }
                          onFocus={() => handleSelectOption(option.id)}
                          onChange={(event) =>
                            handleCustomNumericChange(option.id, "away", event.target.value)
                          }
                          inputMode="numeric"
                          disabled={isReadOnly}
                          className={`rounded-[0.6rem] border ${compactOverlayScoreInputClass} px-1 text-center font-semibold text-white outline-none placeholder:text-white/24 ${
                            isOverlayLayout
                              ? "h-[1.3rem] w-[2.18rem] text-[0.66rem]"
                              : "h-8 w-12 px-2 text-[0.78rem]"
                          }`}
                          placeholder="0"
                        />
                      </>
                    ) : null}
                  </div>
                </label>
              );
            }

            return (
              <label
                key={option.id}
                className={`group flex ${
                  isOverlayLayout ? overlayOptionHeightClass : overlayOptionMinHeightClass
                } max-w-full cursor-pointer items-center overflow-hidden ${
                  isOverlayLayout
                    ? "min-w-0 w-full px-2 py-[0.24rem]"
                    : "min-w-[5.7rem] flex-[0_1_auto] px-2.5 py-[0.42rem]"
                } ${
                  showResolutionMeta
                    ? "justify-between"
                    : isOverlayLayout
                      ? "justify-center"
                      : "justify-start"
                } gap-1.4 rounded-[0.72rem] border transition-[border-color,background-color,box-shadow] ${
                  isCorrect
                    ? "border-emerald-300/50 bg-emerald-400/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                    : isIncorrectSelected
                      ? "border-rose-300/28 bg-rose-400/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                      : isSelected
                        ? compactOverlaySelectedOptionClass
                        : compactOverlayNeutralOptionClass
                }`}
              >
                <input
                  type="radio"
                  name={`question-${question.id}`}
                  value={option.id}
                  checked={isSelected}
                  onChange={(event) => handleSelectOption(event.target.value)}
                  disabled={isReadOnly}
                  className="sr-only"
                />
                <span
                  className={`halisaha-question-option-text min-w-0 truncate whitespace-nowrap font-medium text-white/90 ${
                    isOverlayLayout ? overlayOptionTextClass : "text-[0.72rem] leading-[1.14]"
                  }`}
                >
                  {option.label}
                </span>
                {showResolutionMeta ? (
                  <span className="ml-1 flex items-center gap-1 text-[0.44rem] font-semibold uppercase tracking-[0.12em]">
                    {question.resolved && initialAnswer?.selectedOptionId === option.id ? (
                      <span className="rounded-full border border-white/12 bg-white/[0.08] px-1.5 py-[0.15rem] text-white/60">
                        Your answer
                      </span>
                    ) : null}
                    {question.resolved && isCorrect ? (
                      <span className="rounded-full border border-emerald-300/30 bg-emerald-400/12 px-1.5 py-[0.15rem] text-emerald-200">
                        Correct
                      </span>
                    ) : null}
                  </span>
                ) : null}
              </label>
            );
          })}
        </div>
        {hasPlayerPickerRow && !isOverlayLayout && isPlayerPickerOpen ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center px-3">
            <div
              className="absolute inset-0 rounded-[0.92rem] bg-[rgba(3,8,8,0.68)] backdrop-blur-[8px]"
              onClick={() => setIsPlayerPickerOpen(false)}
            />
            <div className="relative w-full max-w-[26rem] rounded-[1rem] border border-white/12 bg-[linear-gradient(180deg,rgba(10,18,17,0.96),rgba(8,14,14,0.92))] p-4 shadow-[0_24px_56px_rgba(0,0,0,0.34)]">
              <div className="text-[0.54rem] font-semibold uppercase tracking-[0.2em] text-white/42">
                {isMvpPredictionQuestion ? "MVP picker" : "Player picker"}
              </div>
              <h4 className="mt-2 text-[0.96rem] font-semibold text-white">
                {isMvpPredictionQuestion ? "Choose your MVP candidate" : "Choose one player"}
              </h4>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {[
                  {
                    label: "Home team",
                    options: mvpTeamGroups.home,
                  },
                  {
                    label: "Away team",
                    options: mvpTeamGroups.away,
                  },
                ].map((group) => (
                  <div
                    key={group.label}
                    className="rounded-[0.9rem] border border-white/10 bg-white/[0.04] p-3"
                  >
                    <div className="text-[0.54rem] font-semibold uppercase tracking-[0.18em] text-white/42">
                      {group.label}
                    </div>
                    <div className="mt-2 space-y-2">
                      {group.options.length > 0 ? (
                        group.options.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => {
                              handleSelectOption(option.id);
                              setIsPlayerPickerOpen(false);
                            }}
                            className={`flex w-full items-center justify-between rounded-[0.74rem] border px-3 py-2 text-left text-[0.74rem] font-medium transition-colors ${
                              selectedOptionId === option.id
                                ? "border-white/20 bg-white/[0.12] text-white"
                                : "border-white/10 bg-black/10 text-white/82 hover:bg-white/[0.06]"
                            }`}
                          >
                            <span className="truncate">{option.label}</span>
                            <span className="text-[0.52rem] uppercase tracking-[0.16em] text-white/38">
                              Pick
                            </span>
                          </button>
                        ))
                      ) : (
                        <div className="text-[0.72rem] text-white/42">
                          No players have been assigned to this team yet.
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsPlayerPickerOpen(false)}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-[0.55rem] text-[0.56rem] font-semibold uppercase tracking-[0.16em] text-white/74 transition-colors hover:bg-white/[0.08]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {shouldShowFooter ? (
        <div
          className={`flex items-center justify-between gap-3 ${
            showSaveButton ? "mt-3" : "mt-[clamp(0.2rem,1vh,0.4rem)]"
          }`}
        >
          <div className={`${showSaveButton ? "text-[0.66rem]" : "text-[0.6rem]"} leading-tight text-white/48`}>
            {helperText}
          </div>
          {!answersResolved && !answersLocked && !isPredictionWindowClosed && showSaveButton ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={handleSave}
              disabled={busy || answersLocked}
              className="border-white/15 bg-white/10 px-3 py-1 text-[0.65rem] text-white hover:bg-white/14"
            >
              {busy ? "Saving..." : "Save answer"}
            </Button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
