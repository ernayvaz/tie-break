"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Modal, Input } from "@/components/ui";
import type {
  PowerPickAdminUserRow,
  PowerPickAdminLogRow,
} from "@/lib/power-pick-admin";
import {
  grantPowerPickAction,
  removeUnusedPowerPickAction,
  forceRemovePowerPickAction,
  resetForNextRoundPowerPickAction,
  type PowerPickAdminActionState,
} from "./actions";

type Props = {
  users: PowerPickAdminUserRow[];
  logs: PowerPickAdminLogRow[];
  packageSize: number;
  maxPerUser: number;
};

const ACTION_LABELS: Record<string, string> = {
  grant: "Grant",
  remove_unused: "Remove unused",
  force_remove: "Force reset",
  reset_next_round: "Next-round reset",
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "–";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PowerPickAdminClient({ users, logs, packageSize, maxPerUser }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [grantAmount, setGrantAmount] = useState<number>(
    Math.min(maxPerUser, Math.max(1, packageSize))
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [forceModal, setForceModal] = useState<{
    scope: "all_users" | "selected_users";
  } | null>(null);
  const [resetModal, setResetModal] = useState<{
    scope: "all_users" | "selected_users";
  } | null>(null);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        `${u.name} ${u.surname}`.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q)
    );
  }, [users, search]);

  const totals = useMemo(() => {
    return users.reduce(
      (acc, u) => {
        acc.totalGranted += u.totalGranted;
        acc.usedLocked += u.usedLocked;
        acc.selectedUnlocked += u.selectedUnlocked;
        acc.remaining += u.remainingAvailable;
        if (u.totalGranted > 0) acc.withRights += 1;
        return acc;
      },
      { totalGranted: 0, usedLocked: 0, selectedUnlocked: 0, remaining: 0, withRights: 0 }
    );
  }, [users]);

  const selectedIds = useMemo(() => [...selected], [selected]);

  const toggleSelected = (userId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const allFilteredSelected =
    filteredUsers.length > 0 && filteredUsers.every((u) => selected.has(u.userId));

  const toggleSelectAllFiltered = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredUsers.forEach((u) => next.delete(u.userId));
      } else {
        filteredUsers.forEach((u) => next.add(u.userId));
      }
      return next;
    });
  };

  const run = async (fn: () => Promise<PowerPickAdminActionState>) => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    const result = await fn();
    setBusy(false);
    if (result.ok) {
      setSuccess(result.message);
      router.refresh();
    } else {
      setError(result.error);
    }
  };

  const requireSelection = (): boolean => {
    if (selectedIds.length === 0) {
      setError("Select at least one user first.");
      setSuccess(null);
      return false;
    }
    return true;
  };

  return (
    <div className="mt-6 space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
          <button type="button" onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {success}
          <button type="button" onClick={() => setSuccess(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Players with rights", value: totals.withRights },
          { label: "Total granted", value: totals.totalGranted },
          { label: "Used / locked", value: totals.usedLocked },
          { label: "Remaining available", value: totals.remaining },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-nord-polarLighter/50 bg-white px-4 py-3"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-nord-polarLight">
              {card.label}
            </p>
            <p className="mt-1 text-xl font-bold text-nord-polar tabular-nums">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Amount selector */}
      <div className="rounded-xl border border-amber-300/50 bg-amber-50/60 p-4">
        <label
          htmlFor="grant-amount"
          className="text-sm font-semibold text-nord-polar"
        >
          Amount to grant
        </label>
        <p className="mt-0.5 text-xs text-nord-polarLight">
          Choose how many Power Pick x3 rights to grant (1–{maxPerUser}). No user can exceed{" "}
          {maxPerUser} total.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <select
            id="grant-amount"
            value={grantAmount}
            onChange={(e) => setGrantAmount(Number(e.target.value))}
            disabled={busy}
            className="rounded-lg border border-nord-polarLighter bg-white px-3 py-2 text-sm font-semibold text-nord-polar tabular-nums focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-300/40"
          >
            {Array.from({ length: maxPerUser }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <span className="text-xs text-nord-polarLight">
            right{grantAmount === 1 ? "" : "s"} per granted user
          </span>
        </div>
      </div>

      {/* Next-round reset (primary round-transition workflow) */}
      <div className="rounded-xl border border-emerald-300/60 bg-emerald-50/60 p-4">
        <div className="flex items-start gap-2">
          <span aria-hidden className="mt-0.5 text-base">♻️</span>
          <div>
            <h2 className="text-sm font-semibold text-nord-polar">Start a new round</h2>
            <p className="mt-0.5 text-xs text-nord-polarLight">
              Clears each user&apos;s leftover <strong>unused</strong> rights from the previous round
              and gives them exactly <strong>{grantAmount}</strong> fresh Power Pick x3 right
              {grantAmount === 1 ? "" : "s"} for the next round. Used (locked) picks and rights
              already armed on upcoming matches are kept untouched.
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            disabled={busy}
            onClick={() => setResetModal({ scope: "all_users" })}
          >
            Reset &amp; grant {grantAmount} to all users
          </Button>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => {
              if (!requireSelection()) return;
              setResetModal({ scope: "selected_users" });
            }}
          >
            Reset &amp; grant {grantAmount} to selected
          </Button>
        </div>
      </div>

      {/* Bulk: all users */}
      <div className="rounded-xl border border-nord-polarLighter/50 bg-nord-snow/40 p-4">
        <h2 className="text-sm font-semibold text-nord-polar">All users</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            disabled={busy}
            onClick={() => run(() => grantPowerPickAction("all_users", [], grantAmount))}
          >
            Grant {grantAmount} to all users
          </Button>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => run(() => removeUnusedPowerPickAction("all_users"))}
          >
            Remove unused from all users
          </Button>
          <Button
            variant="ghost"
            className="text-red-600 hover:text-red-700"
            disabled={busy}
            onClick={() => setForceModal({ scope: "all_users" })}
          >
            Force reset all users
          </Button>
        </div>
      </div>

      {/* Bulk: selected users */}
      <div className="rounded-xl border border-nord-polarLighter/50 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-nord-polar">
            Selected users{" "}
            <span className="font-normal text-nord-polarLight">({selectedIds.length})</span>
          </h2>
          <div className="w-full sm:w-64">
            <Input
              placeholder="Search by name or username…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            disabled={busy}
            onClick={() => {
              if (!requireSelection()) return;
              run(() => grantPowerPickAction("selected_users", selectedIds, grantAmount));
            }}
          >
            Grant {grantAmount} to selected
          </Button>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => {
              if (!requireSelection()) return;
              run(() => removeUnusedPowerPickAction("selected_users", selectedIds));
            }}
          >
            Remove unused from selected
          </Button>
          <Button
            variant="ghost"
            className="text-red-600 hover:text-red-700"
            disabled={busy}
            onClick={() => {
              if (!requireSelection()) return;
              setForceModal({ scope: "selected_users" });
            }}
          >
            Force reset selected
          </Button>
          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="self-center text-xs font-medium text-nord-frostDark hover:underline"
            >
              Clear selection
            </button>
          )}
        </div>

        {/* Users table */}
        <div className="mt-4 overflow-x-auto rounded-lg border border-nord-polarLighter/50">
          {filteredUsers.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-nord-polarLight">
              No users match the search.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-nord-polarLighter bg-nord-snow/80 text-left text-nord-polarLight">
                  <th className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleSelectAllFiltered}
                      aria-label="Select all filtered users"
                    />
                  </th>
                  <th className="px-3 py-3 font-semibold">User</th>
                  <th className="px-3 py-3 text-center font-semibold">Total granted</th>
                  <th className="px-3 py-3 text-center font-semibold">Used / locked</th>
                  <th className="px-3 py-3 text-center font-semibold">Active (unlocked)</th>
                  <th className="px-3 py-3 text-center font-semibold">Remaining</th>
                  <th className="px-3 py-3 font-semibold">Last updated</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr
                    key={u.userId}
                    className="border-b border-nord-polarLighter/30 hover:bg-nord-snow/50"
                  >
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={selected.has(u.userId)}
                        onChange={() => toggleSelected(u.userId)}
                        aria-label={`Select ${u.name} ${u.surname}`}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-medium text-nord-polar">
                        {u.name} {u.surname}
                      </span>
                      <span className="block text-xs text-nord-polarLight">@{u.username}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-nord-polar">
                      {u.totalGranted}
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-nord-polarLight">
                      {u.usedLocked}
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-nord-polarLight">
                      {u.selectedUnlocked}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span
                        className={`inline-flex min-w-[1.75rem] justify-center rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${
                          u.remainingAvailable > 0
                            ? "bg-amber-100 text-amber-800"
                            : "bg-nord-snow text-nord-polarLight"
                        }`}
                      >
                        {u.remainingAvailable}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-nord-polarLight">
                      {formatDateTime(u.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Audit log */}
      <div className="rounded-xl border border-nord-polarLighter/50 bg-white p-4">
        <h2 className="text-sm font-semibold text-nord-polar">Recent admin actions</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-nord-polarLighter/50">
          {logs.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-nord-polarLight">
              No Power Pick x3 admin actions yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-nord-polarLighter bg-nord-snow/80 text-left text-nord-polarLight">
                  <th className="px-3 py-3 font-semibold">When</th>
                  <th className="px-3 py-3 font-semibold">Admin</th>
                  <th className="px-3 py-3 font-semibold">Action</th>
                  <th className="px-3 py-3 font-semibold">Scope</th>
                  <th className="px-3 py-3 text-center font-semibold">Amount</th>
                  <th className="px-3 py-3 text-center font-semibold">Users</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr
                    key={l.id}
                    className="border-b border-nord-polarLighter/30 hover:bg-nord-snow/50"
                  >
                    <td className="px-3 py-2.5 text-xs text-nord-polarLight">
                      {formatDateTime(l.createdAt)}
                    </td>
                    <td className="px-3 py-2.5 text-nord-polar">{l.adminName ?? "–"}</td>
                    <td className="px-3 py-2.5 text-nord-polar">
                      {ACTION_LABELS[l.actionType] ?? l.actionType}
                    </td>
                    <td className="px-3 py-2.5 text-nord-polarLight">
                      {l.targetScope === "all_users" ? "All users" : "Selected users"}
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-nord-polarLight">
                      {l.amountGranted > 0 ? `+${l.amountGranted}` : l.amountGranted}
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-nord-polarLight">
                      {l.affectedUsers}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Next-round reset confirmation */}
      <Modal
        open={!!resetModal}
        onClose={() => !busy && setResetModal(null)}
        title="Start a new round?"
        confirmLabel={`Yes, reset & grant ${grantAmount}`}
        cancelLabel="Cancel"
        loading={busy}
        onConfirm={() => {
          if (!resetModal) return;
          const scope = resetModal.scope;
          setResetModal(null);
          run(() =>
            resetForNextRoundPowerPickAction(
              scope,
              scope === "selected_users" ? selectedIds : [],
              grantAmount
            )
          );
        }}
      >
        <p>
          This will remove all <strong>unused</strong> Power Pick x3 rights and set exactly{" "}
          <strong>{grantAmount}</strong> fresh right{grantAmount === 1 ? "" : "s"} for{" "}
          <strong>
            {resetModal?.scope === "all_users"
              ? "all users"
              : `${selectedIds.length} selected user(s)`}
          </strong>
          . Used (locked) picks and rights already armed on upcoming matches are preserved.
        </p>
      </Modal>

      {/* Force reset confirmation */}
      <Modal
        open={!!forceModal}
        onClose={() => !busy && setForceModal(null)}
        title="Force reset Power Pick x3?"
        confirmLabel="Yes, force reset"
        cancelLabel="Cancel"
        variant="danger"
        loading={busy}
        onConfirm={() => {
          if (!forceModal) return;
          const scope = forceModal.scope;
          setForceModal(null);
          run(() =>
            forceRemovePowerPickAction(
              scope,
              scope === "selected_users" ? selectedIds : []
            )
          );
        }}
      >
        <p>
          This will revoke all <strong>active (unlocked)</strong> Power Pick x3 selections and
          zero out granted rights for{" "}
          <strong>
            {forceModal?.scope === "all_users"
              ? "all users"
              : `${selectedIds.length} selected user(s)`}
          </strong>
          . Already-locked historical picks are preserved so past scoring stays intact. This
          cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
