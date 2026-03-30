"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { HalisahaPositionKey, HalisahaTeamSide } from "@prisma/client";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@/components/ui";
import {
  addHalisahaGuestParticipantAction,
  addHalisahaRegisteredParticipantAction,
  createHalisahaQuestionAction,
  deleteHalisahaQuestionAction,
  removeHalisahaParticipantAction,
  resolveHalisahaMvpFromVotesAction,
  saveHalisahaMatchSettingsAction,
  scoreHalisahaAnswersAction,
  setHalisahaScoreQuestionResultAction,
  setHalisahaQuestionCorrectOptionAction,
  updateHalisahaParticipantAssignmentAction,
  updateHalisahaQuestionAction,
  type HalisahaAdminActionState,
} from "./actions";
import type {
  HalisahaAdminParticipantRow,
  HalisahaAdminQuestionRow,
  HalisahaAdminSnapshot,
} from "@/lib/halisaha/server";
import {
  HALISAHA_POSITION_SLOTS,
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
const CUSTOM_SCORE_OPTION_LABEL = "Your exact score";

type EditableQuestionKind = "standard" | "score_prediction";

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
  onError,
  onSuccess,
}: {
  participant: HalisahaAdminParticipantRow;
  homeTeamName: string;
  awayTeamName: string;
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
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setTeamSide(participant.teamSide ?? "");
    setPositionKey(participant.positionKey ?? "");
  }, [participant.positionKey, participant.teamSide]);

  const teamOptions = HALISAHA_TEAM_SIDE_OPTIONS.map((option) => ({
    ...option,
    label: option.value === "home" ? homeTeamName : awayTeamName,
  }));

  const handleSave = async () => {
    setBusy(true);
    const result = await updateHalisahaParticipantAssignmentAction(participant.id, {
      teamSide: teamSide || null,
      positionKey: positionKey || null,
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
    if (!window.confirm(`Remove ${participant.displayName} from this Halisaha match?`)) {
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
    <tr className="border-b border-nord-polarLighter/30 align-top">
      <td className="px-4 py-3">
        <div className="font-medium text-nord-polar">{participant.displayName}</div>
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
          <option value="">No position</option>
          {HALISAHA_POSITION_SLOTS.map((slot) => (
            <option key={slot.key} value={slot.key}>
              {slot.label}
            </option>
          ))}
        </select>
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
  onError,
  onSuccess,
}: {
  question: HalisahaAdminQuestionRow;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}) {
  const router = useRouter();
  const isWinnerQuestion = question.kind === "winner";
  const isMvpPredictionQuestion = question.kind === "mvp_prediction";
  const isScoreQuestion = question.kind === "score_prediction";
  const isPinnedQuestion = isWinnerQuestion || isMvpPredictionQuestion;
  const [prompt, setPrompt] = useState(question.prompt);
  const [points, setPoints] = useState(String(question.points));
  const [options, setOptions] = useState(
    question.kind === "score_prediction"
      ? question.options
          .filter((option) => option.kind === "standard")
          .map((option) => option.label)
      : question.options.map((option) => option.label),
  );
  const [isActive, setIsActive] = useState(question.isActive);
  const [includeCustomScoreOption, setIncludeCustomScoreOption] = useState(
    question.options.some((option) => option.kind === "custom_score"),
  );
  const [scoreHomeResult, setScoreHomeResult] = useState(
    question.scoreHomeResult?.toString() ?? "",
  );
  const [scoreAwayResult, setScoreAwayResult] = useState(
    question.scoreAwayResult?.toString() ?? "",
  );
  const [correctOptionId, setCorrectOptionId] = useState<string | "">(
    question.options.find((option) => option.isCorrect)?.id ?? "",
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPrompt(question.prompt);
    setPoints(String(question.points));
    setOptions(
      question.kind === "score_prediction"
        ? question.options
            .filter((option) => option.kind === "standard")
            .map((option) => option.label)
        : question.options.map((option) => option.label),
    );
    setIsActive(question.isActive);
    setIncludeCustomScoreOption(
      question.options.some((option) => option.kind === "custom_score"),
    );
    setScoreHomeResult(question.scoreHomeResult?.toString() ?? "");
    setScoreAwayResult(question.scoreAwayResult?.toString() ?? "");
    setCorrectOptionId(
      question.options.find((option) => option.isCorrect)?.id ?? "",
    );
  }, [question]);

  const handleSave = async () => {
    setBusy(true);
    const result = await updateHalisahaQuestionAction(question.id, {
      prompt,
      points: Number(points),
      options,
      isActive,
      includeCustomScoreOption,
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

  const handleSaveActualScore = async (clear = false) => {
    setBusy(true);
    const result = await setHalisahaScoreQuestionResultAction(
      question.id,
      clear
        ? null
        : {
            home: scoreHomeResult.trim() === "" ? null : Number(scoreHomeResult),
            away: scoreAwayResult.trim() === "" ? null : Number(scoreAwayResult),
          },
    );
    setBusy(false);

    const error = actionError(result);
    if (error) {
      onError(error);
      return;
    }

    onSuccess(actionSuccess(result, "Actual score saved.") ?? "Actual score saved.");
    router.refresh();
  };

  const addOption = () => {
    setOptions((current) => [...current, ""]);
  };

  const removeOption = (index: number) => {
    setOptions((current) => current.filter((_, currentIndex) => currentIndex !== index));
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
                Pinned MVP pick
              </span>
            ) : isScoreQuestion ? (
              <span className="rounded-full border border-nord-auroraGreen/25 bg-nord-auroraGreen/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-nord-auroraGreen">
                Exact score
              </span>
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
                ? "Pinned MVP prompt"
                : isScoreQuestion
                  ? "Score question"
                  : "Question"}
          </label>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={3}
            className={textareaClassName}
            disabled={busy || isMvpPredictionQuestion}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-[10rem_minmax(0,1fr)]">
          <Input
            label="Points"
            type="number"
            min={1}
            value={points}
            onChange={(event) => setPoints(event.target.value)}
            disabled={busy}
          />
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-nord-polar">Options</label>
                {!isPinnedQuestion ? (
                  <Button size="sm" variant="ghost" onClick={addOption} disabled={busy}>
                    Add option
                  </Button>
                ) : null}
            </div>
              {isWinnerQuestion ? (
                <p className="mb-2 text-xs text-nord-polarLight">
                  Winner strip team labels stay synced with the home and away team names
                  from match setup.
                </p>
              ) : isMvpPredictionQuestion ? (
                <p className="mb-2 text-xs text-nord-polarLight">
                  This pinned MVP prediction is synced from the current squad and always stays
                  active for users.
                </p>
              ) : isScoreQuestion ? (
                <div className="mb-3 space-y-2">
                  <p className="text-xs text-nord-polarLight">
                    Add fixed score choices such as 6-4. Users can also get one editable custom
                    score choice if you keep it enabled below.
                  </p>
                  <label className="inline-flex items-center gap-2 text-xs text-nord-polarLight">
                    <input
                      type="checkbox"
                      checked={includeCustomScoreOption}
                      onChange={(event) =>
                        setIncludeCustomScoreOption(event.target.checked)
                      }
                      className="rounded border-nord-polarLighter"
                      disabled={busy}
                    />
                    Include user-editable custom score option
                  </label>
                </div>
              ) : null}
              <div className="space-y-2">
                {options.map((option, index) => (
                  <div key={`${question.id}-option-${index}`} className="flex gap-2">
                    <input
                      value={option}
                      onChange={(event) =>
                        setOptions((current) =>
                          current.map((item, currentIndex) =>
                            currentIndex === index ? event.target.value : item,
                          ),
                        )
                      }
                      className={selectClassName}
                      disabled={busy || isPinnedQuestion}
                      placeholder={isScoreQuestion ? "e.g. 6-4" : undefined}
                    />
                    {!isPinnedQuestion &&
                    options.length > (isScoreQuestion ? 1 : 2) ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeOption(index)}
                        disabled={busy}
                      >
                        Remove
                      </Button>
                    ) : null}
                  </div>
                ))}
                {isScoreQuestion && includeCustomScoreOption ? (
                  <div className="rounded-lg border border-dashed border-nord-polarLighter/40 bg-nord-snow/45 px-3 py-2 text-xs text-nord-polarLight">
                    Custom score choice preview: <strong>{CUSTOM_SCORE_OPTION_LABEL}</strong>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

        {isScoreQuestion ? (
          <div className="rounded-lg border border-nord-polarLighter/30 bg-nord-snow/45 p-3">
            <div className="mb-2 text-sm font-medium text-nord-polar">
              Actual score after the match
            </div>
            <p className="mb-3 text-xs text-nord-polarLight">
              Fixed score options that exactly match the real result will be marked correct. The
              custom score option also scores if the user-entered result matches these values
              exactly.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                label="Actual home score"
                type="number"
                min={0}
                value={scoreHomeResult}
                onChange={(event) => setScoreHomeResult(event.target.value)}
                disabled={busy}
              />
              <Input
                label="Actual away score"
                type="number"
                min={0}
                value={scoreAwayResult}
                onChange={(event) => setScoreAwayResult(event.target.value)}
                disabled={busy}
              />
            </div>
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleSaveActualScore(true)}
                disabled={busy}
              >
                Clear actual score
              </Button>
              <Button size="sm" variant="secondary" onClick={() => handleSaveActualScore()} disabled={busy}>
                Save actual score
              </Button>
            </div>
          </div>
        ) : isMvpPredictionQuestion ? (
          <div className="rounded-lg border border-nord-polarLighter/30 bg-nord-snow/45 p-3 text-sm text-nord-polarLight">
            <div className="font-medium text-nord-polar">Community MVP resolution</div>
            <div className="mt-2">
              {question.options.find((option) => option.isCorrect)?.label ??
                "Pending. The final MVP will be resolved from the post-match MVP vote window."}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-nord-polarLighter/30 bg-nord-snow/45 p-3">
            <div className="mb-2 text-sm font-medium text-nord-polar">
              Correct option after the match
            </div>
            <div className="space-y-2">
              {question.options.map((option) => (
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
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={handleSave} disabled={busy}>
            {isWinnerQuestion
              ? "Save winner question"
              : isMvpPredictionQuestion
                ? "Save MVP question"
                : isScoreQuestion
                  ? "Save score question"
                  : "Save question"}
          </Button>
          {!isScoreQuestion && !isMvpPredictionQuestion ? (
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
  const [guestName, setGuestName] = useState("");
  const [newQuestionKind, setNewQuestionKind] =
    useState<EditableQuestionKind>("standard");
  const [newQuestionPrompt, setNewQuestionPrompt] = useState("");
  const [newQuestionPoints, setNewQuestionPoints] = useState("1");
  const [newQuestionOptions, setNewQuestionOptions] = useState<string[]>([
    "",
    "",
    "",
    "",
  ]);
  const [newQuestionIncludeCustomScoreOption, setNewQuestionIncludeCustomScoreOption] =
    useState(true);

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

  const handleCreateQuestion = async () => {
    await runAction(
      () =>
        createHalisahaQuestionAction({
          kind: newQuestionKind,
          prompt: newQuestionPrompt,
          points: Number(newQuestionPoints),
          options: newQuestionOptions,
          includeCustomScoreOption: newQuestionIncludeCustomScoreOption,
        }),
      "Question created.",
      () => {
        setNewQuestionKind("standard");
        setNewQuestionPrompt("");
        setNewQuestionPoints("1");
        setNewQuestionOptions(["", "", "", ""]);
        setNewQuestionIncludeCustomScoreOption(true);
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
              <span>Timezone is fixed to Istanbul for all public countdowns.</span>
              <Button type="submit" disabled={busy}>
                Save match settings
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Players and guests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
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
                <h3 className="text-sm font-semibold text-nord-polar">Add guest</h3>
                <p className="mt-1 text-sm text-nord-polarLight">
                  Add one-off guest players who do not have site accounts.
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
                    {new Date(snapshot.match.matchEndAtIso).toLocaleString("tr-TR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </strong>
                </div>
                <div>
                  MVP vote closes at{" "}
                  <strong className="font-semibold text-nord-polar">
                    {new Date(snapshot.match.mvpVoteEndsAtIso).toLocaleString("tr-TR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
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
                  {snapshot.match.answersResolvedAtIso
                    ? `Last scored at ${new Date(snapshot.match.answersResolvedAtIso).toLocaleString("tr-TR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}`
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
              The pinned winner strip and pinned MVP prediction question are managed
              automatically. Add extra match questions here, including exact score
              questions with a custom score option.
            </p>
            <div className="mt-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-nord-polar">
                    Question type
                  </label>
                  <select
                    value={newQuestionKind}
                    onChange={(event) =>
                      setNewQuestionKind(event.target.value as EditableQuestionKind)
                    }
                    className={selectClassName}
                  >
                    <option value="standard">Standard multiple choice</option>
                    <option value="score_prediction">Exact score prediction</option>
                  </select>
                </div>
                {newQuestionKind === "score_prediction" ? (
                  <div className="flex items-end">
                    <label className="inline-flex items-center gap-2 text-sm text-nord-polarLight">
                      <input
                        type="checkbox"
                        checked={newQuestionIncludeCustomScoreOption}
                        onChange={(event) =>
                          setNewQuestionIncludeCustomScoreOption(event.target.checked)
                        }
                        className="rounded border-nord-polarLighter"
                      />
                      Include user-editable custom score option
                    </label>
                  </div>
                ) : null}
              </div>
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
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-sm font-medium text-nord-polar">
                      Options
                    </label>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setNewQuestionOptions((current) => [...current, ""])
                      }
                    >
                      Add option
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {newQuestionOptions.map((option, index) => (
                      <div key={`new-option-${index}`} className="flex gap-2">
                        <input
                          value={option}
                          onChange={(event) =>
                            setNewQuestionOptions((current) =>
                              current.map((item, currentIndex) =>
                                currentIndex === index ? event.target.value : item,
                              ),
                            )
                          }
                          className={selectClassName}
                          placeholder={
                            newQuestionKind === "score_prediction" ? "e.g. 6-4" : undefined
                          }
                        />
                        {newQuestionOptions.length > (newQuestionKind === "score_prediction" ? 1 : 2) ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setNewQuestionOptions((current) =>
                                current.filter((_, currentIndex) => currentIndex !== index),
                              )
                            }
                          >
                            Remove
                          </Button>
                        ) : null}
                      </div>
                    ))}
                  </div>
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
              snapshot.questions.map((question) => (
                <QuestionEditorCard
                  key={question.id}
                  question={question}
                  onError={setError}
                  onSuccess={setSuccess}
                />
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
