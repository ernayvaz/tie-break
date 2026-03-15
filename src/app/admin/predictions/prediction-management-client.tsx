"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui";
import { setPredictionPointsAction } from "./actions";

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
                const busy = busyId === p.id;
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
                      {p.isFinal && (
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant={p.awardedPoints === 0 ? "primary" : "secondary"}
                            onClick={() => runSetPoints(p.id, 0)}
                            disabled={busy}
                          >
                            Set 0
                          </Button>
                          <Button
                            size="sm"
                            variant={p.awardedPoints === 1 ? "primary" : "secondary"}
                            onClick={() => runSetPoints(p.id, 1)}
                            disabled={busy}
                          >
                            Set 1
                          </Button>
                        </div>
                      )}
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
