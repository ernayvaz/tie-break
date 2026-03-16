"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button, Modal, Input } from "@/components/ui";
import {
  approveUserAction,
  rejectUserAction,
  blockUserAction,
  unblockUserAction,
  updateUsernameAction,
  resetPinAction,
  deleteUserAction,
} from "./actions";

export type UserRow = {
  id: string;
  name: string;
  surname: string;
  username: string;
  status: string;
  role: string;
  createdAt: string;
  approvedAt: string | null;
  approvedByName: string | null;
};

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "pending_approval", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "blocked", label: "Blocked" },
] as const;

type StatusFilter = (typeof STATUS_OPTIONS)[number]["value"];

export function UserManagementClient({
  users,
  adminUserId,
}: {
  users: UserRow[];
  adminUserId: string;
}) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending_approval");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<
    | { type: "approve" | "reject" | "block" | "unblock" | "delete"; user: UserRow }
    | null
  >(null);
  const [editUsernameModal, setEditUsernameModal] = useState<UserRow | null>(null);
  const [resetPinModal, setResetPinModal] = useState<UserRow | null>(null);
  const [pendingUsername, setPendingUsername] = useState("");
  const [pendingPin, setPendingPin] = useState("");
  const [busy, setBusy] = useState(false);

  const filteredUsers = useMemo(() => {
    if (statusFilter === "all") return users;
    return users.filter((u) => u.status === statusFilter);
  }, [users, statusFilter]);

  const clearFeedback = () => {
    setError(null);
    setSuccess(null);
  };

  const runAction = async (
    fn: () => Promise<{ ok: true; message?: string } | { ok: false; error: string }>,
    closeModal: () => void
  ) => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    const result = await fn();
    setBusy(false);
    closeModal();
    if (result.ok) {
      setSuccess(result.message ?? "Done.");
      router.refresh();
    } else {
      setError(result.error);
    }
  };

  const handleApprove = () => {
    if (!confirmModal || confirmModal.type !== "approve") return;
    runAction(() => approveUserAction(confirmModal.user.id), () => setConfirmModal(null));
  };
  const handleReject = () => {
    if (!confirmModal || confirmModal.type !== "reject") return;
    runAction(() => rejectUserAction(confirmModal.user.id), () => setConfirmModal(null));
  };
  const handleBlock = () => {
    if (!confirmModal || confirmModal.type !== "block") return;
    runAction(() => blockUserAction(confirmModal.user.id), () => setConfirmModal(null));
  };
  const handleUnblock = () => {
    if (!confirmModal || confirmModal.type !== "unblock") return;
    runAction(() => unblockUserAction(confirmModal.user.id), () => setConfirmModal(null));
  };
  const handleDelete = () => {
    if (!confirmModal || confirmModal.type !== "delete") return;
    runAction(() => deleteUserAction(confirmModal.user.id), () => setConfirmModal(null));
  };

  const handleSaveUsername = async () => {
    if (!editUsernameModal) return;
    await runAction(
      () => updateUsernameAction(editUsernameModal.id, pendingUsername),
      () => {
        setEditUsernameModal(null);
        setPendingUsername("");
      }
    );
  };

  const handleSavePin = async () => {
    if (!resetPinModal) return;
    if (!/^\d{4}$/.test(pendingPin)) {
      setError("PIN must be exactly 4 digits.");
      return;
    }
    await runAction(
      () => resetPinAction(resetPinModal.id, pendingPin),
      () => {
        setResetPinModal(null);
        setPendingPin("");
      }
    );
  };

  const pendingCount = users.filter((u) => u.status === "pending_approval").length;

  return (
    <div className="mt-6">
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
          <button type="button" onClick={clearFeedback} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}
      {success && (
        <div
          role="status"
          className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
        >
          {success}
          <button type="button" onClick={clearFeedback} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-4 border-b border-nord-polarLighter/50 pb-4">
        <div className="flex items-center gap-2">
          <label htmlFor="status-filter" className="text-sm font-medium text-nord-polar">
            Status:
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="rounded-lg border border-nord-polarLighter bg-white px-3 py-2 text-sm text-nord-polar focus:border-nord-frostDark focus:outline-none focus:ring-1 focus:ring-nord-frostDark"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        {pendingCount > 0 && (
          <span className="text-sm text-nord-frostDark font-medium">
            {pendingCount} pending approval
          </span>
        )}
        <span className="text-sm text-nord-polarLight">
          Showing {filteredUsers.length} of {users.length}
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-nord-polarLighter/50">
        {filteredUsers.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-nord-polarLight">
            No users match the selected filter.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-nord-polarLighter bg-nord-snow/80 text-left text-nord-polarLight">
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Username</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Registered</th>
                <th className="px-4 py-3 font-semibold">Approved</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => {
                const isSelf = u.id === adminUserId;
                return (
                  <tr key={u.id} className="border-b border-nord-polarLighter/30 hover:bg-nord-snow/50">
                    <td className="px-4 py-3 text-nord-polar">
                      {u.name} {u.surname}
                    </td>
                    <td className="px-4 py-3 font-medium text-nord-polar">{u.username}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          u.status === "approved"
                            ? "bg-green-100 text-green-800"
                            : u.status === "pending_approval"
                              ? "bg-amber-100 text-amber-800"
                              : u.status === "blocked"
                                ? "bg-red-100 text-red-800"
                                : "bg-nord-snow text-nord-polarLight"
                        }`}
                      >
                        {u.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-nord-polarLight">
                      {new Date(u.createdAt).toLocaleDateString("en-GB", {
                        dateStyle: "short",
                      })}
                    </td>
                    <td className="px-4 py-3 text-nord-polarLight">
                      {u.approvedAt
                        ? `${new Date(u.approvedAt).toLocaleDateString("en-GB", { dateStyle: "short" })}${u.approvedByName ? ` by ${u.approvedByName}` : ""}`
                        : "–"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        {u.status === "pending_approval" && (
                          <>
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => setConfirmModal({ type: "approve", user: u })}
                              disabled={busy}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => setConfirmModal({ type: "reject", user: u })}
                              disabled={busy}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                        {u.status === "approved" && !isSelf && (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => setConfirmModal({ type: "block", user: u })}
                            disabled={busy}
                          >
                            Block
                          </Button>
                        )}
                        {u.status === "blocked" && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setConfirmModal({ type: "unblock", user: u })}
                            disabled={busy}
                          >
                            Unblock
                          </Button>
                        )}
                        {u.status !== "rejected" && (
                          <>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setEditUsernameModal(u);
                                setPendingUsername(u.username);
                              }}
                              disabled={busy}
                            >
                              Edit username
                            </Button>
                            {!isSelf && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  setResetPinModal(u);
                                  setPendingPin("");
                                }}
                                disabled={busy}
                              >
                                Reset PIN
                              </Button>
                            )}
                          </>
                        )}
                        {!isSelf && u.role !== "admin" && (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => setConfirmModal({ type: "delete", user: u })}
                            disabled={busy}
                          >
                            Delete
                          </Button>
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

      {/* Confirm modals */}
      <Modal
        open={confirmModal?.type === "approve"}
        onClose={() => !busy && setConfirmModal(null)}
        title="Approve user?"
        confirmLabel="Yes, approve"
        onConfirm={handleApprove}
        loading={busy}
      >
        {confirmModal?.type === "approve" && (
          <p>
            Approve <strong>{confirmModal.user.name} {confirmModal.user.surname}</strong> ({confirmModal.user.username})? They will be able to log in.
          </p>
        )}
      </Modal>
      <Modal
        open={confirmModal?.type === "reject"}
        onClose={() => !busy && setConfirmModal(null)}
        title="Reject user?"
        confirmLabel="Yes, reject"
        variant="danger"
        onConfirm={handleReject}
        loading={busy}
      >
        {confirmModal?.type === "reject" && (
          <p>
            Reject <strong>{confirmModal.user.name} {confirmModal.user.surname}</strong> ({confirmModal.user.username})? They will not be able to log in.
          </p>
        )}
      </Modal>
      <Modal
        open={confirmModal?.type === "block"}
        onClose={() => !busy && setConfirmModal(null)}
        title="Block user?"
        confirmLabel="Yes, block"
        variant="danger"
        onConfirm={handleBlock}
        loading={busy}
      >
        {confirmModal?.type === "block" && (
          <p>
            Block <strong>{confirmModal.user.name} {confirmModal.user.surname}</strong> ({confirmModal.user.username})? Their sessions will be invalidated and they will not be able to log in until unblocked.
          </p>
        )}
      </Modal>
      <Modal
        open={confirmModal?.type === "unblock"}
        onClose={() => !busy && setConfirmModal(null)}
        title="Unblock user?"
        confirmLabel="Yes, unblock"
        onConfirm={handleUnblock}
        loading={busy}
      >
        {confirmModal?.type === "unblock" && (
          <p>
            Unblock <strong>{confirmModal.user.name} {confirmModal.user.surname}</strong> ({confirmModal.user.username})? They will be able to log in again.
          </p>
        )}
      </Modal>
      <Modal
        open={confirmModal?.type === "delete"}
        onClose={() => !busy && setConfirmModal(null)}
        title="Delete user?"
        confirmLabel="Yes, delete"
        variant="danger"
        onConfirm={handleDelete}
        loading={busy}
      >
        {confirmModal?.type === "delete" && (
          <p>
            Permanently delete <strong>{confirmModal.user.name} {confirmModal.user.surname}</strong> ({confirmModal.user.username})? Their sessions, predictions, and leaderboard entry will be removed. This cannot be undone.
          </p>
        )}
      </Modal>

      {/* Edit username modal */}
      <Modal
        open={!!editUsernameModal}
        onClose={() => { if (!busy) { setEditUsernameModal(null); setPendingUsername(""); } }}
        title="Edit username"
        confirmLabel="Save"
        cancelLabel="Cancel"
        onConfirm={handleSaveUsername}
        loading={busy}
      >
        {editUsernameModal && (
          <div>
            <p className="mb-3 text-sm text-nord-polarLight">
              Change username for {editUsernameModal.name} {editUsernameModal.surname}.
            </p>
            <Input
              label="Username"
              value={pendingUsername}
              onChange={(e) => setPendingUsername(e.target.value)}
              placeholder="username"
              autoComplete="off"
            />
          </div>
        )}
      </Modal>

      {/* Reset PIN modal */}
      <Modal
        open={!!resetPinModal}
        onClose={() => { if (!busy) { setResetPinModal(null); setPendingPin(""); } }}
        title="Reset PIN"
        confirmLabel="Reset PIN"
        cancelLabel="Cancel"
        onConfirm={handleSavePin}
        loading={busy}
      >
        {resetPinModal && (
          <div>
            <p className="mb-3 text-sm text-nord-polarLight">
              Set a new 4-digit PIN for {resetPinModal.name} {resetPinModal.surname} ({resetPinModal.username}).
            </p>
            <Input
              label="New PIN (4 digits)"
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pendingPin}
              onChange={(e) => setPendingPin(e.target.value.replace(/\D/g, ""))}
              placeholder="****"
              autoComplete="off"
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
