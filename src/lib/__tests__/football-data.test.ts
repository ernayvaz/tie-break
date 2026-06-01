import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_API_KEY = process.env.FOOTBALL_DATA_ORG_API_KEY;

afterEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
  if (ORIGINAL_API_KEY === undefined) {
    delete process.env.FOOTBALL_DATA_ORG_API_KEY;
  } else {
    process.env.FOOTBALL_DATA_ORG_API_KEY = ORIGINAL_API_KEY;
  }
});

describe("football-data match sync client", () => {
  it("returns a source-aware error when football-data.org responds with non-JSON text", async () => {
    process.env.FOOTBALL_DATA_ORG_API_KEY = "test-token";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("Your account is temporarily unavailable.", {
          status: 500,
          statusText: "Internal Server Error",
          headers: { "content-type": "text/plain" },
        }),
      ),
    );

    const { fetchUclMatches } = await import("../api/football-data");
    const result = await fetchUclMatches("CL", "2025");

    expect(result).toEqual({
      ok: false,
      error:
        'football-data.org returned a non-JSON response (HTTP 500 Internal Server Error): "Your account is temporarily unavailable.". Check FOOTBALL_DATA_ORG_API_KEY account access, subscription limits, or competition/season permissions.',
    });
  });

  it("retries without season when account access is restricted to current season data", async () => {
    process.env.FOOTBALL_DATA_ORG_API_KEY = "test-token";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("Your account is restricted to current season resources.", {
          status: 403,
          statusText: "Forbidden",
          headers: { "content-type": "text/plain" },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          matches: [
            {
              id: 2,
              utcDate: "2026-06-01T20:00:00Z",
              status: "FINISHED",
              homeTeam: { id: 10, name: "Home" },
              awayTeam: { id: 11, name: "Away" },
              score: {
                duration: "REGULAR",
                fullTime: { homeTeam: 3, awayTeam: 0 },
              },
            },
          ],
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { fetchUclMatches } = await import("../api/football-data");
    const result = await fetchUclMatches("CL", "2025");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.matches[0].id).toBe(2);
    }
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.football-data.org/v4/competitions/CL/matches?season=2025",
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.football-data.org/v4/competitions/CL/matches",
      expect.any(Object),
    );
  });

  it("does not turn missing score values into a 0-0 result", async () => {
    const { getResultTypeFromScore, getScoreFromApi } = await import("../api/football-data");

    const score = {
      duration: "REGULAR" as const,
      fullTime: { homeTeam: null, awayTeam: null },
    };

    expect(getResultTypeFromScore(score)).toBeNull();
    expect(getScoreFromApi(score)).toBeNull();
  });

  it("falls back to the current competition endpoint when a season does not exist", async () => {
    process.env.FOOTBALL_DATA_ORG_API_KEY = "test-token";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          { message: "The resource you are looking for does not exist." },
          { status: 404 },
        ),
      )
      .mockResolvedValueOnce(
        Response.json({
          matches: [
            {
              id: 1,
              utcDate: "2026-06-01T20:00:00Z",
              status: "FINISHED",
              homeTeam: { id: 10, name: "Home" },
              awayTeam: { id: 11, name: "Away" },
              score: {
                duration: "REGULAR",
                fullTime: { homeTeam: 2, awayTeam: 1 },
              },
            },
          ],
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { fetchUclMatches } = await import("../api/football-data");
    const result = await fetchUclMatches("CL", "2099");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].id).toBe(1);
    }
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.football-data.org/v4/competitions/CL/matches?season=2099",
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.football-data.org/v4/competitions/CL/matches",
      expect.any(Object),
    );
  });
});
