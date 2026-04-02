import { describe, expect, it } from "vitest";
import { buildParticipantPickerLabelMap } from "@/lib/halisaha/participant-picker-labels";

describe("buildParticipantPickerLabelMap", () => {
  it("keeps the plain display name when it is unique", () => {
    const labels = buildParticipantPickerLabelMap([
      {
        id: "p1",
        displayName: "Ada Yilmaz",
        teamSide: "home",
        positionLabel: "Striker",
      },
    ]);

    expect(labels.get("p1")).toBe("Ada Yilmaz");
  });

  it("adds the position label when the same display name appears twice", () => {
    const labels = buildParticipantPickerLabelMap([
      {
        id: "p1",
        displayName: "Ege Ozturk",
        teamSide: "home",
        positionLabel: "Left wing",
      },
      {
        id: "p2",
        displayName: "Ege Ozturk",
        teamSide: "home",
        positionLabel: "Center midfield",
      },
    ]);

    expect(labels.get("p1")).toBe("Ege Ozturk · Left wing");
    expect(labels.get("p2")).toBe("Ege Ozturk · Center midfield");
  });

  it("adds team and position when name and position both collide", () => {
    const labels = buildParticipantPickerLabelMap([
      {
        id: "p1",
        displayName: "Arda Tuna",
        teamSide: "home",
        positionLabel: "Striker",
      },
      {
        id: "p2",
        displayName: "Arda Tuna",
        teamSide: "away",
        positionLabel: "Striker",
      },
    ]);

    expect(labels.get("p1")).toBe("Arda Tuna · Home Striker");
    expect(labels.get("p2")).toBe("Arda Tuna · Away Striker");
  });
});
