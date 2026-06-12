import { describe, expect, it } from "vitest";
import {
  normalizeTeamName,
  parseScoreBatTitle,
  resolveHighlightMatch,
} from "@/lib/highlights/match-resolution";

describe("highlights/match-resolution", () => {
  it("normalizes common club suffixes and punctuation", () => {
    expect(normalizeTeamName("FC Bayern München")).toBe("bayern munich");
    expect(normalizeTeamName("Paris Saint-Germain")).toBe("paris saint germain");
  });

  it("parses ScoreBat titles without a scoreline", () => {
    expect(parseScoreBatTitle("Real Madrid - Arsenal")).toEqual({
      homeTeamName: "Real Madrid",
      homeScore: null,
      awayScore: null,
      awayTeamName: "Arsenal",
    });
  });

  it("parses ScoreBat titles with a scoreline", () => {
    expect(parseScoreBatTitle("Inter 2-1 Barcelona")).toEqual({
      homeTeamName: "Inter",
      homeScore: 2,
      awayScore: 1,
      awayTeamName: "Barcelona",
    });
  });

  it("matches the correct Champions League fixture", () => {
    const resolution = resolveHighlightMatch({
      title: "FC Bayern Munchen - Arsenal FC",
      competition: "EUROPE: Champions League, Quarter-finals",
      publishedAt: "2026-04-08T20:00:00.000Z",
      matches: [
        {
          id: "match-1",
          competitionId: "CL",
          matchDatetime: "2026-04-08T20:00:00.000Z",
          homeTeamName: "Bayern Munich",
          awayTeamName: "Arsenal",
          stage: "QUARTER_FINAL",
        },
        {
          id: "match-2",
          competitionId: "CL",
          matchDatetime: "2026-04-09T20:00:00.000Z",
          homeTeamName: "Barcelona",
          awayTeamName: "Inter",
          stage: "QUARTER_FINAL",
        },
      ],
    });

    expect(resolution?.candidate.id).toBe("match-1");
    expect(resolution?.mode).toBe("exact");
  });

  it("uses scoreline when available to reject the wrong fixture", () => {
    const resolution = resolveHighlightMatch({
      title: "Inter 2-1 Barcelona",
      competition: "EUROPE: Champions League, Semi-finals",
      publishedAt: "2026-05-06T20:00:00.000Z",
      matches: [
        {
          id: "wrong",
          competitionId: "CL",
          matchDatetime: "2026-05-06T20:00:00.000Z",
          homeTeamName: "Inter",
          awayTeamName: "Barcelona",
          homeScore: 1,
          awayScore: 1,
          stage: "SEMI_FINAL",
        },
        {
          id: "correct",
          competitionId: "CL",
          matchDatetime: "2026-05-06T20:00:00.000Z",
          homeTeamName: "Inter Milan",
          awayTeamName: "FC Barcelona",
          homeScore: 2,
          awayScore: 1,
          stage: "SEMI_FINAL",
        },
      ],
    });

    expect(resolution?.candidate.id).toBe("correct");
  });

  it("ignores non-tracked competitions", () => {
    const resolution = resolveHighlightMatch({
      title: "Liverpool - Chelsea",
      competition: "ENGLAND: Premier League",
      publishedAt: "2026-03-01T15:00:00.000Z",
      matches: [
        {
          id: "match-1",
          competitionId: "CL",
          matchDatetime: "2026-03-01T15:00:00.000Z",
          homeTeamName: "Liverpool",
          awayTeamName: "Chelsea",
          stage: "GROUP_STAGE",
        },
      ],
    });

    expect(resolution).toBeNull();
  });

  it("matches a World Cup clip to a World Cup fixture", () => {
    const resolution = resolveHighlightMatch({
      title: "Mexico 2-0 South Africa",
      competition: "WORLD: World Cup",
      publishedAt: "2026-06-11T22:00:00.000Z",
      matches: [
        {
          id: "wc-match",
          competitionId: "WC",
          matchDatetime: "2026-06-11T22:00:00.000Z",
          homeTeamName: "Mexico",
          awayTeamName: "South Africa",
          homeScore: 2,
          awayScore: 0,
          stage: "GROUP_STAGE",
        },
      ],
    });

    expect(resolution?.candidate.id).toBe("wc-match");
  });

  it("does not bind a Premier League clip to a same-day Champions League fixture", () => {
    const resolution = resolveHighlightMatch({
      title: "Liverpool 1-0 Chelsea",
      competition: "ENGLAND: Premier League",
      publishedAt: "2026-03-01T15:00:00.000Z",
      matches: [
        {
          id: "cl-same-teams",
          competitionId: "CL",
          matchDatetime: "2026-03-01T15:00:00.000Z",
          homeTeamName: "Liverpool",
          awayTeamName: "Chelsea",
          homeScore: 1,
          awayScore: 0,
          stage: "GROUP_STAGE",
        },
      ],
    });

    expect(resolution).toBeNull();
  });

  it("does not bind a World Cup clip to a Champions League fixture", () => {
    const resolution = resolveHighlightMatch({
      title: "Mexico - South Africa",
      competition: "WORLD: World Cup",
      publishedAt: "2026-06-11T22:00:00.000Z",
      matches: [
        {
          id: "cl-only",
          competitionId: "CL",
          matchDatetime: "2026-06-11T22:00:00.000Z",
          homeTeamName: "Mexico",
          awayTeamName: "South Africa",
          stage: "GROUP_STAGE",
        },
      ],
    });

    expect(resolution).toBeNull();
  });
});
