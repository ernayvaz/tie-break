import { describe, expect, it } from "vitest";
import { composeHalisahaCumulativeLeaderboard } from "@/lib/halisaha/leaderboard";

const ans = (id: string, status: "correct" | "incorrect" | "pending", label: string) => ({
  id,
  status,
  label,
});

describe("composeHalisahaCumulativeLeaderboard (MVP + round snapshots)", () => {
  it("returns empty leaderboard when there are no rounds and no MVP-only users", () => {
    expect(composeHalisahaCumulativeLeaderboard([], new Map(), [])).toEqual([]);
  });

  it("adds MVP wins into total fun points and exposes the MVP count", () => {
    const rows = composeHalisahaCumulativeLeaderboard(
      [
        {
          userId: "u1",
          name: "Ada",
          surname: "Yilmaz",
          totalPoints: 4,
          correctAnswers: 4,
          answeredQuestions: 5,
          recentAnswers: [ans("a1", "correct", "Q1")],
        },
      ],
      new Map([["u1", 2]]),
      [],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: "u1",
      totalPoints: 6,
      correctAnswers: 4,
      answeredQuestions: 5,
      mvpWins: 2,
      rank: 1,
    });
  });

  it("defaults mvpWins to 0 when user is absent from the MVP map", () => {
    const rows = composeHalisahaCumulativeLeaderboard(
      [
        {
          userId: "u1",
          name: "Ada",
          surname: "Yilmaz",
          totalPoints: 1,
          correctAnswers: 1,
          answeredQuestions: 1,
          recentAnswers: [],
        },
      ],
      new Map(),
      [],
    );

    expect(rows[0]?.mvpWins).toBe(0);
  });

  it("merges multiple round snapshots for the same user then applies a single MVP count", () => {
    const rows = composeHalisahaCumulativeLeaderboard(
      [
        {
          userId: "u1",
          name: "Ada",
          surname: "Yilmaz",
          totalPoints: 3,
          correctAnswers: 3,
          answeredQuestions: 4,
          recentAnswers: [ans("r1", "correct", "R1")],
        },
        {
          userId: "u1",
          name: "Ada",
          surname: "Yilmaz",
          totalPoints: 2,
          correctAnswers: 1,
          answeredQuestions: 3,
          recentAnswers: [ans("r2", "incorrect", "R2")],
        },
      ],
      new Map([["u1", 3]]),
      [],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: "u1",
      totalPoints: 8,
      correctAnswers: 4,
      answeredQuestions: 7,
      mvpWins: 3,
    });
  });

  it("adds MVP-only rows for users with awards but no leaderboard round snapshot", () => {
    const rows = composeHalisahaCumulativeLeaderboard(
      [
        {
          userId: "u1",
          name: "Ada",
          surname: "Yilmaz",
          totalPoints: 10,
          correctAnswers: 5,
          answeredQuestions: 8,
          recentAnswers: [],
        },
      ],
      new Map([
        ["u1", 0],
        ["u2", 1],
      ]),
      [{ userId: "u2", name: "Bora", surname: "Kaya" }],
    );

    expect(rows.map((r) => r.userId).sort()).toEqual(["u1", "u2"]);
    const bora = rows.find((r) => r.userId === "u2");
    expect(bora).toMatchObject({
      userId: "u2",
      name: "Bora",
      surname: "Kaya",
      totalPoints: 1,
      correctAnswers: 0,
      answeredQuestions: 0,
      mvpWins: 1,
    });
  });

  it("does not duplicate MVP-only row if profile user already appears in merged rounds", () => {
    const rows = composeHalisahaCumulativeLeaderboard(
      [
        {
          userId: "u1",
          name: "Ada",
          surname: "Yilmaz",
          totalPoints: 2,
          correctAnswers: 2,
          answeredQuestions: 2,
          recentAnswers: [],
        },
      ],
      new Map([["u1", 1]]),
      [{ userId: "u1", name: "Ada", surname: "Yilmaz" }],
    );

    expect(rows.filter((r) => r.userId === "u1")).toHaveLength(1);
    expect(rows[0]?.mvpWins).toBe(1);
  });

  it("omits MVP-only users when no profile is supplied (same as DB returning no row)", () => {
    const rows = composeHalisahaCumulativeLeaderboard(
      [],
      new Map([["ghost", 1]]),
      [],
    );

    expect(rows).toHaveLength(0);
  });

  it("uses MVP wins as fun points, so extra MVPs can move a player ahead", () => {
    const rows = composeHalisahaCumulativeLeaderboard(
      [
        {
          userId: "u-bora",
          name: "Bora",
          surname: "Kaya",
          totalPoints: 10,
          correctAnswers: 8,
          answeredQuestions: 10,
          recentAnswers: [],
        },
        {
          userId: "u-ada",
          name: "Ada",
          surname: "Yilmaz",
          totalPoints: 10,
          correctAnswers: 8,
          answeredQuestions: 10,
          recentAnswers: [],
        },
      ],
      new Map([
        ["u-bora", 99],
        ["u-ada", 0],
      ]),
      [],
    );

    expect(rows[0]?.userId).toBe("u-bora");
    expect(rows[1]?.userId).toBe("u-ada");
    expect(rows[0]?.totalPoints).toBe(109);
    expect(rows[0]?.mvpWins).toBe(99);
    expect(rows[1]?.mvpWins).toBe(0);
  });

  it("ranks by points first, then correct answers, then answered count, then name", () => {
    const rows = composeHalisahaCumulativeLeaderboard(
      [
        {
          userId: "c",
          name: "Cem",
          surname: "Acar",
          totalPoints: 5,
          correctAnswers: 5,
          answeredQuestions: 5,
          recentAnswers: [],
        },
        {
          userId: "a",
          name: "Ada",
          surname: "Yilmaz",
          totalPoints: 6,
          correctAnswers: 4,
          answeredQuestions: 8,
          recentAnswers: [],
        },
        {
          userId: "b",
          name: "Bora",
          surname: "Kaya",
          totalPoints: 6,
          correctAnswers: 5,
          answeredQuestions: 8,
          recentAnswers: [],
        },
      ],
      new Map(),
      [],
    );

    expect(rows.map((r) => r.userId)).toEqual(["b", "a", "c"]);
  });

  it("handles multiple users with independent MVP counts", () => {
    const rows = composeHalisahaCumulativeLeaderboard(
      [
        {
          userId: "u1",
          name: "Ada",
          surname: "Yilmaz",
          totalPoints: 1,
          correctAnswers: 1,
          answeredQuestions: 1,
          recentAnswers: [],
        },
        {
          userId: "u2",
          name: "Bora",
          surname: "Kaya",
          totalPoints: 2,
          correctAnswers: 2,
          answeredQuestions: 2,
          recentAnswers: [],
        },
      ],
      new Map([
        ["u1", 1],
        ["u2", 2],
      ]),
      [],
    );

    const byId = Object.fromEntries(rows.map((r) => [r.userId, r.mvpWins]));
    expect(byId).toEqual({ u2: 2, u1: 1 });
    expect(rows.find((r) => r.userId === "u1")?.totalPoints).toBe(2);
    expect(rows.find((r) => r.userId === "u2")?.totalPoints).toBe(4);
  });

  it("creates MVP-only row with mvpWins 0 when map entry is 0 (defensive)", () => {
    const rows = composeHalisahaCumulativeLeaderboard(
      [],
      new Map([["u9", 0]]),
      [{ userId: "u9", name: "Only", surname: "Mvp" }],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: "u9",
      mvpWins: 0,
      totalPoints: 0,
    });
  });

  it("keeps only the last five recent answer markers after ranking", () => {
    const recentAnswers = [1, 2, 3, 4, 5, 6, 7].map((n) =>
      ans(String(n), "correct" as const, `L${n}`),
    );
    const rows = composeHalisahaCumulativeLeaderboard(
      [
        {
          userId: "u1",
          name: "Ada",
          surname: "Yilmaz",
          totalPoints: 7,
          correctAnswers: 7,
          answeredQuestions: 7,
          recentAnswers,
        },
      ],
      new Map(),
      [],
    );

    expect(rows[0]?.recentAnswers.map((x) => x.id)).toEqual(["3", "4", "5", "6", "7"]);
  });
});
