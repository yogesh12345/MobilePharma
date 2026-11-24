export const IDLE_LIMIT_MS = 10 * 60 * 1000;
export const LAST_ACTIVITY_KEY = "pharmasys:last-interaction";

let fallbackLastActivity: number | null = null;

export function lastInteraction(): number | null {
  try {
    const value = Number(localStorage.getItem(LAST_ACTIVITY_KEY));
    if (Number.isFinite(value) && value > 0) return value;
  } catch { /* Use the in-memory value when storage is unavailable. */ }
  return fallbackLastActivity;
}

export function recordInteraction(now = Date.now()) {
  fallbackLastActivity = now;
  try { localStorage.setItem(LAST_ACTIVITY_KEY, String(now)); }
  catch { /* The current session still has an in-memory deadline. */ }
}

export function ensureInteractionTime(now = Date.now()) {
  const last = lastInteraction();
  if (last !== null && last <= now) return last;
  recordInteraction(now);
  return now;
}

export function idleExpired(now = Date.now()) {
  const last = lastInteraction();
  return last !== null && now - last >= IDLE_LIMIT_MS;
}

export function clearInteractionTime() {
  fallbackLastActivity = null;
  try { localStorage.removeItem(LAST_ACTIVITY_KEY); }
  catch { /* Nothing else to clear. */ }
}
