import { NextRequest } from "next/server";
import { syncHighlightsFromApi } from "@/lib/api/sync-highlights";
import { syncWorldCupYoutubeHighlights } from "@/lib/api/sync-youtube-highlights";
import { hasYoutubeApiKey } from "@/lib/providers/youtube-highlights";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (secret && authHeader !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  // ScoreBat highlights (Champions League + any World Cup it can match).
  const result = await syncHighlightsFromApi();

  // Official FIFA World Cup highlights from YouTube (only when a key is configured).
  const youtube = hasYoutubeApiKey()
    ? await syncWorldCupYoutubeHighlights()
    : { ok: false as const, error: "YOUTUBE_API_KEY not configured (skipped)." };

  if (!result.ok) {
    return Response.json(
      { ok: false, stage: "sync_highlights", error: result.error, youtube },
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
    youtube,
  });
}
