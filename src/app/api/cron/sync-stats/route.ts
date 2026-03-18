import { NextRequest } from "next/server";
import { syncMatchStatisticsCache } from "@/lib/api/sync-match-stats";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (secret && authHeader !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await syncMatchStatisticsCache();
  if (!result.ok) {
    return Response.json(
      {
        ok: false,
        stage: "sync_statistics",
        error: result.error,
      },
      { status: 500 }
    );
  }

  return Response.json({
    ok: true,
    targetCount: result.targetCount,
    syncedCount: result.syncedCount,
    unavailableCount: result.unavailableCount,
  });
}
