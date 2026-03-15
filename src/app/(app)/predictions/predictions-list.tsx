"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Modal } from "@/components/ui";
import { CompetitionTabsClient, UCL_ID, OTHER_ID } from "@/components/competition-tabs";
import { PredictionPickDisplay } from "@/components/prediction-pick-display";
import { unfinalizePredictionAction, resetAllPredictionsAction } from "./actions";

function displayPick(value: string): string {
  const map: Record<string, string> = { ONE: "1", X: "X", TWO: "2" };
  return map[value] ?? value;
}

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "finalized", label: "Finalized" },
  { value: "draft", label: "Draft" },
  { value: "completed", label: "Match completed" },
  { value: "pending", label: "Match pending" },
] as const;

const OUTCOME_FILTERS = [
  { value: "all", label: "All" },
  { value: "correct", label: "Correct" },
  { value: "incorrect", label: "Incorrect" },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]["value"];
type OutcomeFilter = (typeof OUTCOME_FILTERS)[number]["value"];

export type PredictionRow = {
  id: string;
  matchId: string;
  selectedPrediction: string;
  isFinal: boolean;
  finalizedAt: string | null;
  match: {
    id: string;
    competitionId: string | null;
    matchDatetime: string;
    stage: string;
    homeTeamName: string;
    awayTeamName: string;
    officialResultType: string | null;
  };
};

export function PredictionsList({
  predictions,
  isAdmin = false,
}: {
  predictions: PredictionRow[];
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const [competitionId, setCompetitionId] = useState<string>(UCL_ID);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>("all");
  const [actionError, setActionError] = useState<string | null>(null);
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const [resetModal, setResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);

  const predictionsByCompetition = useMemo(() => {
    if (competitionId === UCL_ID) {
      return predictions.filter((p) => p.match.competitionId === UCL_ID || p.match.competitionId == null);
    }
    return predictions.filter((p) => p.match.competitionId != null && p.match.competitionId !== UCL_ID);
  }, [predictions, competitionId]);

  const filteredPredictions = useMemo(() => {
    return predictionsByCompetition.filter((p) => {
      const matchCompleted = p.match.officialResultType !== null;
      const result = p.match.officialResultType;
      const correct = matchCompleted && p.isFinal && result !== null && p.selectedPrediction === result;

      switch (statusFilter) {
        case "finalized":
          if (!p.isFinal) return false;
          break;
        case "draft":
          if (p.isFinal) return false;
          break;
        case "completed":
          if (!matchCompleted) return false;
          break;
        case "pending":
          if (matchCompleted) return false;
          break;
        default:
          break;
      }

      switch (outcomeFilter) {
        case "correct":
          if (!correct) return false;
          break;
        case "incorrect":
          if (!matchCompleted || !p.isFinal || result === null || correct) return false;
          break;
        default:
          break;
      }

      return true;
    });
  }, [predictionsByCompetition, statusFilter, outcomeFilter]);

  const canUnfinalizeCount = predictionsByCompetition.filter(
    (p) => p.isFinal && p.match.officialResultType === null
  ).length;

  const handleUnfinalize = async (matchId: string) => {
    setActionError(null);
    setUndoingId(matchId);
    const result = await unfinalizePredictionAction(matchId);
    setUndoingId(null);
    if (result.ok) router.refresh();
    else setActionError(result.error);
  };

  const handleResetAll = async () => {
    setActionError(null);
    setResetting(true);
    const result = await resetAllPredictionsAction();
    setResetting(false);
    setResetModal(false);
    if (result.ok) {
      router.refresh();
      return;
    }
    setActionError(result.error);
  };

  return (
    <div className="mt-6 overflow-x-auto">
      {actionError && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {actionError}
        </div>
      )}

      <div className="mb-4">
        <CompetitionTabsClient currentCompetitionId={competitionId} onSelect={setCompetitionId} />
      </div>

      {predictions.length === 0 ? (
        <p className="text-nord-polarLight text-sm">
          You have not made any predictions yet.{" "}
          <Link href="/schedule" className="text-nord-frostDark font-medium hover:underline">
            Go to Schedule
          </Link>{" "}
          to predict.
        </p>
      ) : (
        <>
          {predictionsByCompetition.length === 0 ? (
            <p className="text-nord-polarLight text-sm">
              No predictions in this competition. Switch tab or{" "}
              <Link href="/schedule" className="text-nord-frostDark font-medium hover:underline">
                go to Schedule
              </Link>{" "}
              to predict.
            </p>
          ) : (
          <>
          {isAdmin && canUnfinalizeCount > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setResetModal(true)}
              >
                Reset all my predictions
              </Button>
              <span className="text-sm text-nord-polarLight">
                Unfinalizes {canUnfinalizeCount} prediction(s) for matches without a result. You can then change or re-finalize them.
              </span>
            </div>
          )}

          <div className="mb-4 flex flex-wrap items-center gap-4 border-b border-nord-polarLighter/50 pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-nord-polar">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="rounded-lg border border-nord-polarLighter bg-white px-3 py-2 text-sm text-nord-polar focus:border-nord-frostDark focus:outline-none focus:ring-1 focus:ring-nord-frostDark"
              >
                {STATUS_FILTERS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-nord-polar">Outcome:</span>
              <select
                value={outcomeFilter}
                onChange={(e) => setOutcomeFilter(e.target.value as OutcomeFilter)}
                className="rounded-lg border border-nord-polarLighter bg-white px-3 py-2 text-sm text-nord-polar focus:border-nord-frostDark focus:outline-none focus:ring-1 focus:ring-nord-frostDark"
              >
                {OUTCOME_FILTERS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <span className="text-sm text-nord-polarLight">
              Showing {filteredPredictions.length} of {predictionsByCompetition.length}
            </span>
          </div>

          <ul className="space-y-3">
            {filteredPredictions.length === 0 ? (
              <li className="py-6 text-center text-sm text-nord-polarLight">
                No predictions match the selected filter.
              </li>
            ) : (
              filteredPredictions.map((p) => {
              const m = p.match;
              const result = m.officialResultType;
              const matchFinished = new Date(m.matchDatetime) < new Date();
              const correct =
                result != null && p.isFinal && p.selectedPrediction === result;
              const canUnfinalize = p.isFinal && result === null;

              return (
                <li key={p.id} className="rounded-xl border border-nord-polarLighter/40 bg-white/80 py-4 px-4 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-nord-polarLight tabular-nums">
                      {new Date(m.matchDatetime).toLocaleString("en-GB", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </span>
                    <span className="font-medium text-nord-polar">
                      {m.homeTeamName} vs {m.awayTeamName}
                    </span>
                  </div>
                  <div className="mt-3">
                    <PredictionPickDisplay
                      pick={p.selectedPrediction}
                      finalizedAt={p.finalizedAt}
                      isFinal={p.isFinal}
                      compact
                      onUndo={isAdmin && canUnfinalize ? () => handleUnfinalize(m.matchId) : undefined}
                      undoLoading={undoingId === m.matchId}
                    />
                  </div>
                  {matchFinished && (
                    <div className="mt-3 pt-3 border-t border-nord-polarLighter/30 flex flex-wrap items-center gap-2 text-sm">
                      {result != null ? (
                        <>
                          <span className="text-nord-polar">
                            Result: {displayPick(result)}
                          </span>
                          {p.isFinal &&
                            (correct ? (
                              <span className="font-medium text-emerald-600">Correct</span>
                            ) : (
                              <span className="font-medium text-rose-600">Incorrect</span>
                            ))}
                        </>
                      ) : (
                        <span className="text-nord-polarLight italic text-xs">
                          Result: Awaiting sync (run &quot;Recalculate scores&quot; in admin if the match has finished)
                        </span>
                      )}
                    </div>
                  )}
                </li>
              );
            })
            )}
          </ul>
          <Modal
            open={resetModal}
            onClose={() => !resetting && setResetModal(false)}
            title="Reset all predictions?"
            confirmLabel="Yes, reset all"
            cancelLabel="Cancel"
            onConfirm={handleResetAll}
            loading={resetting}
            variant="danger"
          >
            <p>
              This will unfinalize all your predictions for matches that do not have a result yet.
              You can then change your picks and finalize again. Predictions for matches that already have a result will not be changed.
            </p>
          </Modal>
          </>
          )}
        </>
      )}
    </div>
  );
}
