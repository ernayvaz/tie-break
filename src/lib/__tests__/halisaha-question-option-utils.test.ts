import { describe, expect, it } from "vitest";
import {
  getHalisahaPlayerPickerChoiceOptions,
  getHalisahaPlayerPickerOptionGroups,
} from "@/lib/halisaha/question-option-utils";

describe("halisaha player picker option helpers", () => {
  it("uses synced squad players for custom player-picker questions", () => {
    const options = [
      {
        id: "placeholder",
        label: "Choose player",
        kind: "player_picker" as const,
        participantId: null,
        teamSide: null,
        sortOrder: 100,
      },
      {
        id: "manual-1",
        label: "No man",
        kind: "standard" as const,
        participantId: null,
        teamSide: null,
        sortOrder: 110,
      },
      {
        id: "home-player",
        label: "Ahmet Dursun",
        kind: "standard" as const,
        participantId: "participant-home",
        teamSide: "home" as const,
        sortOrder: 120,
      },
      {
        id: "away-player",
        label: "Doğukan Ayaz",
        kind: "standard" as const,
        participantId: "participant-away",
        teamSide: "away" as const,
        sortOrder: 130,
      },
    ];

    expect(getHalisahaPlayerPickerChoiceOptions("standard", options)).toEqual([
      options[2],
      options[3],
    ]);
    expect(getHalisahaPlayerPickerOptionGroups("standard", options)).toEqual([
      {
        label: "Home team",
        options: [options[2]],
      },
      {
        label: "Away team",
        options: [options[3]],
      },
    ]);
  });

  it("keeps MVP picker choices grouped by team", () => {
    const options = [
      {
        id: "home-player",
        label: "Ahmet Dursun",
        kind: "standard" as const,
        participantId: "participant-home",
        teamSide: "home" as const,
        sortOrder: 100,
      },
      {
        id: "away-player",
        label: "Doğukan Ayaz",
        kind: "standard" as const,
        participantId: "participant-away",
        teamSide: "away" as const,
        sortOrder: 110,
      },
      {
        id: "manual-option",
        label: "No vote",
        kind: "standard" as const,
        participantId: null,
        teamSide: null,
        sortOrder: 120,
      },
    ];

    expect(getHalisahaPlayerPickerChoiceOptions("mvp_prediction", options)).toEqual([
      options[0],
      options[1],
    ]);
    expect(getHalisahaPlayerPickerOptionGroups("mvp_prediction", options)).toEqual([
      {
        label: "Home team",
        options: [options[0]],
      },
      {
        label: "Away team",
        options: [options[1]],
      },
    ]);
  });
});
