import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-user";
import {
  getLiveMatchStates,
  type LiveMatchCandidate,
} from "@/lib/live-match-states";

function toCandidate(value: unknown): LiveMatchCandidate | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Record<string, unknown>;
  if (typeof candidate.id !== "string") return null;

  return {
    id: candidate.id,
    competitionId:
      typeof candidate.competitionId === "string" ? candidate.competitionId : null,
    externalApiId:
      typeof candidate.externalApiId === "string" ? candidate.externalApiId : null,
  };
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const rawMatches = Array.isArray((body as { matches?: unknown[] })?.matches)
    ? (body as { matches: unknown[] }).matches
    : [];
  const matches = rawMatches
    .map(toCandidate)
    .filter((candidate): candidate is LiveMatchCandidate => candidate !== null)
    .slice(0, 200);

  const liveByMatchId = await getLiveMatchStates(matches);

  return Response.json({
    ok: true,
    liveByMatchId,
    fetchedAt: new Date().toISOString(),
  });
}
