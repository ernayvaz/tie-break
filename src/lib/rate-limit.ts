/**
 * In-memory rate limiter for login/register. Single-instance only.
 * For multi-instance deploy, use Redis or similar.
 */

type Entry = { count: number; resetAt: number };

const store = new Map<string, Entry>();

const WINDOW_MS_LOGIN = 15 * 60 * 1000;   // 15 minutes
const MAX_LOGIN_ATTEMPTS = 5;
const WINDOW_MS_REGISTER = 60 * 60 * 1000; // 1 hour
const MAX_REGISTER_ATTEMPTS = 10;

function getOrCreate(key: string, windowMs: number): Entry {
  const now = Date.now();
  const existing = store.get(key);
  if (existing) {
    if (now >= existing.resetAt) {
      const entry: Entry = { count: 0, resetAt: now + windowMs };
      store.set(key, entry);
      return entry;
    }
    return existing;
  }
  const entry: Entry = { count: 0, resetAt: now + windowMs };
  store.set(key, entry);
  return entry;
}

/**
 * Returns true if the attempt is allowed, false if rate limit exceeded.
 * Call this before processing login; it increments the counter.
 */
export function checkLoginRateLimit(key: string): boolean {
  const entry = getOrCreate(`login:${key}`, WINDOW_MS_LOGIN);
  entry.count++;
  if (entry.count > MAX_LOGIN_ATTEMPTS) return false;
  return true;
}

/**
 * Returns true if the attempt is allowed, false if rate limit exceeded.
 * Call this before processing register; it increments the counter.
 */
export function checkRegisterRateLimit(key: string): boolean {
  const entry = getOrCreate(`register:${key}`, WINDOW_MS_REGISTER);
  entry.count++;
  if (entry.count > MAX_REGISTER_ATTEMPTS) return false;
  return true;
}
