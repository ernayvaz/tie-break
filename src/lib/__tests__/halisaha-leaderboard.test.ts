import { describe, expect, it } from "vitest";
import {
  mergeHalisahaResultRowSeeds,
  rankHalisahaResultRows,
  type HalisahaResultRowSeed,
} from "@/lib/halisaha/leaderboard";

describe("halisaha/leaderboard", () => {
  it("merges multiple scored rounds for the same user", () => {
    const merged = mergeHalisahaResultRowSeeds([
      {
        userId: "user-1",
        name: "Ada",
        surname: "Yilmaz",
        totalPoints: 3,
        correctAnswers: 3,
        answeredQuestions: 5,
        recentAnswers: [
          {
            id: "r1-q1",
            status: "correct",
            label: "Round 1 - Correct",
          },
        ],
      },
      {
        userId: "user-1",
        name: "Ada",
        surname: "Yilmaz",
        totalPoints: 2,
        correctAnswers: 2,
        answeredQuestions: 4,
        recentAnswers: [
          {
            id: "r2-q1",
            status: "incorrect",
            label: "Round 2 - Incorrect",
          },
        ],
      },
    ]);

    expect(merged).toEqual([
      {
        userId: "user-1",
        name: "Ada",
        surname: "Yilmaz",
        totalPoints: 5,
        correctAnswers: 5,
        answeredQuestions: 9,
        mvpWins: 0,
        recentAnswers: [
          {
            id: "r1-q1",
            status: "correct",
            label: "Round 1 - Correct",
          },
          {
            id: "r2-q1",
            status: "incorrect",
            label: "Round 2 - Incorrect",
          },
        ],
      },
    ]);
  });

  it("sums mvpWins when merging multiple seeds for the same user", () => {
    const merged = mergeHalisahaResultRowSeeds([
      {
        userId: "user-1",
        name: "Ada",
        surname: "Yilmaz",
        totalPoints: 1,
        correctAnswers: 1,
        answeredQuestions: 1,
        mvpWins: 1,
        recentAnswers: [],
      },
      {
        userId: "user-1",
        name: "Ada",
        surname: "Yilmaz",
        totalPoints: 0,
        correctAnswers: 0,
        answeredQuestions: 0,
        mvpWins: 2,
        recentAnswers: [],
      },
    ]);

    expect(merged[0]?.mvpWins).toBe(3);
  });

  it("ranks cumulative rows by points, then hits, then answered questions", () => {
    const ranked = rankHalisahaResultRows([
      {
        userId: "user-1",
        name: "Ada",
        surname: "Yilmaz",
        totalPoints: 6,
        correctAnswers: 5,
        answeredQuestions: 9,
        recentAnswers: [],
      },
      {
        userId: "user-2",
        name: "Bora",
        surname: "Kaya",
        totalPoints: 6,
        correctAnswers: 4,
        answeredQuestions: 9,
        recentAnswers: [],
      },
      {
        userId: "user-3",
        name: "Cem",
        surname: "Acar",
        totalPoints: 5,
        correctAnswers: 5,
        answeredQuestions: 8,
        recentAnswers: [],
      },
    ]);

    expect(ranked.map((row) => [row.userId, row.rank, row.podiumPlace])).toEqual([
      ["user-1", 1, 1],
      ["user-2", 2, 2],
      ["user-3", 3, 3],
    ]);
    expect(ranked[0]?.accuracyLabel).toBe("56%");
  });

  it("keeps only the latest five answer markers after cumulative merge", () => {
    const seed: HalisahaResultRowSeed = {
      userId: "user-1",
      name: "Ada",
      surname: "Yilmaz",
      totalPoints: 7,
      correctAnswers: 7,
      answeredQuestions: 7,
      recentAnswers: [
        { id: "1", status: "correct", label: "A" },
        { id: "2", status: "correct", label: "B" },
        { id: "3", status: "correct", label: "C" },
        { id: "4", status: "correct", label: "D" },
        { id: "5", status: "correct", label: "E" },
        { id: "6", status: "correct", label: "F" },
        { id: "7", status: "correct", label: "G" },
      ],
    };

    const ranked = rankHalisahaResultRows([seed]);

    expect(ranked[0]?.recentAnswers.map((answer) => answer.id)).toEqual([
      "3",
      "4",
      "5",
      "6",
      "7",
    ]);
  });
});
