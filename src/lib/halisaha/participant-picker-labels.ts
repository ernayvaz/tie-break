import type { HalisahaTeamSide } from "@prisma/client";

export type ParticipantPickerLabelRow = {
  id: string;
  displayName: string;
  teamSide: HalisahaTeamSide | null;
  positionLabel: string | null;
};

function normalizeLabelPart(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

function getTeamLabel(teamSide: HalisahaTeamSide | null) {
  if (teamSide === "home") return "Home";
  if (teamSide === "away") return "Away";
  return null;
}

export function buildParticipantPickerLabelMap(
  participants: readonly ParticipantPickerLabelRow[],
): Map<string, string> {
  const displayNameCounts = new Map<string, number>();
  const displayNamePositionCounts = new Map<string, number>();

  for (const participant of participants) {
    const displayNameKey = normalizeLabelPart(participant.displayName);
    displayNameCounts.set(displayNameKey, (displayNameCounts.get(displayNameKey) ?? 0) + 1);

    const positionKey = participant.positionLabel ? normalizeLabelPart(participant.positionLabel) : "";
    const compositeKey = `${displayNameKey}::${positionKey}`;
    displayNamePositionCounts.set(
      compositeKey,
      (displayNamePositionCounts.get(compositeKey) ?? 0) + 1,
    );
  }

  return new Map(
    participants.map((participant) => {
      const displayName = participant.displayName.trim().replace(/\s+/g, " ");
      const displayNameKey = normalizeLabelPart(displayName);

      if ((displayNameCounts.get(displayNameKey) ?? 0) <= 1) {
        return [participant.id, displayName];
      }

      const positionLabel = participant.positionLabel?.trim().replace(/\s+/g, " ") ?? null;
      const positionKey = positionLabel ? normalizeLabelPart(positionLabel) : "";
      const compositeKey = `${displayNameKey}::${positionKey}`;
      if (positionLabel && (displayNamePositionCounts.get(compositeKey) ?? 0) <= 1) {
        return [participant.id, `${displayName} · ${positionLabel}`];
      }

      const teamLabel = getTeamLabel(participant.teamSide);
      if (positionLabel && teamLabel) {
        return [participant.id, `${displayName} · ${teamLabel} ${positionLabel}`];
      }
      if (positionLabel) {
        return [participant.id, `${displayName} · ${positionLabel}`];
      }
      if (teamLabel) {
        return [participant.id, `${displayName} · ${teamLabel}`];
      }

      return [participant.id, displayName];
    }),
  );
}
