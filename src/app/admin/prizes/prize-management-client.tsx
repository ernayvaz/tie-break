"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button, Modal, Input } from "@/components/ui";
import {
  createPrizeAction,
  updatePrizeAction,
  deletePrizeAction,
} from "./actions";

export type PrizeRow = {
  id: string;
  competitionId: string;
  place: number;
  title: string;
  description: string | null;
};

const LEAGUE_OPTIONS = [
  { value: "CL", label: "UEFA Champions League" },
  { value: "OTHER", label: "Diğer" },
] as const;

export function PrizeManagementClient({ prizes }: { prizes: PrizeRow[] }) {
  const router = useRouter();
  const [leagueFilter, setLeagueFilter] = useState<string>(""); // "" = all, "CL", "OTHER"
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal] = useState<PrizeRow | null>(null);
  const [deleteModal, setDeleteModal] = useState<PrizeRow | null>(null);

  const filteredPrizes = useMemo(() => {
    if (!leagueFilter) return prizes;
    return prizes.filter((p) => p.competitionId === leagueFilter);
  }, [prizes, leagueFilter]);

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

  const leagueLabel = (id: string) => LEAGUE_OPTIONS.find((o) => o.value === id)?.label ?? id;

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
          Add prize
        </Button>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-nord-polar">League:</label>
          <select
            value={leagueFilter}
            onChange={(e) => setLeagueFilter(e.target.value)}
            className="rounded-lg border border-nord-polarLighter bg-white px-3 py-2 text-sm text-nord-polar"
          >
            <option value="">All leagues</option>
            {LEAGUE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <span className="text-sm text-nord-polarLight">
          Showing {filteredPrizes.length} of {prizes.length}
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-nord-polarLighter/50">
        {filteredPrizes.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-nord-polarLight">
            No prizes match the selected filter. Add a prize for this league.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-nord-polarLighter bg-nord-snow/80 text-left text-nord-polarLight">
                <th className="px-4 py-3 font-semibold">League</th>
                <th className="px-4 py-3 font-semibold">Place</th>
                <th className="px-4 py-3 font-semibold">Title</th>
                <th className="px-4 py-3 font-semibold">Description</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPrizes
                .sort((a, b) => (a.competitionId !== b.competitionId ? a.competitionId.localeCompare(b.competitionId) : a.place - b.place))
                .map((p) => (
                  <tr key={p.id} className="border-b border-nord-polarLighter/30 hover:bg-nord-snow/50">
                    <td className="px-4 py-3 text-nord-polar">{leagueLabel(p.competitionId)}</td>
                    <td className="px-4 py-3 font-medium text-nord-polar">{p.place}</td>
                    <td className="px-4 py-3 font-medium text-nord-polar">{p.title}</td>
                    <td className="px-4 py-3 text-nord-polarLight max-w-xs truncate">{p.description ?? "–"}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setEditModal(p)} disabled={busy}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => setDeleteModal(p)}
                          disabled={busy}
                        >
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

      {/* Create modal */}
      <Modal
        open={createModal}
        onClose={() => !busy && setCreateModal(false)}
        title="Add prize"
        confirmLabel="Create"
        onConfirm={() => {
          const form = document.getElementById("create-prize-form");
          if (form && form instanceof HTMLFormElement) {
            const fd = new FormData(form);
            const competitionId = (fd.get("competitionId") as string) || "CL";
            const place = parseInt(String(fd.get("place")), 10);
            const title = (fd.get("title") as string)?.trim();
            const description = (fd.get("description") as string)?.trim() || null;
            if (!title || place < 1) {
              setError("Place (≥1) and title are required.");
              return;
            }
            runAction(
              () => createPrizeAction({ competitionId, place, title, description }),
              () => setCreateModal(false)
            );
          }
        }}
        loading={busy}
      >
        <form id="create-prize-form" className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-nord-polar mb-1">League</label>
            <select
              name="competitionId"
              className="w-full rounded-lg border border-nord-polarLighter bg-white px-3 py-2 text-sm text-nord-polar"
            >
              {LEAGUE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <Input label="Place (1, 2, 3…)" type="number" name="place" min={1} required />
          <Input label="Title" name="title" placeholder="e.g. 1st prize" required />
          <Input label="Description (optional)" name="description" placeholder="Short description" />
        </form>
      </Modal>

      {/* Edit modal */}
      <Modal
        open={!!editModal}
        onClose={() => !busy && setEditModal(null)}
        title="Edit prize"
        confirmLabel="Save"
        onConfirm={() => {
          const form = document.getElementById("edit-prize-form");
          if (form && form instanceof HTMLFormElement && editModal) {
            const fd = new FormData(form);
            const title = (fd.get("title") as string)?.trim();
            const description = (fd.get("description") as string)?.trim() || null;
            runAction(
              () => updatePrizeAction(editModal.id, { title: title || undefined, description: description || null }),
              () => setEditModal(null)
            );
          }
        }}
        loading={busy}
      >
        {editModal && (
          <form id="edit-prize-form" className="space-y-4">
            <p className="text-sm text-nord-polarLight">
              League: <strong>{leagueLabel(editModal.competitionId)}</strong> — Place <strong>{editModal.place}</strong>
            </p>
            <Input label="Title" name="title" defaultValue={editModal.title} required />
            <Input label="Description (optional)" name="description" defaultValue={editModal.description ?? ""} />
          </form>
        )}
      </Modal>

      {/* Delete confirm */}
      <Modal
        open={!!deleteModal}
        onClose={() => !busy && setDeleteModal(null)}
        title="Delete prize?"
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          if (deleteModal) runAction(() => deletePrizeAction(deleteModal.id), () => setDeleteModal(null));
        }}
        loading={busy}
      >
        {deleteModal && (
          <p>
            Delete <strong>{deleteModal.title}</strong> (Place {deleteModal.place}, {leagueLabel(deleteModal.competitionId)})? This will not affect leaderboard history.
          </p>
        )}
      </Modal>
    </div>
  );
}
