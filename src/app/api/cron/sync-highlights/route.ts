import { NextRequest } from "next/server";
import { syncHighlightsFromApi } from "@/lib/api/sync-highlights";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (secret && authHeader !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await syncHighlightsFromApi();
  if (!result.ok) {
    return Response.json(
      {
        ok: false,
        stage: "sync_highlights",
        error: result.error,
      },
      { status: 500 }
    );
  }

  return Response.json({
    ok: true,
    fetchedCount: result.fetchedCount,
    matchedCount: result.matchedCount,
    storedCount: result.storedCount,
    staleCount: result.staleCount,
    unmatchedCount: result.unmatchedCount,
  });
}
