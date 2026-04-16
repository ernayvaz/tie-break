import { describe, expect, it } from "vitest";
import type { HalisahaAdminParticipantRow } from "@/lib/halisaha/server";
import { groupHalisahaAdminParticipantsByTeam } from "@/lib/halisaha/admin-participant-groups";

function createParticipant(
  overrides: Partial<HalisahaAdminParticipantRow> & Pick<HalisahaAdminParticipantRow, "id" | "displayName">,
): HalisahaAdminParticipantRow {
  return {
    id: overrides.id,
    userId: null,
    guestId: null,
    guestName: null,
    defaultDisplayName: overrides.displayName,
    displayNameOverride: null,
    displayName: overrides.displayName,
    isGuest: false,
    teamSide: null,
    positionKey: null,
    positionLabel: null,
    displayOrder: 0,
    ...overrides,
  };
}

describe("groupHalisahaAdminParticipantsByTeam", () => {
  it("splits the squad into home, away and unassigned sections while keeping order", () => {
    const participants = [
      createParticipant({
        id: "home-1",
        displayName: "Home Captain",
        teamSide: "home",
        displayOrder: 10,
      }),
      createParticipant({
        id: "away-1",
        displayName: "Away Captain",
        teamSide: "away",
        displayOrder: 20,
      }),
      createParticipant({
        id: "bench-1",
        displayName: "Bench Player",
        teamSide: null,
        displayOrder: 30,
      }),
      createParticipant({
        id: "home-2",
        displayName: "Home Winger",
        teamSide: "home",
        displayOrder: 40,
      }),
    ];

    expect(
      groupHalisahaAdminParticipantsByTeam({
        participants,
        homeTeamName: "Flexera Club",
        awayTeamName: "RayNET Glory",
      }),
    ).toEqual([
      {
        key: "home",
        title: "Flexera Club squad",
        emptyMessage: "No players or guests are assigned to Flexera Club yet.",
        participants: [participants[0], participants[3]],
      },
      {
        key: "away",
        title: "RayNET Glory squad",
        emptyMessage: "No players or guests are assigned to RayNET Glory yet.",
        participants: [participants[1]],
      },
      {
        key: "unassigned",
        title: "Unassigned players and guests",
        emptyMessage: "Everyone in the squad has already been assigned to a team.",
        participants: [participants[2]],
      },
    ]);
  });
});
