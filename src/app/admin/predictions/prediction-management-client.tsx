"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui";
import {
  setPredictionPointsAction,
  adminResetUserPredictionAction,
  adminResetUserUpcomingPredictionsAction,
  adminSetPredictionForUserAction,
} from "./actions";

export type PredictionRow = {
  id: string;
  userId: string;
  matchId: string;
  selectedPrediction: string;
  isFinal: boolean;
  finalizedAt: string | null;
  awardedPoints: number;
  match: {
    id: string;
    competitionId: string | null;
    matchDatetime: string;
    homeTeamName: string;
    awayTeamName: string;
    officialResultType: string | null;
  };
  user: {
    id: string;
    name: string;
    surname: string;
  };
};

export type MatchOption = { id: string; competitionId: string | null; label: string };
export type UserOption = { id: string; label: string };

function displayPick(v: string): string {
  const map: Record<string, string> = { ONE: "1", X: "X", TWO: "2" };
  return map[v] ?? v;
}

function displayResult(v: string | null): string {
  if (!v) return "–";
  return displayPick(v);
}

export function PredictionManagementClient({
  predictions,
  matchOptions,
  userOptions,
}: {
  predictions: PredictionRow[];
  matchOptions: MatchOption[];
  userOptions: UserOption[];
}) {
  const router = useRouter();
  const [leagueFilter, setLeagueFilter] = useState<string>(""); // "" = all, "CL" = UCL, "other" = Diğer
  const [matchFilter, setMatchFilter] = useState<string>("");
  const [userFilter, setUserFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"all" | "finalized" | "draft">("all");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);

  const [impUserId, setImpUserId] = useState("");
  const [impMatchId, setImpMatchId] = useState("");
  const [impPick, setImpPick] = useState<"1" | "X" | "2">("1");
  const [impFinalize, setImpFinalize] = useState(true);
  const [impBusy, setImpBusy] = useState(false);

  const filtered = useMemo(() => {
    return predictions.filter((p) => {
      if (leagueFilter === "CL" && p.match.competitionId !== "CL" && p.match.competitionId != null) return false;
      if (leagueFilter === "other" && (p.match.competitionId === "CL" || p.match.competitionId == null)) return false;
      if (matchFilter && p.matchId !== matchFilter) return false;
      if (userFilter && p.userId !== userFilter) return false;
      if (statusFilter === "finalized" && !p.isFinal) return false;
      if (statusFilter === "draft" && p.isFinal) return false;
      return true;
    });
  }, [predictions, leagueFilter, matchFilter, userFilter, statusFilter]);

  const matchOptionsFilteredByLeague = useMemo(() => {
    if (!leagueFilter) return matchOptions;
    if (leagueFilter === "CL") return matchOptions.filter((m) => m.competitionId === "CL" || m.competitionId == null);
    return matchOptions.filter((m) => m.competitionId != null && m.competitionId !== "CL");
  }, [matchOptions, leagueFilter]);

  const runSetPoints = async (predictionId: string, points: 0 | 1) => {
    setBusyId(predictionId);
    setError(null);
    setSuccess(null);
    const result = await setPredictionPointsAction(predictionId, points);
    setBusyId(null);
    if (result.ok) {
      setSuccess(result.message ?? "Done.");
      router.refresh();
    } else setError(result.error);
  };

  const runResetOne = async (userId: string, matchId: string) => {
    const id = `${userId}-${matchId}`;
    setBusyId(id);
    setError(null);
    setSuccess(null);
    const result = await adminResetUserPredictionAction(userId, matchId);
    setBusyId(null);
    if (result.ok) {
      setSuccess(result.message ?? "Reset.");
      router.refresh();
    } else setError(result.error);
  };

  const runImpersonatePrediction = async () => {
    if (!impUserId || !impMatchId) {
      setError("Select both a user and a match.");
      return;
    }
    setImpBusy(true);
    setError(null);
    setSuccess(null);
    const result = await adminSetPredictionForUserAction(
      impUserId,
      impMatchId,
      impPick,
      impFinalize
    );
    setImpBusy(false);
    if (result.ok) {
      setSuccess(result.message ?? "Saved.");
      router.refresh();
    } else setError(result.error);
  };

  const runResetAllUpcomingForUser = async (userId: string) => {
    setResettingUserId(userId);
    setError(null);
    setSuccess(null);
    const result = await adminResetUserUpcomingPredictionsAction(userId);
    setResettingUserId(null);
    if (result.ok) {
      setSuccess(result.message ?? "Reset.");
      router.refresh();
    } else setError(result.error);
  };

  return (
    <div className="mt-6">
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
          <button type="button" onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {success}
          <button type="button" onClick={() => setSuccess(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      <section className="mb-6 rounded-2xl border border-nord-frostDark/18 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(241,245,252,0.92))] p-4 shadow-[0_16px_40px_rgba(46,52,64,0.06)] sm:p-5">
        <h2 className="text-sm font-semibold text-nord-polar">Set prediction (any user, any match)</h2>
        <p className="mt-1 text-xs leading-relaxed text-nord-polarLight">
          Match lock time does not apply. Pick a user and match, choose <strong className="text-nord-polar">1</strong>,{" "}
          <strong className="text-nord-polar">X</strong>, or <strong className="text-nord-polar">2</strong>, then save as
          draft or finalize. If the match already has an official result and you finalize, points are recalculated for that
          fixture and the leaderboard is refreshed.
        </p>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="flex min-w-[200px] flex-1 flex-col gap-1">
            <label className="text-xs font-medium text-nord-polar">User</label>
            <select
              value={impUserId}
              onChange={(e) => setImpUserId(e.target.value)}
              className="rounded-lg border border-nord-polarLighter bg-white px-3 py-2 text-sm text-nord-polar"
            >
              <option value="">Select user…</option>
              {userOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex min-w-[240px] flex-[1.2] flex-col gap-1">
            <label className="text-xs font-medium text-nord-polar">Match</label>
            <select
              value={impMatchId}
              onChange={(e) => setImpMatchId(e.target.value)}
              className="rounded-lg border border-nord-polarLighter bg-white px-3 py-2 text-sm text-nord-polar"
            >
              <option value="">Select match…</option>
              {matchOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-nord-polar">Pick</span>
            <div className="flex flex-wrap gap-3">
              {(["1", "X", "2"] as const).map((v) => (
                <label key={v} className="flex cursor-pointer items-center gap-2 text-sm text-nord-polar">
                  <input
                    type="radio"
                    name="admin-pick"
                    checked={impPick === v}
                    onChange={() => setImpPick(v)}
                    className="h-4 w-4 accent-nord-frostDark"
                  />
                  <span className="font-semibold">{v}</span>
                </label>
              ))}
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-nord-polar">
            <input
              type="checkbox"
              checked={impFinalize}
              onChange={(e) => setImpFinalize(e.target.checked)}
              className="h-4 w-4 rounded border-nord-polarLighter accent-nord-frostDark"
            />
            Finalize (lock for this user)
          </label>
          <Button type="button" variant="primary" disabled={impBusy} onClick={() => void runImpersonatePrediction()}>
            {impBusy ? "Saving…" : "Apply prediction"}
          </Button>
        </div>
      </section>

      <div className="mb-4 flex flex-wrap items-center gap-4 border-b border-nord-polarLighter/50 pb-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-nord-polar">League:</label>
          <select
            value={leagueFilter}
            onChange={(e) => setLeagueFilter(e.target.value)}
            className="rounded-lg border border-nord-polarLighter bg-white px-3 py-2 text-sm text-nord-polar"
          >
            <option value="">All leagues</option>
            <option value="CL">UEFA Champions League</option>
            <option value="other">Diğer</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-nord-polar">Match:</label>
          <select
            value={matchFilter}
            onChange={(e) => setMatchFilter(e.target.value)}
            className="rounded-lg border border-nord-polarLighter bg-white px-3 py-2 text-sm text-nord-polar min-w-[200px]"
          >
            <option value="">All matches</option>
            {matchOptionsFilteredByLeague.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-nord-polar">User:</label>
          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="rounded-lg border border-nord-polarLighter bg-white px-3 py-2 text-sm text-nord-polar min-w-[180px]"
          >
            <option value="">All users</option>
            {userOptions.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-nord-polar">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | "finalized" | "draft")}
            className="rounded-lg border border-nord-polarLighter bg-white px-3 py-2 text-sm text-nord-polar"
          >
            <option value="all">All</option>
            <option value="finalized">Finalized</option>
            <option value="draft">Draft</option>
          </select>
        </div>
        <span className="text-sm text-nord-polarLight">
          Showing {filtered.length} of {predictions.length}
        </span>
        {userFilter && (
          <Button
            variant="secondary"
            size="sm"
            disabled={!!resettingUserId}
            onClick={() => runResetAllUpcomingForUser(userFilter)}
          >
            {resettingUserId === userFilter ? "Resetting…" : "Reset all upcoming for this user"}
          </Button>
        )}
        <Link
          href="/admin/scoring"
          className="text-sm font-medium text-nord-frostDark hover:underline ml-auto"
        >
          Recalculate all scores & leaderboard →
        </Link>
      </div>

      <div className="overflow-x-auto rounded-lg border border-nord-polarLighter/50">
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-nord-polarLight">
            No predictions match the selected filters.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-nord-polarLighter bg-nord-snow/80 text-left text-nord-polarLight">
                <th className="px-4 py-3 font-semibold">Match</th>
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">Pick</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Finalized</th>
                <th className="px-4 py-3 font-semibold">Result</th>
                <th className="px-4 py-3 font-semibold">Points</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const isBusy =
                  busyId === p.id || busyId === `${p.userId}-${p.matchId}`;
                return (
                  <tr key={p.id} className="border-b border-nord-polarLighter/30 hover:bg-nord-snow/50">
                    <td className="px-4 py-3">
                      <span className="text-nord-polarLight text-xs block">
                        {new Date(p.match.matchDatetime).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                      <span className="text-nord-polar font-medium">
                        {p.match.homeTeamName} vs {p.match.awayTeamName}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-nord-polar">
                      {p.user.name} {p.user.surname}
                    </td>
                    <td className="px-4 py-3 font-medium text-nord-polar">
                      {displayPick(p.selectedPrediction)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${p.isFinal ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                        {p.isFinal ? "Finalized" : "Draft"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-nord-polarLight">
                      {p.finalizedAt
                        ? new Date(p.finalizedAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })
                        : "–"}
                    </td>
                    <td className="px-4 py-3 text-nord-polar">
                      {displayResult(p.match.officialResultType)}
                    </td>
                    <td className="px-4 py-3 font-medium text-nord-polar">
                      {p.isFinal ? p.awardedPoints : "–"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1 flex-wrap">
                        {p.isFinal && (
                          <>
                            <Button
                              size="sm"
                              variant={p.awardedPoints === 0 ? "primary" : "secondary"}
                              onClick={() => runSetPoints(p.id, 0)}
                              disabled={isBusy}
                            >
                              Set 0
                            </Button>
                            <Button
                              size="sm"
                              variant={p.awardedPoints === 1 ? "primary" : "secondary"}
                              onClick={() => runSetPoints(p.id, 1)}
                              disabled={isBusy}
                            >
                              Set 1
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => runResetOne(p.userId, p.matchId)}
                              disabled={isBusy}
                            >
                              {busyId === `${p.userId}-${p.matchId}` ? "…" : "Reset"}
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
