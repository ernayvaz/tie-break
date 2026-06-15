import { NextRequest } from "next/server";
import { syncMatchesFromApi } from "@/lib/api/sync-matches";
import { syncWorldCupResultsFromOpenLigaDb } from "@/lib/api/sync-wc-results";
import { recalculateAll } from "@/lib/scoring";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (secret && authHeader !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  // football-data.org is the primary provider, but while it is unavailable its
  // failure must not block the World Cup results pipeline. Treat it as best-effort.
  const footballData = await syncMatchesFromApi();

  // World Cup 2026 results come from OpenLigaDB (free, key-less) for now.
  const worldCup = await syncWorldCupResultsFromOpenLigaDb();

  // Recalculate scores + leaderboard from whatever results are now stored.
  const recalc = await recalculateAll();
  if (!recalc.ok) {
    return Response.json(
      {
        ok: false,
        stage: "recalculate",
        error: recalc.error,
        footballData: footballData.ok ? { matchesSynced: footballData.count } : { error: footballData.error },
        worldCup,
      },
      { status: 500 }
    );
  }

  return Response.json({
    ok: true,
    footballData: footballData.ok
      ? { matchesSynced: footballData.count }
      : { error: footballData.error },
    worldCup,
    matchesScored: recalc.matchesScored,
    leaderboardUpdated: recalc.leaderboardCount,
  });
}
