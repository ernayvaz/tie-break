import { headers } from "next/headers";

/**
 * Best-effort client IP for rate limiting. Returns "anon" if unavailable.
 */
export async function getClientIpForRateLimit(): Promise<string> {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    if (forwarded) {
      const first = forwarded.split(",")[0]?.trim();
      if (first) return first;
    }
    const real = h.get("x-real-ip");
    if (real) return real.trim();
  } catch {
    // ignore
  }
  return "anon";
}
