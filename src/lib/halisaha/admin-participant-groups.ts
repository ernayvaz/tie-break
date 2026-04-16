import type { HalisahaAdminParticipantRow } from "./server";

export type HalisahaAdminParticipantGroupKey = "home" | "away" | "unassigned";

export type HalisahaAdminParticipantGroup = {
  key: HalisahaAdminParticipantGroupKey;
  title: string;
  emptyMessage: string;
  participants: HalisahaAdminParticipantRow[];
};

export function groupHalisahaAdminParticipantsByTeam(input: {
  participants: readonly HalisahaAdminParticipantRow[];
  homeTeamName: string;
  awayTeamName: string;
}): HalisahaAdminParticipantGroup[] {
  const { participants, homeTeamName, awayTeamName } = input;

  return [
    {
      key: "home",
      title: `${homeTeamName} squad`,
      emptyMessage: `No players or guests are assigned to ${homeTeamName} yet.`,
      participants: participants.filter((participant) => participant.teamSide === "home"),
    },
    {
      key: "away",
      title: `${awayTeamName} squad`,
      emptyMessage: `No players or guests are assigned to ${awayTeamName} yet.`,
      participants: participants.filter((participant) => participant.teamSide === "away"),
    },
    {
      key: "unassigned",
      title: "Unassigned players and guests",
      emptyMessage: "Everyone in the squad has already been assigned to a team.",
      participants: participants.filter((participant) => participant.teamSide == null),
    },
  ];
}
