// leaderboard.js — thin client for the global leaderboard (api/leaderboard.js).
//
// Both calls degrade GRACEFULLY: any failure (offline, endpoint missing, store not yet
// provisioned) resolves to `null` instead of throwing, so the finale and menu still work
// everywhere — including the Playwright tests, which serve the static files with no /api.

const ENDPOINT = "/api/leaderboard";

/** Fetch the current top 10 as `[{ name, score }, …]`, or `null` if unavailable. */
export async function fetchTop() {
  try {
    const res = await fetch(ENDPOINT, { method: "GET" });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data.top) ? data.top : null;
  } catch {
    return null;
  }
}

/**
 * Submit a score. Returns the updated top 10 on success, or `null` if unavailable.
 * The backend keeps the BEST score per nickname, so re-submitting is harmless.
 */
export async function submitScore({ nickname, score, character }) {
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname, score, character }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data.top) ? data.top : null;
  } catch {
    return null;
  }
}
