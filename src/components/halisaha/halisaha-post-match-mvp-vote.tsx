"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { submitPostMatchMvpVoteAction } from "@/app/(app)/halisaha/actions";
import { buildParticipantPickerLabelMap } from "@/lib/halisaha/participant-picker-labels";
import type { HalisahaPostMatchMvpVoteState } from "@/lib/halisaha/server";

export function HalisahaPostMatchMvpVote({
  matchId,
  voteState,
}: {
  matchId: string | null;
  voteState: HalisahaPostMatchMvpVoteState;
}) {
  const router = useRouter();
  const [selectedParticipantId, setSelectedParticipantId] = useState(
    voteState.userVoteParticipantId ?? "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groupedParticipants = useMemo(
    () => ({
      home: voteState.participants.filter((participant) => participant.teamSide === "home"),
      away: voteState.participants.filter((participant) => participant.teamSide === "away"),
    }),
    [voteState.participants],
  );
  const pickerLabelByParticipantId = useMemo(
    () =>
      buildParticipantPickerLabelMap(
        voteState.participants.map((participant) => ({
          id: participant.id,
          displayName: participant.displayName,
          teamSide: participant.teamSide,
          positionLabel: participant.positionLabel,
        })),
      ),
    [voteState.participants],
  );

  const handleSubmit = async () => {
    if (!matchId) {
      setError("Match not found.");
      return;
    }

    if (!selectedParticipantId) {
      setError("Choose one player first.");
      return;
    }

    setBusy(true);
    setError(null);
    const result = await submitPostMatchMvpVoteAction(matchId, selectedParticipantId);
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    router.refresh();
  };

  return (
    <div className="absolute inset-0 z-[14] px-[2%] pb-[0.45%] pt-[0.45%]">
      <div className="flex h-full flex-col rounded-[1.18rem] border border-white/10 bg-[linear-gradient(180deg,rgba(8,15,14,0.9),rgba(8,15,14,0.72))] px-4 py-4 shadow-[0_24px_52px_rgba(0,0,0,0.24)] backdrop-blur-md">
        <div className="text-center">
          <div className="text-[0.58rem] font-semibold uppercase tracking-[0.2em] text-white/42">
            Post-match vote
          </div>
          <h3 className="mt-2 text-[1.08rem] font-semibold text-white">
            {voteState.prompt}
          </h3>
          <p className="mx-auto mt-2 max-w-[36rem] text-[0.78rem] leading-[1.6] text-white/66">
            {voteState.votingWindowOpen
              ? "The 24-hour community MVP vote is live. Submit one vote to unlock your Halisaha results and leaderboard now. When the window closes, the final MVP is determined from the submitted votes and the correct answers stay visible here."
              : "This 24-hour MVP vote is only available after the match ends. Once the window closes, the final MVP is determined from the submitted votes and the correct answers plus leaderboard are revealed."}
          </p>
          <p className="mx-auto mt-2 max-w-[36rem] text-[0.72rem] leading-[1.6] text-white/50">
            Only the admin and the players who took part in this match can vote during this
            window.
          </p>
        </div>

        <div className="mt-4 grid min-h-0 flex-1 gap-3 md:grid-cols-2">
          {[
            {
              key: "home",
              label: "Home team",
              participants: groupedParticipants.home,
            },
            {
              key: "away",
              label: "Away team",
              participants: groupedParticipants.away,
            },
          ].map((group) => (
            <div
              key={group.key}
              className="flex min-h-0 flex-col rounded-[1rem] border border-white/10 bg-white/[0.04] p-3"
            >
              <div className="text-[0.56rem] font-semibold uppercase tracking-[0.18em] text-white/42">
                {group.label}
              </div>
              <div className="mt-3 min-h-0 space-y-2 overflow-y-auto pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {group.participants.length > 0 ? (
                  group.participants.map((participant) => (
                    <button
                      key={participant.id}
                      type="button"
                      onClick={() => setSelectedParticipantId(participant.id)}
                      className={`flex w-full items-center justify-between rounded-[0.78rem] border px-3 py-2 text-left transition-colors ${
                        selectedParticipantId === participant.id
                          ? "border-white/20 bg-white/[0.12] text-white"
                          : "border-white/10 bg-black/10 text-white/82 hover:bg-white/[0.06]"
                      }`}
                    >
                      <div>
                        <div className="text-[0.78rem] font-medium">
                          {pickerLabelByParticipantId.get(participant.id) ?? participant.displayName}
                        </div>
                        <div className="mt-0.5 text-[0.54rem] uppercase tracking-[0.14em] text-white/34">
                          {participant.positionLabel}
                        </div>
                      </div>
                      <span className="text-[0.52rem] font-semibold uppercase tracking-[0.16em] text-white/44">
                        Pick
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="rounded-[0.8rem] border border-dashed border-white/10 bg-black/10 px-3 py-4 text-[0.76rem] text-white/42">
                    No players have been assigned here yet.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-col items-center gap-3">
          {error ? (
            <div className="w-full max-w-[38rem] rounded-[0.9rem] border border-red-300/20 bg-red-400/10 px-4 py-3 text-center text-[0.76rem] text-red-100">
              {error}
            </div>
          ) : null}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy || !selectedParticipantId || voteState.participants.length === 0}
            className="rounded-full border border-white/12 bg-[linear-gradient(180deg,rgba(212,228,223,0.12),rgba(212,228,223,0.05))] px-4 py-[0.72rem] text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-white shadow-[0_12px_28px_rgba(0,0,0,0.22)] transition-colors hover:bg-white/[0.12] disabled:cursor-default disabled:opacity-60"
          >
            {busy ? "Submitting..." : "Submit MVP vote"}
          </button>
        </div>
      </div>
    </div>
  );
}
