import { NextRequest } from "next/server";
import { syncMatchesFromApi } from "@/lib/api/sync-matches";
import { recalculateAll } from "@/lib/scoring";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (secret && authHeader !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const sync = await syncMatchesFromApi();
  if (!sync.ok) {
    return Response.json(
      { ok: false, stage: "sync", error: sync.error },
      { status: 500 }
    );
  }

  const recalc = await recalculateAll();
  if (!recalc.ok) {
    return Response.json(
      {
        ok: false,
        stage: "recalculate",
        error: recalc.error,
        matchesSynced: sync.count,
      },
      { status: 500 }
    );
  }

  return Response.json({
    ok: true,
    matchesSynced: sync.count,
    matchesScored: recalc.matchesScored,
    leaderboardUpdated: recalc.leaderboardCount,
  });
}

