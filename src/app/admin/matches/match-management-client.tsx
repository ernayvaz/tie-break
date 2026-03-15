"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button, Modal, Input } from "@/components/ui";
import {
  setMatchResultAction,
  createMatchAction,
  updateMatchAction,
  deleteMatchAction,
} from "./actions";
import type { PredictionDisplay } from "@/lib/prediction-values";

export type MatchRow = {
  id: string;
  competitionId: string | null;
  stage: string;
  matchDatetime: string;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamLogo: string | null;
  awayTeamLogo: string | null;
  lockAt: string;
  officialResultType: string | null;
  homeScore: number | null;
  awayScore: number | null;
};

const STAGE_OPTIONS = [
  "GROUP_STAGE",
  "LEAGUE_STAGE",
  "ROUND_16",
  "LAST_16",
  "QUARTER_FINAL",
  "SEMI_FINAL",
  "FINAL",
  "PLAYOFFS",
];

function formatStage(s: string): string {
  const map: Record<string, string> = {
    GROUP_STAGE: "Group stage",
    LEAGUE_STAGE: "League stage",
    ROUND_16: "Round of 16",
    LAST_16: "Round of 16",
    QUARTER_FINAL: "Quarter-final",
    SEMI_FINAL: "Semi-final",
    FINAL: "Final",
    PLAYOFFS: "Play-offs",
  };
  return map[s] ?? s;
}

function displayResult(v: string | null): string {
  if (!v) return "–";
  const map: Record<string, string> = { ONE: "1", X: "X", TWO: "2" };
  return map[v] ?? v;
}

export function MatchManagementClient({ matches }: { matches: MatchRow[] }) {
  const router = useRouter();
  const now = useMemo(() => new Date(), []);
  const [leagueFilter, setLeagueFilter] = useState<string>(""); // "" = all, "CL" = UCL, "other" = Diğer
  const [stageFilter, setStageFilter] = useState<string>("");
  const [timeFilter, setTimeFilter] = useState<"all" | "upcoming" | "past">("all");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resultModal, setResultModal] = useState<MatchRow | null>(null);
  const [editModal, setEditModal] = useState<MatchRow | null>(null);
  const [createModal, setCreateModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState<MatchRow | null>(null);
  const [resultType, setResultType] = useState<PredictionDisplay>("1");
  const [resultHome, setResultHome] = useState<string>("");
  const [resultAway, setResultAway] = useState<string>("");

  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      if (leagueFilter === "CL" && m.competitionId !== "CL" && m.competitionId != null) return false;
      if (leagueFilter === "other" && (m.competitionId === "CL" || m.competitionId == null)) return false;
      if (stageFilter && m.stage !== stageFilter) return false;
      const dt = new Date(m.matchDatetime).getTime();
      if (timeFilter === "upcoming" && dt < now.getTime()) return false;
      if (timeFilter === "past" && dt >= now.getTime()) return false;
      return true;
    });
  }, [matches, leagueFilter, stageFilter, timeFilter, now]);

  const stagesInList = useMemo(() => {
    const s = new Set(matches.map((m) => m.stage));
    return Array.from(s).sort((a, b) => STAGE_OPTIONS.indexOf(a) - STAGE_OPTIONS.indexOf(b) || a.localeCompare(b));
  }, [matches]);

  const runAction = async (
    fn: () => Promise<{ ok: true; message?: string } | { ok: false; error: string }>,
    onClose: () => void
  ) => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    const result = await fn();
    setBusy(false);
    onClose();
    if (result.ok) {
      setSuccess(result.message ?? "Done.");
      router.refresh();
    } else setError(result.error);
  };

  const openResultModal = (m: MatchRow) => {
    setResultModal(m);
    setResultType((m.officialResultType ? displayResult(m.officialResultType) : "1") as PredictionDisplay);
    setResultHome(m.homeScore != null ? String(m.homeScore) : "");
    setResultAway(m.awayScore != null ? String(m.awayScore) : "");
  };

  const handleSetResult = () => {
    if (!resultModal) return;
    const home = resultHome === "" ? undefined : parseInt(resultHome, 10);
    const away = resultAway === "" ? undefined : parseInt(resultAway, 10);
    if (resultHome !== "" && (isNaN(home!) || home! < 0)) {
      setError("Home score must be a non-negative number.");
      return;
    }
    if (resultAway !== "" && (isNaN(away!) || away! < 0)) {
      setError("Away score must be a non-negative number.");
      return;
    }
    runAction(
      () => setMatchResultAction(resultModal.id, resultType, home ?? null, away ?? null),
      () => {
        setResultModal(null);
        setResultHome("");
        setResultAway("");
      }
    );
  };

  const handleCreate = (form: FormData) => {
    const stage = (form.get("stage") as string)?.trim();
    const matchDatetime = form.get("matchDatetime") as string;
    const homeTeamName = (form.get("homeTeamName") as string)?.trim();
    const awayTeamName = (form.get("awayTeamName") as string)?.trim();
    const lockAt = (form.get("lockAt") as string) || undefined;
    if (!stage || !matchDatetime || !homeTeamName || !awayTeamName) {
      setError("Stage, date/time and both team names are required.");
      return;
    }
    runAction(
      () => createMatchAction({ stage, matchDatetime, homeTeamName, awayTeamName, lockAt: lockAt || null }),
      () => setCreateModal(false)
    );
  };

  const handleEdit = (form: FormData, m: MatchRow) => {
    const stage = (form.get("stage") as string)?.trim();
    const matchDatetime = form.get("matchDatetime") as string;
    const homeTeamName = (form.get("homeTeamName") as string)?.trim();
    const awayTeamName = (form.get("awayTeamName") as string)?.trim();
    const lockAt = (form.get("lockAt") as string) || undefined;
    const officialResultType = (form.get("officialResultType") as string) || null;
    const homeScore = (form.get("homeScore") as string)?.trim();
    const awayScore = (form.get("awayScore") as string)?.trim();
    const homeNum = homeScore === "" ? null : parseInt(homeScore, 10);
    const awayNum = awayScore === "" ? null : parseInt(awayScore, 10);
    runAction(
      () =>
        updateMatchAction(m.id, {
          stage: stage || undefined,
          matchDatetime: matchDatetime || undefined,
          homeTeamName: homeTeamName || undefined,
          awayTeamName: awayTeamName || undefined,
          lockAt: lockAt || undefined,
          officialResultType: (officialResultType as PredictionDisplay) || null,
          homeScore: homeNum != null && !isNaN(homeNum) ? homeNum : null,
          awayScore: awayNum != null && !isNaN(awayNum) ? awayNum : null,
        }),
      () => setEditModal(null)
    );
  };

  const toDatetimeLocal = (iso: string) => {
    const d = new Date(iso);
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const h = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${y}-${mo}-${day}T${h}:${min}`;
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
        <Button onClick={() => setCreateModal(true)} disabled={busy}>
          Create match
        </Button>
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
          <label className="text-sm font-medium text-nord-polar">Stage:</label>
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="rounded-lg border border-nord-polarLighter bg-white px-3 py-2 text-sm text-nord-polar"
          >
            <option value="">All stages</option>
            {stagesInList.map((s) => (
              <option key={s} value={s}>
                {formatStage(s)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-nord-polar">Time:</label>
          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value as "all" | "upcoming" | "past")}
            className="rounded-lg border border-nord-polarLighter bg-white px-3 py-2 text-sm text-nord-polar"
          >
            <option value="all">All</option>
            <option value="upcoming">Upcoming</option>
            <option value="past">Past</option>
          </select>
        </div>
        <span className="text-sm text-nord-polarLight">
          Showing {filteredMatches.length} of {matches.length}
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-nord-polarLighter/50">
        {filteredMatches.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-nord-polarLight">
            No matches match the selected filters.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-nord-polarLighter bg-nord-snow/80 text-left text-nord-polarLight">
                <th className="px-4 py-3 font-semibold">Date / Time</th>
                <th className="px-4 py-3 font-semibold">Stage</th>
                <th className="px-4 py-3 font-semibold">Match</th>
                <th className="px-4 py-3 font-semibold">Lock</th>
                <th className="px-4 py-3 font-semibold">Score</th>
                <th className="px-4 py-3 font-semibold">Result</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMatches.map((m) => (
                <tr key={m.id} className="border-b border-nord-polarLighter/30 hover:bg-nord-snow/50">
                  <td className="px-4 py-3 text-nord-polar">
                    {new Date(m.matchDatetime).toLocaleString("en-GB", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="px-4 py-3 text-nord-polarLight">{formatStage(m.stage)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {m.homeTeamLogo ? (
                        <img src={m.homeTeamLogo} alt="" className="h-6 w-6 rounded-full object-contain bg-white border border-nord-polarLighter/50" />
                      ) : (
                        <span className="h-6 w-6 rounded-full bg-nord-snow flex items-center justify-center text-xs text-nord-polarLighter">?</span>
                      )}
                      <span className="font-medium text-nord-polar">{m.homeTeamName}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {m.awayTeamLogo ? (
                        <img src={m.awayTeamLogo} alt="" className="h-6 w-6 rounded-full object-contain bg-white border border-nord-polarLighter/50" />
                      ) : (
                        <span className="h-6 w-6 rounded-full bg-nord-snow flex items-center justify-center text-xs text-nord-polarLighter">?</span>
                      )}
                      <span className="text-nord-polar">{m.awayTeamName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-nord-polarLight">
                    {new Date(m.lockAt).toLocaleString("en-GB", { timeStyle: "short" })}
                  </td>
                  <td className="px-4 py-3 text-nord-polar">
                    {m.homeScore != null && m.awayScore != null ? `${m.homeScore} – ${m.awayScore}` : "–"}
                  </td>
                  <td className="px-4 py-3 font-medium text-nord-polar">
                    {displayResult(m.officialResultType)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button size="sm" variant="secondary" onClick={() => openResultModal(m)} disabled={busy}>
                        Set result
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditModal(m)} disabled={busy}>
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleteModal(m)} disabled={busy} className="text-red-600 hover:text-red-700">
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Set result modal */}
      <Modal
        open={!!resultModal}
        onClose={() => !busy && setResultModal(null)}
        title="Set match result"
        confirmLabel="Save result"
        onConfirm={handleSetResult}
        loading={busy}
      >
        {resultModal && (
          <div className="space-y-4">
            <p className="text-sm text-nord-polar">
              {resultModal.homeTeamName} vs {resultModal.awayTeamName}
            </p>
            <div>
              <label className="block text-sm font-medium text-nord-polar mb-1">Result (1 / X / 2)</label>
              <div className="flex gap-2">
                {(["1", "X", "2"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setResultType(v)}
                    className={`rounded border px-3 py-2 text-sm font-medium ${resultType === v ? "border-nord-frostDark bg-nord-frostDark text-white" : "border-nord-polarLighter bg-white text-nord-polar"}`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Home score (optional)"
                type="number"
                min={0}
                value={resultHome}
                onChange={(e) => setResultHome(e.target.value)}
              />
              <Input
                label="Away score (optional)"
                type="number"
                min={0}
                value={resultAway}
                onChange={(e) => setResultAway(e.target.value)}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Create match modal - use form with action or state */}
      <Modal
        open={createModal}
        onClose={() => !busy && setCreateModal(false)}
        title="Create match"
        confirmLabel="Create"
        onConfirm={() => {
          const form = document.getElementById("create-match-form");
          if (form && form instanceof HTMLFormElement) handleCreate(new FormData(form));
        }}
        loading={busy}
      >
        <form id="create-match-form" className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-nord-polar mb-1">Stage</label>
            <select name="stage" required className="w-full rounded-lg border border-nord-polarLighter bg-white px-3 py-2 text-sm text-nord-polar">
              {STAGE_OPTIONS.map((s) => (
                <option key={s} value={s}>{formatStage(s)}</option>
              ))}
            </select>
          </div>
          <Input label="Date & time" type="datetime-local" name="matchDatetime" required />
          <Input label="Home team" name="homeTeamName" placeholder="Home team name" required />
          <Input label="Away team" name="awayTeamName" placeholder="Away team name" required />
          <Input label="Lock at (optional, default: 5 min before)" type="datetime-local" name="lockAt" />
        </form>
      </Modal>

      {/* Edit match modal */}
      <Modal
        open={!!editModal}
        onClose={() => !busy && setEditModal(null)}
        title="Edit match"
        confirmLabel="Save"
        onConfirm={() => {
          const form = document.getElementById("edit-match-form");
          if (form && form instanceof HTMLFormElement && editModal) handleEdit(new FormData(form), editModal);
        }}
        loading={busy}
      >
        {editModal && (
          <form id="edit-match-form" className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-nord-polar mb-1">Stage</label>
              <select name="stage" defaultValue={editModal.stage} className="w-full rounded-lg border border-nord-polarLighter bg-white px-3 py-2 text-sm text-nord-polar">
                {STAGE_OPTIONS.map((s) => (
                  <option key={s} value={s}>{formatStage(s)}</option>
                ))}
              </select>
            </div>
            <Input label="Date & time" type="datetime-local" name="matchDatetime" defaultValue={toDatetimeLocal(editModal.matchDatetime)} />
            <Input label="Home team" name="homeTeamName" defaultValue={editModal.homeTeamName} />
            <Input label="Away team" name="awayTeamName" defaultValue={editModal.awayTeamName} />
            <Input label="Lock at" type="datetime-local" name="lockAt" defaultValue={toDatetimeLocal(editModal.lockAt)} />
            <div className="border-t border-nord-polarLighter pt-4">
              <p className="text-sm font-medium text-nord-polar mb-2">Result (optional)</p>
              <select name="officialResultType" defaultValue={editModal.officialResultType ?? ""} className="w-full rounded-lg border border-nord-polarLighter bg-white px-3 py-2 text-sm text-nord-polar">
                <option value="">No result</option>
                <option value="1">1 (Home win)</option>
                <option value="X">X (Draw)</option>
                <option value="2">2 (Away win)</option>
              </select>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <Input label="Home score" type="number" min={0} name="homeScore" defaultValue={editModal.homeScore ?? ""} />
                <Input label="Away score" type="number" min={0} name="awayScore" defaultValue={editModal.awayScore ?? ""} />
              </div>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete confirm */}
      <Modal
        open={!!deleteModal}
        onClose={() => !busy && setDeleteModal(null)}
        title="Delete match?"
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => deleteModal && runAction(() => deleteMatchAction(deleteModal.id), () => setDeleteModal(null))}
        loading={busy}
      >
        {deleteModal && (
          <p>
            Delete <strong>{deleteModal.homeTeamName} vs {deleteModal.awayTeamName}</strong>? All predictions for this match will also be deleted. This cannot be undone.
          </p>
        )}
      </Modal>
    </div>
  );
}
