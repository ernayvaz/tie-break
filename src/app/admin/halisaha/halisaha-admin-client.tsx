"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  HalisahaFormation,
  HalisahaPositionKey,
  HalisahaTeamSide,
} from "@prisma/client";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@/components/ui";
import {
  addHalisahaGuestFromRegistryAction,
  addHalisahaGuestParticipantAction,
  addHalisahaRegisteredParticipantAction,
  clearHalisahaParticipantsAction,
  createHalisahaQuestionAction,
  deactivateHalisahaGuestRegistryAction,
  deleteHalisahaQuestionAction,
  moveHalisahaQuestionAction,
  removeHalisahaParticipantAction,
  resolveHalisahaMvpFromVotesAction,
  saveHalisahaMatchSettingsAction,
  scoreHalisahaAnswersAction,
  setHalisahaMatchPublishedAction,
  setHalisahaScoreQuestionResultAction,
  setHalisahaQuestionCorrectOptionAction,
  updateHalisahaParticipantAssignmentAction,
  updateHalisahaQuestionAction,
  type HalisahaAdminActionState,
  type ManagedHalisahaQuestionOptionInput,
} from "./actions";
import type {
  HalisahaAdminParticipantRow,
  HalisahaAdminQuestionRow,
  HalisahaAdminSnapshot,
} from "@/lib/halisaha/server";
import {
  PLAYER_PICKER_OPTION_LABEL,
  collapseStoredHalisahaQuestionOptionsToDrafts,
  deriveManagedHalisahaQuestionKindFromDrafts,
  getHalisahaQuestionTypeBadgesFromOptionKinds,
  getManagedHalisahaQuestionKindLabel,
  getManagedHalisahaQuestionOptionDefaultLabel,
  type ManagedHalisahaQuestionKind,
} from "@/lib/halisaha/question-option-utils";
import {
  getHalisahaFormationLabel,
  getHalisahaFormationPositionOptions,
  HALISAHA_FORMATION_OPTIONS,
  HALISAHA_TEAM_SIDE_OPTIONS,
} from "@/lib/halisaha/config";

type ApprovedUserRow = {
  id: string;
  name: string;
  surname: string;
  username: string;
  role: string;
};

const selectClassName =
  "w-full rounded-lg border border-nord-polarLighter bg-white px-3 py-2 text-sm text-nord-polar focus:border-nord-frostDark focus:outline-none focus:ring-1 focus:ring-nord-frostDark";
const textareaClassName =
  "w-full rounded-lg border border-nord-polarLighter bg-white px-3 py-2 text-sm text-nord-polar placeholder-nord-polarLighter focus:border-nord-frostDark focus:outline-none focus:ring-1 focus:ring-nord-frostDark";
const DEFAULT_OPTION_COUNT = 4;

type EditableQuestionKind = ManagedHalisahaQuestionKind;
type EditableQuestionOptionDraft = ManagedHalisahaQuestionOptionInput;

function createDefaultOptionDrafts(
  count = DEFAULT_OPTION_COUNT,
): EditableQuestionOptionDraft[] {
  return Array.from({ length: count }, () => ({
    label: "",
    kind: "standard",
  }));
}

function getQuestionTypeBadgeClass(kind: EditableQuestionKind) {
  if (kind === "player_prediction") {
    return "border-nord-auroraPurple/25 bg-nord-auroraPurple/10 text-nord-auroraPurple";
  }
  if (kind === "score_prediction") {
    return "border-nord-auroraGreen/25 bg-nord-auroraGreen/10 text-nord-auroraGreen";
  }
  if (kind === "number_prediction") {
    return "border-nord-auroraYellow/25 bg-nord-auroraYellow/10 text-nord-auroraYellow";
  }
  return "border-nord-frostDark/25 bg-nord-frostLight/10 text-nord-frostDark";
}

function getQuestionOptionDrafts(question: HalisahaAdminQuestionRow): EditableQuestionOptionDraft[] {
  if (question.kind === "winner" || question.kind === "mvp_prediction") {
    return [];
  }

  return collapseStoredHalisahaQuestionOptionsToDrafts(question.options);
}

function updateOptionDraftKind(
  drafts: EditableQuestionOptionDraft[],
  index: number,
  nextKind: EditableQuestionKind,
) {
  const hasAnotherPlayerPicker = drafts.some(
    (draft, currentIndex) => currentIndex !== index && draft.kind === "player_prediction",
  );

  if (nextKind === "player_prediction" && hasAnotherPlayerPicker) {
    return {
      ok: false as const,
      error: "Use only one player picker row per question.",
    };
  }

  return {
    ok: true as const,
    drafts: drafts.map((draft, currentIndex) =>
      currentIndex === index
        ? {
            label:
              nextKind === "standard"
                ? draft.kind === "standard"
                  ? draft.label
                  : ""
                : getManagedHalisahaQuestionOptionDefaultLabel(nextKind),
            kind: nextKind,
          }
        : draft,
    ),
  };
}

function buildNumericOptionValueDrafts(question: HalisahaAdminQuestionRow) {
  return Object.fromEntries(
    question.options
      .filter((option) => option.kind === "custom_score" || option.kind === "custom_number")
      .map((option) => [
        option.id,
        {
          home: option.resolvedScoreHome?.toString() ?? "",
          away: option.resolvedScoreAway?.toString() ?? "",
        },
      ]),
  ) as Record<string, { home: string; away: string }>;
}

function actionError(result: HalisahaAdminActionState) {
  return !result.ok ? result.error : null;
}

function actionSuccess(
  result: HalisahaAdminActionState,
  fallback: string,
) {
  return result.ok ? result.message ?? fallback : null;
}

function ParticipantAssignmentRow({
  participant,
  homeTeamName,
  awayTeamName,
  homeFormation,
  awayFormation,
  onError,
  onSuccess,
}: {
  participant: HalisahaAdminParticipantRow;
  homeTeamName: string;
  awayTeamName: string;
  homeFormation: HalisahaFormation;
  awayFormation: HalisahaFormation;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}) {
  const router = useRouter();
  const [teamSide, setTeamSide] = useState<HalisahaTeamSide | "">(
    participant.teamSide ?? "",
  );
  const [positionKey, setPositionKey] = useState<HalisahaPositionKey | "">(
    participant.positionKey ?? "",
  );
  const [displayName, setDisplayName] = useState(participant.displayName);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setTeamSide(participant.teamSide ?? "");
    setPositionKey(participant.positionKey ?? "");
    setDisplayName(participant.displayName);
  }, [participant.displayName, participant.positionKey, participant.teamSide]);

  const teamOptions = HALISAHA_TEAM_SIDE_OPTIONS.map((option) => ({
    ...option,
    label: option.value === "home" ? homeTeamName : awayTeamName,
  }));
  const activeFormation =
    teamSide === "home" ? homeFormation : teamSide === "away" ? awayFormation : null;
  const positionOptions = useMemo(
    () =>
      activeFormation
        ? getHalisahaFormationPositionOptions(activeFormation)
        : [],
    [activeFormation],
  );

  useEffect(() => {
    if (
      positionKey &&
      activeFormation &&
      !positionOptions.some((option) => option.value === positionKey)
    ) {
      setPositionKey("");
    }
  }, [activeFormation, positionKey, positionOptions]);

  const normalizedDefaultDisplayName =
    participant.defaultDisplayName.trim().replace(/\s+/g, " ") || participant.defaultDisplayName;
  const normalizedDisplayName =
    displayName.trim().replace(/\s+/g, " ") || normalizedDefaultDisplayName;
  const usesDefaultDisplayName = normalizedDisplayName === normalizedDefaultDisplayName;

  const handleSave = async () => {
    setBusy(true);
    const result = await updateHalisahaParticipantAssignmentAction(participant.id, {
      teamSide: teamSide || null,
      positionKey: positionKey || null,
      displayName,
    });
    setBusy(false);

    const error = actionError(result);
    if (error) {
      onError(error);
      return;
    }

    onSuccess(actionSuccess(result, "Assignment updated.") ?? "Assignment updated.");
    router.refresh();
  };

  const handleRemove = async () => {
    if (!window.confirm(`Remove ${participant.defaultDisplayName} from this Halisaha match?`)) {
      return;
    }

    setBusy(true);
    const result = await removeHalisahaParticipantAction(participant.id);
    setBusy(false);

    const error = actionError(result);
    if (error) {
      onError(error);
      return;
    }

    onSuccess(actionSuccess(result, "Participant removed.") ?? "Participant removed.");
    router.refresh();
  };

  return (
    <tr
      className="border-b border-nord-polarLighter/30 align-top"
      data-participant-id={participant.id}
    >
      <td className="px-4 py-3">
        <div className="font-medium text-nord-polar">{participant.defaultDisplayName}</div>
        <div className="mt-1 text-xs text-nord-polarLight">
          {participant.isGuest ? "Guest" : "Registered user"}
        </div>
      </td>
      <td className="px-4 py-3">
        <select
          value={teamSide}
          onChange={(event) => setTeamSide(event.target.value as HalisahaTeamSide | "")}
          className={selectClassName}
          disabled={busy}
        >
          <option value="">Unassigned</option>
          {teamOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3">
        <select
          value={positionKey}
          onChange={(event) =>
            setPositionKey(event.target.value as HalisahaPositionKey | "")
          }
          className={selectClassName}
          disabled={busy}
        >
          <option value="">
            {activeFormation ? "No position" : "Pick a team first"}
          </option>
          {positionOptions.map((slot) => (
            <option key={slot.value} value={slot.value}>
              {slot.label}
            </option>
          ))}
        </select>
        {activeFormation ? (
          <div className="mt-1 text-xs text-nord-polarLight">
            Tactic: {getHalisahaFormationLabel(activeFormation)}
          </div>
        ) : null}
      </td>
      <td className="px-4 py-3">
        <div className="min-w-[15rem] space-y-2">
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            className={textareaClassName}
            placeholder={participant.defaultDisplayName}
            disabled={busy}
            spellCheck={false}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-nord-polarLight">
            <span>Default: {participant.defaultDisplayName}</span>
            {usesDefaultDisplayName ? (
              <span>Current name selected</span>
            ) : (
              <button
                type="button"
                className="underline"
                onClick={() => setDisplayName(participant.defaultDisplayName)}
                disabled={busy}
              >
                Use current name
              </button>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={handleSave} disabled={busy}>
            Save
          </Button>
          <Button size="sm" variant="danger" onClick={handleRemove} disabled={busy}>
            Remove
          </Button>
        </div>
      </td>
    </tr>
  );
}

function QuestionEditorCard({
  question,
  canMoveUp,
  canMoveDown,
  onError,
  onSuccess,
}: {
  question: HalisahaAdminQuestionRow;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}) {
  const router = useRouter();
  const isWinnerQuestion = question.kind === "winner";
  const isMvpPredictionQuestion = question.kind === "mvp_prediction";
  const isPinnedQuestion = isWinnerQuestion || isMvpPredictionQuestion;
  const initialOptionDrafts = getQuestionOptionDrafts(question);
  const [prompt, setPrompt] = useState(question.prompt);
  const [points, setPoints] = useState(String(question.points));
  const [optionDrafts, setOptionDrafts] = useState<EditableQuestionOptionDraft[]>(
    initialOptionDrafts,
  );
  const [isActive, setIsActive] = useState(question.isActive);
  const [correctOptionId, setCorrectOptionId] = useState<string | "">(
    question.options.find((option) => option.isCorrect)?.id ?? "",
  );
  const [numericOptionDrafts, setNumericOptionDrafts] = useState(
    buildNumericOptionValueDrafts(question),
  );
  const [busy, setBusy] = useState(false);
  const derivedQuestionKind = deriveManagedHalisahaQuestionKindFromDrafts(optionDrafts);
  const optionTypeBadges = useMemo(
    () => getHalisahaQuestionTypeBadgesFromOptionKinds(optionDrafts),
    [optionDrafts],
  );
  const hasPlayerDraft = optionDrafts.some((draft) => draft.kind === "player_prediction");
  const hasScoreDraft = optionDrafts.some((draft) => draft.kind === "score_prediction");
  const hasNumberDraft = optionDrafts.some((draft) => draft.kind === "number_prediction");
  const fixedChoiceOptions = useMemo(
    () => question.options.filter((option) => option.kind === "standard"),
    [question.options],
  );
  const numericOptions = useMemo(
    () =>
      question.options.filter(
        (option) => option.kind === "custom_score" || option.kind === "custom_number",
      ),
    [question.options],
  );

  useEffect(() => {
    const nextOptionDrafts = getQuestionOptionDrafts(question);
    setPrompt(question.prompt);
    setPoints(String(question.points));
    setOptionDrafts(nextOptionDrafts);
    setIsActive(question.isActive);
    setCorrectOptionId(
      question.options.find((option) => option.isCorrect)?.id ?? "",
    );
    setNumericOptionDrafts(buildNumericOptionValueDrafts(question));
  }, [question]);

  const handleOptionLabelChange = (index: number, label: string) => {
    setOptionDrafts((current) =>
      current.map((item, currentIndex) =>
        currentIndex === index
          ? {
              ...item,
              label,
            }
          : item,
      ),
    );
  };

  const handleOptionTypeChange = (index: number, nextKind: EditableQuestionKind) => {
    const nextDraftsResult = updateOptionDraftKind(optionDrafts, index, nextKind);
    if (!nextDraftsResult.ok) {
      onError(nextDraftsResult.error);
      return;
    }

    setOptionDrafts(nextDraftsResult.drafts);
  };

  const handleSave = async () => {
    setBusy(true);
    const result = await updateHalisahaQuestionAction(question.id, {
      kind: isPinnedQuestion ? question.kind : derivedQuestionKind,
      prompt,
      points: Number(points),
      options: optionDrafts,
      isActive,
    });
    setBusy(false);

    const error = actionError(result);
    if (error) {
      onError(error);
      return;
    }

    onSuccess(actionSuccess(result, "Question updated.") ?? "Question updated.");
    router.refresh();
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this question and all its answers?")) return;

    setBusy(true);
    const result = await deleteHalisahaQuestionAction(question.id);
    setBusy(false);

    const error = actionError(result);
    if (error) {
      onError(error);
      return;
    }

    onSuccess(actionSuccess(result, "Question deleted.") ?? "Question deleted.");
    router.refresh();
  };

  const handleMove = async (direction: "up" | "down") => {
    setBusy(true);
    const result = await moveHalisahaQuestionAction(question.id, direction);
    setBusy(false);

    const error = actionError(result);
    if (error) {
      onError(error);
      return;
    }

    onSuccess(
      actionSuccess(
        result,
        direction === "up" ? "Question moved up." : "Question moved down.",
      ) ??
        (direction === "up" ? "Question moved up." : "Question moved down."),
    );
    router.refresh();
  };

  const handleSetCorrectOption = async () => {
    setBusy(true);
    const result = await setHalisahaQuestionCorrectOptionAction(
      question.id,
      correctOptionId || null,
    );
    setBusy(false);

    const error = actionError(result);
    if (error) {
      onError(error);
      return;
    }

    onSuccess(
      actionSuccess(result, "Correct option updated.") ?? "Correct option updated.",
    );
    router.refresh();
  };

  const handleSaveActualScore = async (optionId: string, clear = false) => {
    const optionDraft = numericOptionDrafts[optionId] ?? { home: "", away: "" };
    setBusy(true);
    const result = await setHalisahaScoreQuestionResultAction(
      question.id,
      optionId,
      clear
        ? null
        : {
            home: optionDraft.home.trim() === "" ? null : Number(optionDraft.home),
            away: optionDraft.away.trim() === "" ? null : Number(optionDraft.away),
          },
    );
    setBusy(false);

    const error = actionError(result);
    if (error) {
      onError(error);
      return;
    }

    onSuccess(
      actionSuccess(result, "Actual result saved.") ?? "Actual result saved.",
    );
    router.refresh();
  };

  const addOption = () => {
    setOptionDrafts((current) => [...current, { label: "", kind: "standard" }]);
  };

  const removeOption = (index: number) => {
    setOptionDrafts((current) => {
      if (current.length <= 1) {
        return current;
      }
      return current.filter((_, currentIndex) => currentIndex !== index);
    });
  };

  const handleNumericOptionDraftChange = (
    optionId: string,
    side: "home" | "away",
    value: string,
  ) => {
    setNumericOptionDrafts((current) => ({
      ...current,
      [optionId]: {
        home: side === "home" ? value : current[optionId]?.home ?? "",
        away: side === "away" ? value : current[optionId]?.away ?? "",
      },
    }));
  };

  return (
    <Card className="border-nord-polarLighter/35 shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>{question.prompt}</CardTitle>
            {isWinnerQuestion ? (
              <span className="rounded-full border border-nord-frostDark/25 bg-nord-frostLight/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-nord-frostDark">
                Pinned winner strip
              </span>
            ) : isMvpPredictionQuestion ? (
              <span className="rounded-full border border-nord-frostDark/25 bg-nord-frostLight/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-nord-frostDark">
                Synced MVP pick
              </span>
            ) : optionTypeBadges.length > 0 ? (
              optionTypeBadges.map((badge) => (
                <span
                  key={`${question.id}-${badge.kind}`}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${getQuestionTypeBadgeClass(badge.kind)}`}
                >
                  {badge.label}
                </span>
              ))
            ) : null}
          </div>
          <p className="mt-1 text-xs text-nord-polarLight">
            {question.optionCount} option(s), {question.answerCount} answer(s), {question.points} point(s)
          </p>
        </div>
        {isPinnedQuestion ? (
          <div className="rounded-full border border-nord-polarLighter/40 bg-nord-snow/60 px-3 py-1 text-xs text-nord-polarLight">
            Always active
          </div>
        ) : (
          <label className="inline-flex items-center gap-2 text-xs text-nord-polarLight">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
              className="rounded border-nord-polarLighter"
            />
            Active
          </label>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-nord-polar">
            {isWinnerQuestion
              ? "Winner question prompt"
              : isMvpPredictionQuestion
                ? "MVP question prompt"
                : "Question"}
          </label>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={3}
            className={textareaClassName}
            disabled={busy}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="Points"
            type="number"
            min={1}
            value={points}
            onChange={(event) => setPoints(event.target.value)}
            disabled={busy}
          />
          <div className="rounded-lg border border-nord-polarLighter/30 bg-nord-snow/45 px-4 py-3 text-sm text-nord-polarLight">
            {isPinnedQuestion
              ? isWinnerQuestion
                ? "This question stays pinned to the winner strip."
                : "This MVP question keeps its synced player-picker type."
              : optionTypeBadges.length > 1
                ? "This question uses mixed option types."
                : `Current answer model: ${getManagedHalisahaQuestionKindLabel(derivedQuestionKind)}.`}
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-nord-polar">
              {isPinnedQuestion ? "Options" : "Options & type"}
            </label>
            {!isPinnedQuestion ? (
              <Button size="sm" variant="ghost" onClick={addOption} disabled={busy}>
                Add option
              </Button>
            ) : null}
          </div>
          {isWinnerQuestion ? (
            <p className="mb-2 text-xs text-nord-polarLight">
              Winner strip team labels stay synced with the home and away team names from
              match setup.
            </p>
          ) : isMvpPredictionQuestion ? (
            <p className="mb-2 text-xs text-nord-polarLight">
              Player choices stay synced from the current squad. You can still edit this
              question&apos;s text, points and order.
            </p>
          ) : null}
          {!isPinnedQuestion && hasPlayerDraft ? (
            <p className="mb-2 text-xs text-nord-polarLight">
              Player picker rows stay synced from the current assigned squads automatically.
            </p>
          ) : null}
          {!isPinnedQuestion && hasScoreDraft ? (
            <p className="mb-2 text-xs text-nord-polarLight">
              Two-number rows keep their own actual home and away result after the match.
            </p>
          ) : null}
          {!isPinnedQuestion && hasNumberDraft ? (
            <p className="mb-2 text-xs text-nord-polarLight">
              Single-number rows keep their own actual value after the match.
            </p>
          ) : null}
          {!isPinnedQuestion && question.answerCount > 0 ? (
            <p className="mb-2 text-xs text-amber-700">
              Changing the type or option set will clear the existing saved answers for this
              question so the new choices can be published safely.
            </p>
          ) : null}
          {isPinnedQuestion ? (
            <div className="rounded-lg border border-dashed border-nord-polarLighter/40 bg-nord-snow/45 px-3 py-2 text-xs text-nord-polarLight">
              {isWinnerQuestion
                ? "Winner strip options stay synced to the current home and away team names."
                : "MVP player choices stay synced from the current squad automatically."}
            </div>
          ) : (
            <div className="space-y-2">
              {optionDrafts.map((option, index) => (
                <div
                  key={`${question.id}-option-${index}`}
                  className="grid gap-2 md:grid-cols-[minmax(0,1fr)_15rem_auto]"
                >
                  {option.kind === "player_prediction" ? (
                    <div className="rounded-lg border border-dashed border-nord-polarLighter/40 bg-nord-snow/45 px-3 py-2 text-sm text-nord-polarLight">
                      {PLAYER_PICKER_OPTION_LABEL}. The selectable players will sync from the current squads.
                    </div>
                  ) : (
                    <input
                      value={option.label}
                      onChange={(event) =>
                        handleOptionLabelChange(index, event.target.value)
                      }
                      className={selectClassName}
                      disabled={busy}
                      placeholder={
                        option.kind === "standard"
                          ? `Option ${index + 1}`
                          : getManagedHalisahaQuestionOptionDefaultLabel(option.kind)
                      }
                    />
                  )}
                  <select
                    value={option.kind}
                    onChange={(event) =>
                      handleOptionTypeChange(index, event.target.value as EditableQuestionKind)
                    }
                    className={selectClassName}
                    disabled={busy}
                  >
                    <option value="standard">Standard multiple choice</option>
                    <option value="player_prediction">Player picker</option>
                    <option value="score_prediction">Two-number prediction</option>
                    <option value="number_prediction">Single-number prediction</option>
                  </select>
                  {optionDrafts.length > 1 ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeOption(index)}
                      disabled={busy}
                    >
                      Remove
                    </Button>
                  ) : (
                    <div />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {numericOptions.length > 0 ? (
          <div className="rounded-lg border border-nord-polarLighter/30 bg-nord-snow/45 p-3">
            <div className="mb-2 text-sm font-medium text-nord-polar">
              Actual numeric rows after the match
            </div>
            <p className="mb-3 text-xs text-nord-polarLight">
              Each numeric row stores its own actual result. Finalized answers must match that row exactly to score.
            </p>
            <div className="space-y-3">
              {numericOptions.map((option) => {
                const isSingleNumberOption = option.kind === "custom_number";
                const values = numericOptionDrafts[option.id] ?? { home: "", away: "" };

                return (
                  <div
                    key={option.id}
                    className="rounded-lg border border-nord-polarLighter/30 bg-white/55 p-3"
                  >
                    <div className="mb-2 text-sm font-medium text-nord-polar">
                      {option.label}
                    </div>
                    <div
                      className={`grid gap-3 ${
                        isSingleNumberOption ? "md:grid-cols-1" : "md:grid-cols-2"
                      }`}
                    >
                      <Input
                        label={isSingleNumberOption ? "Actual value" : "Actual home score"}
                        type="number"
                        min={0}
                        value={values.home}
                        onChange={(event) =>
                          handleNumericOptionDraftChange(option.id, "home", event.target.value)
                        }
                        disabled={busy}
                      />
                      {!isSingleNumberOption ? (
                        <Input
                          label="Actual away score"
                          type="number"
                          min={0}
                          value={values.away}
                          onChange={(event) =>
                            handleNumericOptionDraftChange(option.id, "away", event.target.value)
                          }
                          disabled={busy}
                        />
                      ) : null}
                    </div>
                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSaveActualScore(option.id, true)}
                        disabled={busy}
                      >
                        Clear actual result
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleSaveActualScore(option.id)}
                        disabled={busy}
                      >
                        Save actual result
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {isMvpPredictionQuestion ? (
          <div className="rounded-lg border border-nord-polarLighter/30 bg-nord-snow/45 p-3 text-sm text-nord-polarLight">
            <div className="font-medium text-nord-polar">Community MVP resolution</div>
            <div className="mt-2">
              {question.options.find((option) => option.isCorrect)?.label ??
                "Pending. The final MVP will be resolved from the post-match MVP vote window."}
            </div>
          </div>
        ) : null}

        {!isMvpPredictionQuestion && fixedChoiceOptions.length > 0 ? (
          <div className="rounded-lg border border-nord-polarLighter/30 bg-nord-snow/45 p-3">
            <div className="mb-2 text-sm font-medium text-nord-polar">
              Correct option after the match
            </div>
            <div className="space-y-2">
              {fixedChoiceOptions.map((option) => (
                <label
                  key={option.id}
                  className="flex items-center gap-3 text-sm text-nord-polar"
                >
                  <input
                    type="radio"
                    name={`correct-option-${question.id}`}
                    value={option.id}
                    checked={correctOptionId === option.id}
                    onChange={(event) => setCorrectOptionId(event.target.value)}
                    className="h-4 w-4 border-nord-polarLighter"
                  />
                  <span>{option.label}</span>
                </label>
              ))}
              <button
                type="button"
                className="text-xs text-nord-polarLight underline"
                onClick={() => setCorrectOptionId("")}
              >
                Clear correct option
              </button>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          {!isWinnerQuestion ? (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleMove("up")}
                disabled={busy || !canMoveUp}
              >
                Move up
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleMove("down")}
                disabled={busy || !canMoveDown}
              >
                Move down
              </Button>
            </>
          ) : null}
          <Button size="sm" variant="secondary" onClick={handleSave} disabled={busy}>
            {isWinnerQuestion
              ? "Save winner question"
              : isMvpPredictionQuestion
                ? "Save MVP question"
                : "Save question"}
          </Button>
          {!isMvpPredictionQuestion && fixedChoiceOptions.length > 0 ? (
            <Button size="sm" variant="ghost" onClick={handleSetCorrectOption} disabled={busy}>
              Save correct answer
            </Button>
          ) : null}
          {!isPinnedQuestion ? (
            <Button size="sm" variant="danger" onClick={handleDelete} disabled={busy}>
              Delete
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function HalisahaAdminClient({
  snapshot,
  approvedUsers,
}: {
  snapshot: HalisahaAdminSnapshot;
  approvedUsers: ApprovedUserRow[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedGuestId, setSelectedGuestId] = useState("");
  const [guestName, setGuestName] = useState("");
  const [newQuestionPrompt, setNewQuestionPrompt] = useState("");
  const [newQuestionPoints, setNewQuestionPoints] = useState("1");
  const [newQuestionOptionDrafts, setNewQuestionOptionDrafts] = useState<
    EditableQuestionOptionDraft[]
  >(createDefaultOptionDrafts());
  const newQuestionKind = deriveManagedHalisahaQuestionKindFromDrafts(newQuestionOptionDrafts);
  const newQuestionTypeBadges = useMemo(
    () => getHalisahaQuestionTypeBadgesFromOptionKinds(newQuestionOptionDrafts),
    [newQuestionOptionDrafts],
  );
  const newQuestionHasPlayerDraft = newQuestionOptionDrafts.some(
    (draft) => draft.kind === "player_prediction",
  );
  const newQuestionHasScoreDraft = newQuestionOptionDrafts.some(
    (draft) => draft.kind === "score_prediction",
  );
  const newQuestionHasNumberDraft = newQuestionOptionDrafts.some(
    (draft) => draft.kind === "number_prediction",
  );
  const reorderableQuestionIds = useMemo(
    () => snapshot.questions.filter((question) => question.kind !== "winner").map((question) => question.id),
    [snapshot.questions],
  );

  const clearFeedback = () => {
    setError(null);
    setSuccess(null);
  };

  const availableUsers = useMemo(
    () => {
      const participantUserIds = new Set(
        snapshot.participants
          .map((participant) => participant.userId)
          .filter(Boolean),
      );
      return approvedUsers.filter((user) => !participantUserIds.has(user.id));
    },
    [approvedUsers, snapshot.participants],
  );
  const availableGuestRegistry = useMemo(() => {
    const participantGuestIds = new Set(
      snapshot.participants
        .map((participant) => participant.guestId)
        .filter(Boolean),
    );

    return snapshot.guestRegistry.filter((guest) => !participantGuestIds.has(guest.id));
  }, [snapshot.guestRegistry, snapshot.participants]);

  const runAction = async (
    fn: () => Promise<HalisahaAdminActionState>,
    successFallback: string,
    afterSuccess?: () => void,
  ) => {
    setBusy(true);
    clearFeedback();
    const result = await fn();
    setBusy(false);

    const errorMessage = actionError(result);
    if (errorMessage) {
      setError(errorMessage);
      return;
    }

    setSuccess(actionSuccess(result, successFallback) ?? successFallback);
    afterSuccess?.();
    router.refresh();
  };

  const handleMatchSetupSubmit = async (formData: FormData) => {
    await runAction(
      () =>
        saveHalisahaMatchSettingsAction({
          homeTeamName: String(formData.get("homeTeamName") ?? ""),
          awayTeamName: String(formData.get("awayTeamName") ?? ""),
          venueName: String(formData.get("venueName") ?? ""),
          homeFormation: String(formData.get("homeFormation") ?? "") as HalisahaFormation,
          awayFormation: String(formData.get("awayFormation") ?? "") as HalisahaFormation,
          kickoffDate: String(formData.get("kickoffDate") ?? ""),
          kickoffTime: String(formData.get("kickoffTime") ?? ""),
          matchDurationMinutes: Number(formData.get("matchDurationMinutes") ?? 60),
        }),
      "Match settings saved.",
    );
  };

  const handleAddRegisteredUser = async () => {
    if (!selectedUserId) {
      setError("Pick a registered user first.");
      return;
    }

    await runAction(
      () => addHalisahaRegisteredParticipantAction(selectedUserId),
      "Player added.",
      () => setSelectedUserId(""),
    );
  };

  const handleAddGuest = async () => {
    if (!guestName.trim()) {
      setError("Enter a guest name first.");
      return;
    }

    await runAction(
      () => addHalisahaGuestParticipantAction(guestName),
      "Guest added.",
      () => setGuestName(""),
    );
  };

  const handleAddGuestFromRegistry = async () => {
    if (!selectedGuestId) {
      setError("Pick a saved guest first.");
      return;
    }

    await runAction(
      () => addHalisahaGuestFromRegistryAction(selectedGuestId),
      "Guest added from saved list.",
      () => setSelectedGuestId(""),
    );
  };

  const handleDeactivateSavedGuest = async (guestId: string, displayName: string) => {
    if (
      !window.confirm(
        `Remove ${displayName} from the saved guest list? Past match records will stay unchanged.`,
      )
    ) {
      return;
    }

    await runAction(
      () => deactivateHalisahaGuestRegistryAction(guestId),
      "Guest removed from saved list.",
      () => {
        if (selectedGuestId === guestId) {
          setSelectedGuestId("");
        }
      },
    );
  };

  const handleClearParticipants = async () => {
    if (snapshot.participants.length === 0) {
      return;
    }

    const participantLabel =
      snapshot.participants.length === 1 ? "player/guest" : "players/guests";
    if (
      !window.confirm(
        `Remove all ${snapshot.participants.length} ${participantLabel} from this Halisaha match?`,
      )
    ) {
      return;
    }

    await runAction(
      () => clearHalisahaParticipantsAction(),
      "All participants removed.",
    );
  };

  const handleNewQuestionOptionLabelChange = (index: number, label: string) => {
    setNewQuestionOptionDrafts((current) =>
      current.map((item, currentIndex) =>
        currentIndex === index
          ? {
              ...item,
              label,
            }
          : item,
      ),
    );
  };

  const handleNewQuestionOptionTypeChange = (index: number, nextKind: EditableQuestionKind) => {
    const nextDraftsResult = updateOptionDraftKind(newQuestionOptionDrafts, index, nextKind);
    if (!nextDraftsResult.ok) {
      setError(nextDraftsResult.error);
      return;
    }

    setNewQuestionOptionDrafts(nextDraftsResult.drafts);
  };

  const handleAddNewQuestionOption = () => {
    setNewQuestionOptionDrafts((current) => [...current, { label: "", kind: "standard" }]);
  };

  const handleRemoveNewQuestionOption = (index: number) => {
    setNewQuestionOptionDrafts((current) => {
      if (current.length <= 1) {
        return current;
      }
      return current.filter((_, currentIndex) => currentIndex !== index);
    });
  };

  const handleCreateQuestion = async () => {
    await runAction(
      () =>
        createHalisahaQuestionAction({
          kind: newQuestionKind,
          prompt: newQuestionPrompt,
          points: Number(newQuestionPoints),
          options: newQuestionOptionDrafts,
        }),
      "Question created.",
      () => {
        setNewQuestionPrompt("");
        setNewQuestionPoints("1");
        setNewQuestionOptionDrafts(createDefaultOptionDrafts());
      },
    );
  };

  const handleScoreAnswers = async () => {
    await runAction(
      () => scoreHalisahaAnswersAction(),
      "Answers scored.",
    );
  };

  const handleResolveMvp = async () => {
    await runAction(
      () => resolveHalisahaMvpFromVotesAction(),
      "Community MVP resolved.",
    );
  };

  const handleToggleMatchVisibility = async () => {
    await runAction(
      () => setHalisahaMatchPublishedAction(!snapshot.match.isPublishedToUsers),
      snapshot.match.isPublishedToUsers
        ? "Halisaha match hidden from users."
        : "Halisaha match published to users.",
    );
  };

  return (
    <div className="mt-6 space-y-6">
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
          <button type="button" onClick={clearFeedback} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      ) : null}
      {success ? (
        <div
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
        >
          {success}
          <button type="button" onClick={clearFeedback} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Match setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={handleMatchSetupSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Home team name"
                name="homeTeamName"
                defaultValue={snapshot.match.homeTeamName}
                required
              />
              <Input
                label="Away team name"
                name="awayTeamName"
                defaultValue={snapshot.match.awayTeamName}
                required
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5 text-sm">
                <span className="font-medium text-nord-polar">Home team tactic</span>
                <select
                  name="homeFormation"
                  defaultValue={snapshot.match.homeFormation}
                  className={selectClassName}
                >
                  {HALISAHA_FORMATION_OPTIONS.map((formation) => (
                    <option key={formation.value} value={formation.value}>
                      {formation.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium text-nord-polar">Away team tactic</span>
                <select
                  name="awayFormation"
                  defaultValue={snapshot.match.awayFormation}
                  className={selectClassName}
                >
                  {HALISAHA_FORMATION_OPTIONS.map((formation) => (
                    <option key={formation.value} value={formation.value}>
                      {formation.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <Input
              label="Venue"
              name="venueName"
              defaultValue={snapshot.match.venueName}
              required
            />
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Kickoff date (Istanbul)"
                name="kickoffDate"
                type="date"
                defaultValue={snapshot.match.kickoffDateInput}
                required
              />
              <Input
                label="Kickoff time (Istanbul)"
                name="kickoffTime"
                type="time"
                defaultValue={snapshot.match.kickoffTimeInput}
                required
              />
            </div>
            <Input
              label="Match duration (minutes)"
              name="matchDurationMinutes"
              type="number"
              min={1}
              defaultValue={String(snapshot.match.matchDurationMinutes)}
              required
            />
            <div className="flex items-center justify-between gap-4 rounded-lg border border-nord-polarLighter/30 bg-nord-snow/45 px-4 py-3 text-sm text-nord-polarLight">
              <span>
                Timezone is fixed to Istanbul. If you change tactics, only incompatible lineup
                positions are cleared.
              </span>
              <Button type="submit" disabled={busy}>
                Save match settings
              </Button>
            </div>
          </form>
          <div
            className={`rounded-lg border px-4 py-4 ${
              snapshot.match.isPublishedToUsers
                ? "border-emerald-200 bg-emerald-50/70"
                : "border-amber-200 bg-amber-50/70"
            }`}
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm font-semibold text-nord-polar">
                  {snapshot.match.isPublishedToUsers
                    ? "Match is visible to users"
                    : "Match is hidden from users"}
                </div>
                <p className="mt-1 text-sm text-nord-polarLight">
                  Users cannot see the active Halisaha event until you confirm that the match
                  setup and question set are ready. New rounds start hidden by default.
                </p>
              </div>
              <Button
                variant={snapshot.match.isPublishedToUsers ? "ghost" : "secondary"}
                onClick={handleToggleMatchVisibility}
                disabled={busy}
              >
                {snapshot.match.isPublishedToUsers
                  ? "Hide from users"
                  : "Publish to users"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Players and guests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-3">
              <div className="rounded-lg border border-nord-polarLighter/30 bg-nord-snow/35 p-4">
                <h3 className="text-sm font-semibold text-nord-polar">
                  Add registered user
                </h3>
                <p className="mt-1 text-sm text-nord-polarLight">
                  Choose from approved site members who are not already in the squad.
                </p>
                <select
                  className={`${selectClassName} mt-3`}
                  value={selectedUserId}
                  onChange={(event) => setSelectedUserId(event.target.value)}
                  disabled={busy}
                >
                  <option value="">Select a user</option>
                  {availableUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} {user.surname} ({user.username})
                    </option>
                  ))}
                </select>
                <Button
                  className="mt-3"
                  variant="secondary"
                  onClick={handleAddRegisteredUser}
                  disabled={busy || availableUsers.length === 0}
                >
                  Add player
                </Button>
              </div>

              <div className="rounded-lg border border-nord-polarLighter/30 bg-nord-snow/35 p-4">
                <h3 className="text-sm font-semibold text-nord-polar">
                  Add saved guest
                </h3>
                <p className="mt-1 text-sm text-nord-polarLight">
                  Reuse a guest from the saved guest registry without typing the name again.
                </p>
                <select
                  className={`${selectClassName} mt-3`}
                  value={selectedGuestId}
                  onChange={(event) => setSelectedGuestId(event.target.value)}
                  disabled={busy}
                >
                  <option value="">Select a saved guest</option>
                  {availableGuestRegistry.map((guest) => (
                    <option key={guest.id} value={guest.id}>
                      {guest.displayName}
                    </option>
                  ))}
                </select>
                <Button
                  className="mt-3"
                  variant="secondary"
                  onClick={handleAddGuestFromRegistry}
                  disabled={busy || availableGuestRegistry.length === 0}
                >
                  Add saved guest
                </Button>
              </div>

              <div className="rounded-lg border border-nord-polarLighter/30 bg-nord-snow/35 p-4">
                <h3 className="text-sm font-semibold text-nord-polar">
                  Create or re-add guest
                </h3>
                <p className="mt-1 text-sm text-nord-polarLight">
                  New guest names are stored in the guest registry for future matches.
                </p>
                <Input
                  label="Guest display name"
                  value={guestName}
                  onChange={(event) => setGuestName(event.target.value)}
                  className="mt-3"
                  placeholder="e.g. Guest Player"
                />
                <Button
                  className="mt-3"
                  variant="secondary"
                  onClick={handleAddGuest}
                  disabled={busy}
                >
                  Add guest
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-nord-polarLighter/35">
              <div className="flex flex-col gap-3 border-b border-nord-polarLighter/35 bg-nord-snow/45 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-nord-polarLight">
                  Saved guest list:{" "}
                  <strong className="font-semibold text-nord-polar">
                    {snapshot.guestRegistry.length}
                  </strong>
                  . Removing a saved guest hides it from future selection but does not change past
                  match history.
                </p>
              </div>
              {snapshot.guestRegistry.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-nord-polarLight">
                  No saved guests yet.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-nord-polarLighter/50 bg-nord-snow/70 text-left text-nord-polarLight">
                      <th className="px-4 py-3 font-semibold">Guest</th>
                      <th className="px-4 py-3 font-semibold">Used in matches</th>
                      <th className="px-4 py-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.guestRegistry.map((guest) => (
                      <tr key={guest.id} className="border-b border-nord-polarLighter/30">
                        <td className="px-4 py-3 font-medium text-nord-polar">
                          {guest.displayName}
                        </td>
                        <td className="px-4 py-3 text-nord-polarLight">
                          {guest.linkedMatchCount}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              handleDeactivateSavedGuest(guest.id, guest.displayName)
                            }
                            disabled={busy}
                          >
                            Remove from list
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="overflow-x-auto rounded-lg border border-nord-polarLighter/35">
              <div className="flex flex-col gap-3 border-b border-nord-polarLighter/35 bg-nord-snow/45 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-nord-polarLight">
                  Current squad size:{" "}
                  <strong className="font-semibold text-nord-polar">
                    {snapshot.participants.length}
                  </strong>
                  . Use bulk clear when you want to reset the full list at once.
                </p>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={handleClearParticipants}
                  disabled={busy || snapshot.participants.length === 0}
                >
                  Remove all players & guests
                </Button>
              </div>
              {snapshot.participants.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-nord-polarLight">
                  No players have been assigned yet.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-nord-polarLighter/50 bg-nord-snow/70 text-left text-nord-polarLight">
                      <th className="px-4 py-3 font-semibold">Player</th>
                      <th className="px-4 py-3 font-semibold">Team</th>
                      <th className="px-4 py-3 font-semibold">Position</th>
                      <th className="px-4 py-3 font-semibold">Shown on Halisaha</th>
                      <th className="px-4 py-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.participants.map((participant) => (
                      <ParticipantAssignmentRow
                        key={participant.id}
                        participant={participant}
                        homeTeamName={snapshot.match.homeTeamName}
                        awayTeamName={snapshot.match.awayTeamName}
                        homeFormation={snapshot.match.homeFormation}
                        awayFormation={snapshot.match.awayFormation}
                        onError={setError}
                        onSuccess={setSuccess}
                      />
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resolution and winners</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-nord-polarLighter/30 bg-nord-snow/35 p-4">
              <div className="text-sm text-nord-polar">
                After the match, mark one correct option for each active question and
                then score all answers.
              </div>
              <div className="mt-3 space-y-2 text-xs text-nord-polarLight">
                <div>
                  Match phase:{" "}
                  <strong className="font-semibold text-nord-polar">
                    {snapshot.match.phase === "pre_match"
                      ? "Pre-match"
                      : snapshot.match.phase === "post_match_mvp_voting"
                        ? "Post-match MVP voting"
                        : "Results unlocked"}
                  </strong>
                </div>
                <div>
                  Match ends at{" "}
                  <strong className="font-semibold text-nord-polar">
                    {snapshot.match.matchEndLabel}
                  </strong>
                </div>
                <div>
                  MVP vote closes at{" "}
                  <strong className="font-semibold text-nord-polar">
                    {snapshot.match.mvpVoteEndsLabel}
                  </strong>
                </div>
                <div>
                  Community MVP:{" "}
                  <strong className="font-semibold text-nord-polar">
                    {snapshot.match.mvpResolvedParticipantName ?? "Pending"}
                  </strong>
                </div>
                <div>Total MVP votes received: {snapshot.match.mvpVoteCount}</div>
                <div>
                  {snapshot.match.answersResolvedAtLabel
                    ? `Last scored at ${snapshot.match.answersResolvedAtLabel}`
                    : "Answers have not been scored yet."}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <Button variant="secondary" onClick={handleResolveMvp} disabled={busy}>
                  Resolve MVP from votes
                </Button>
                <Button onClick={handleScoreAnswers} disabled={busy}>
                  Score all answers
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-nord-polarLighter/35">
              {snapshot.results.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-nord-polarLight">
                  No scored answers yet. Winners will appear here after scoring.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-nord-polarLighter/50 bg-nord-snow/70 text-left text-nord-polarLight">
                      <th className="px-4 py-3 font-semibold">Player</th>
                      <th className="px-4 py-3 font-semibold">Correct</th>
                      <th className="px-4 py-3 font-semibold">Answered</th>
                      <th className="px-4 py-3 font-semibold">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.results.map((row) => (
                      <tr key={row.userId} className="border-b border-nord-polarLighter/30">
                        <td className="px-4 py-3 font-medium text-nord-polar">
                          {row.name} {row.surname}
                        </td>
                        <td className="px-4 py-3 text-nord-polarLight">
                          {row.correctAnswers}
                        </td>
                        <td className="px-4 py-3 text-nord-polarLight">
                          {row.answeredQuestions}
                        </td>
                        <td className="px-4 py-3 font-semibold text-nord-frostDark">
                          {row.totalPoints}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Questions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border border-nord-polarLighter/30 bg-nord-snow/35 p-4">
            <h3 className="text-sm font-semibold text-nord-polar">
              Add a new Halisaha question
            </h3>
            <p className="mt-1 text-sm text-nord-polarLight">
              The winner strip remains fixed as question 1. Extra questions can be added here,
              and the existing non-winner questions can be reordered below.
            </p>
            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-nord-polar">
                  Question
                </label>
                <textarea
                  value={newQuestionPrompt}
                  onChange={(event) => setNewQuestionPrompt(event.target.value)}
                  rows={3}
                  className={textareaClassName}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-[10rem_minmax(0,1fr)]">
                <Input
                  label="Points"
                  type="number"
                  min={1}
                  value={newQuestionPoints}
                  onChange={(event) => setNewQuestionPoints(event.target.value)}
                />
                <div>
                  <div className="rounded-lg border border-nord-polarLighter/30 bg-nord-snow/45 px-4 py-3 text-sm text-nord-polarLight">
                    {newQuestionTypeBadges.length > 1
                      ? "This question will use mixed option types."
                      : `Current answer model: ${getManagedHalisahaQuestionKindLabel(newQuestionKind)}.`}
                  </div>
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium text-nord-polar">Options & type</label>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleAddNewQuestionOption}
                    disabled={busy}
                  >
                    Add option
                  </Button>
                </div>
                <div className="mb-2 flex flex-wrap gap-2">
                  {newQuestionTypeBadges.map((badge) => (
                    <span
                      key={`new-question-badge-${badge.kind}`}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${getQuestionTypeBadgeClass(badge.kind)}`}
                    >
                      {badge.label}
                    </span>
                  ))}
                </div>
                {newQuestionHasPlayerDraft ? (
                  <p className="mb-2 text-xs text-nord-polarLight">
                    Player picker rows sync from the current assigned squads automatically.
                  </p>
                ) : null}
                {newQuestionHasScoreDraft ? (
                  <p className="mb-2 text-xs text-nord-polarLight">
                    Two-number rows will each keep their own actual home and away result after the match.
                  </p>
                ) : null}
                {newQuestionHasNumberDraft ? (
                  <p className="mb-2 text-xs text-nord-polarLight">
                    Single-number rows will each keep their own actual value after the match.
                  </p>
                ) : null}
                <div className="space-y-2">
                  {newQuestionOptionDrafts.map((option, index) => (
                    <div
                      key={`new-option-${index}`}
                      className="grid gap-2 md:grid-cols-[minmax(0,1fr)_15rem_auto]"
                    >
                      {option.kind === "player_prediction" ? (
                        <div className="rounded-lg border border-dashed border-nord-polarLighter/40 bg-nord-snow/45 px-3 py-2 text-sm text-nord-polarLight">
                          {PLAYER_PICKER_OPTION_LABEL}. The selectable players will sync from the current squads.
                        </div>
                      ) : (
                        <input
                          value={option.label}
                          onChange={(event) =>
                            handleNewQuestionOptionLabelChange(index, event.target.value)
                          }
                          className={selectClassName}
                          placeholder={
                            option.kind === "standard"
                              ? `Option ${index + 1}`
                              : getManagedHalisahaQuestionOptionDefaultLabel(option.kind)
                          }
                          disabled={busy}
                        />
                      )}
                      <select
                        value={option.kind}
                        onChange={(event) =>
                          handleNewQuestionOptionTypeChange(
                            index,
                            event.target.value as EditableQuestionKind,
                          )
                        }
                        className={selectClassName}
                        disabled={busy}
                      >
                        <option value="standard">Standard multiple choice</option>
                        <option value="player_prediction">Player picker</option>
                        <option value="score_prediction">Two-number prediction</option>
                        <option value="number_prediction">Single-number prediction</option>
                      </select>
                      {newQuestionOptionDrafts.length > 1 ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveNewQuestionOption(index)}
                          disabled={busy}
                        >
                          Remove
                        </Button>
                      ) : (
                        <div />
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleCreateQuestion} disabled={busy}>
                  Create question
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {snapshot.questions.length === 0 ? (
              <div className="rounded-lg border border-dashed border-nord-polarLighter/35 px-4 py-10 text-center text-sm text-nord-polarLight">
                No questions yet. Create the first Halisaha question above.
              </div>
            ) : (
              snapshot.questions.map((question) => {
                const reorderIndex = reorderableQuestionIds.indexOf(question.id);
                return (
                <QuestionEditorCard
                  key={question.id}
                  question={question}
                  canMoveUp={reorderIndex > 0}
                  canMoveDown={
                    reorderIndex !== -1 && reorderIndex < reorderableQuestionIds.length - 1
                  }
                  onError={setError}
                  onSuccess={setSuccess}
                />
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
