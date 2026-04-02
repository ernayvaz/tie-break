export type HalisahaRecentAnswerStatus = "correct" | "incorrect" | "pending";

export type HalisahaRecentAnswerRow = {
  id: string;
  status: HalisahaRecentAnswerStatus;
  label: string;
};

export type HalisahaResultRow = {
  userId: string;
  name: string;
  surname: string;
  totalPoints: number;
  correctAnswers: number;
  answeredQuestions: number;
  /** Community MVP selections across all completed Halisaha rounds (registered users only). */
  mvpWins: number;
  accuracyLabel: string;
  rank: number;
  podiumPlace?: 1 | 2 | 3;
  recentAnswers: HalisahaRecentAnswerRow[];
};

/** Seed rows may omit `mvpWins`; merge treats missing as 0. */
export type HalisahaResultRowSeed = Omit<
  HalisahaResultRow,
  "accuracyLabel" | "rank" | "podiumPlace" | "mvpWins"
> & {
  mvpWins?: number;
};

/** One persisted `HalisahaLeaderboardRound` row before MVP bonus points are applied. */
export type HalisahaRoundSnapshotRow = {
  userId: string;
  name: string;
  surname: string;
  totalPoints: number;
  correctAnswers: number;
  answeredQuestions: number;
  recentAnswers: HalisahaRecentAnswerRow[];
};

/**
 * Merges round snapshots, attaches `mvpWins` from `HalisahaMvpRoundAward` counts,
 * adds +1 fun point per MVP win,
 * appends MVP-only users (awards but no round row), then ranks.
 * This is the pure core of `getHalisahaLeaderboardResults` in server.ts.
 */
export function composeHalisahaCumulativeLeaderboard(
  roundSnapshots: readonly HalisahaRoundSnapshotRow[],
  mvpWinCountByUserId: ReadonlyMap<string, number>,
  mvpOnlyProfiles: readonly { userId: string; name: string; surname: string }[],
): HalisahaResultRow[] {
  const merged = mergeHalisahaResultRowSeeds(
    roundSnapshots.map((row) => ({
      ...row,
      mvpWins: 0,
    })),
  );

  const mergedWithMvp = merged.map((row) => {
    const mvpWins = mvpWinCountByUserId.get(row.userId) ?? 0;
    return {
      ...row,
      totalPoints: row.totalPoints + mvpWins,
      mvpWins,
    };
  });

  const seenUserIds = new Set(mergedWithMvp.map((row) => row.userId));

  const mvpOnlySeeds: HalisahaResultRowSeed[] = [];
  for (const profile of mvpOnlyProfiles) {
    if (seenUserIds.has(profile.userId)) {
      continue;
    }
    const wins = mvpWinCountByUserId.get(profile.userId) ?? 0;
    mvpOnlySeeds.push({
      userId: profile.userId,
      name: profile.name,
      surname: profile.surname,
      totalPoints: wins,
      correctAnswers: 0,
      answeredQuestions: 0,
      mvpWins: wins,
      recentAnswers: [],
    });
  }

  return rankHalisahaResultRows([...mergedWithMvp, ...mvpOnlySeeds]);
}

export function mergeHalisahaResultRowSeeds(seeds: HalisahaResultRowSeed[]) {
  const byUser = new Map<string, HalisahaResultRowSeed>();

  for (const seed of seeds) {
    const existing = byUser.get(seed.userId);
    if (!existing) {
      byUser.set(seed.userId, {
        ...seed,
        mvpWins: seed.mvpWins ?? 0,
        recentAnswers: [...seed.recentAnswers],
      });
      continue;
    }

    existing.totalPoints += seed.totalPoints;
    existing.correctAnswers += seed.correctAnswers;
    existing.answeredQuestions += seed.answeredQuestions;
    existing.mvpWins = (existing.mvpWins ?? 0) + (seed.mvpWins ?? 0);
    existing.recentAnswers.push(...seed.recentAnswers);
  }

  return [...byUser.values()];
}

export function rankHalisahaResultRows(seeds: HalisahaResultRowSeed[]): HalisahaResultRow[] {
  const rows = seeds
    .map((seed) => ({
      ...seed,
      mvpWins: seed.mvpWins ?? 0,
      recentAnswers: [...seed.recentAnswers],
      accuracyLabel: "–",
      rank: 0,
      podiumPlace: undefined as 1 | 2 | 3 | undefined,
    }))
    .sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.correctAnswers !== a.correctAnswers) return b.correctAnswers - a.correctAnswers;
      if (b.answeredQuestions !== a.answeredQuestions) {
        return b.answeredQuestions - a.answeredQuestions;
      }
      return `${a.name} ${a.surname}`.localeCompare(`${b.name} ${b.surname}`);
    });

  rows.forEach((row, index) => {
    row.accuracyLabel =
      row.answeredQuestions > 0
        ? `${Math.round((row.correctAnswers / row.answeredQuestions) * 100)}%`
        : "–";
    row.rank = index + 1;
    row.podiumPlace = index < 3 ? ((index + 1) as 1 | 2 | 3) : undefined;
    row.recentAnswers = row.recentAnswers.slice(-5);
  });

  return rows;
}
