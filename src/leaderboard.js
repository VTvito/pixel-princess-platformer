// leaderboard.js — thin client for the global leaderboard (api/leaderboard.js).
//
// Both calls degrade GRACEFULLY: any failure (offline, endpoint missing, store not yet
// provisioned) resolves to `null` instead of throwing, so the finale and menu still work
// everywhere — including the Playwright tests, which serve the static files with no /api.
//
// The board is a HISTORY (every finished run is its own row, see api/leaderboard.js), so it is
// paged: both calls return a page object, never a bare array.
//   page = { rows: [{ id, name, time, score, rank }, …], total, offset, limit }

const ENDPOINT = "/api/leaderboard";

/** True for a well-formed page object from the endpoint. */
function isPage(data) {
  return !!data && Array.isArray(data.rows) && Number.isFinite(Number(data.total));
}

/**
 * Fetch one page of the standings (fastest first). `rank` on each row is GLOBAL, so page 3 is
 * positions 21…30. Resolves to `null` if the board is unavailable.
 */
export async function fetchTop({ offset = 0, limit = 10 } = {}) {
  try {
    const res = await fetch(`${ENDPOINT}?offset=${offset}&limit=${limit}`, { method: "GET" });
    if (!res.ok) return null;
    const data = await res.json();
    return isPage(data) ? data : null;
  } catch {
    return null;
  }
}

/**
 * Submit a time-attack result (net play time in ms + the run's score). EVERY submission is added
 * as its own row — a second run under the same nickname no longer replaces the first.
 *
 * On success resolves to the usual page object PLUS `id` (this run's unique id) and `rank` (its
 * global position, or `null` if the run was too slow to make the board) — and the page returned is
 * the one CONTAINING that row, so the caller can land the player on herself. `null` if unavailable.
 */
export async function submitScore({ nickname, score, timeMs, limit = 10 }) {
  try {
    const res = await fetch(`${ENDPOINT}?limit=${limit}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname, score, timeMs }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return isPage(data) ? data : null;
  } catch {
    return null;
  }
}
