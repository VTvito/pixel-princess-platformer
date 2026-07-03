// format.js — tiny shared formatting helpers.
//
// formatDuration turns a run's net play time (milliseconds) into a compact "M:SS" clock, used
// by the in-game HUD timer (src/scenes/game.js), the finale receipt (src/ui/receipt.js) and the
// leaderboard rows (src/ui/leaderboard.js). It uses ONLY digits and a colon, so it renders fine
// in the pixel UI font (which has no emoji/★ glyphs) — no per-object sans-serif override needed.

/**
 * Format a duration in milliseconds as "M:SS" (minutes uncapped, seconds zero-padded).
 * Past an hour it rolls over to "H:MM:SS". Non-finite / negative input reads as 0:00.
 * @param {number} ms
 * @returns {string}
 */
export function formatDuration(ms) {
  const totalSec = Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0;
  const s = totalSec % 60;
  const m = Math.floor(totalSec / 60) % 60;
  const h = Math.floor(totalSec / 3600);
  const ss = String(s).padStart(2, "0");
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${ss}`;
  return `${m}:${ss}`;
}
