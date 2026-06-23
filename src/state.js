// state.js — game state + localStorage persistence.
// Persists across reloads so progress (chosen character, current level) survives.
// All storage access is guarded: Safari private mode can throw on localStorage.

import { MAX_LEVEL, LIVES } from "./config.js";

const KEYS = {
  character: "pj.character",
  level: "pj.currentLevel",
  score: "pj.score",
  lives: "pj.lives",
  checkpoint: "pj.checkpoint", // JSON {level, x, y} — the last flag touched this run
  nickname: "pj.nickname",     // remembered name for the global leaderboard
};

function read(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore — gameplay continues in-memory for the session.
  }
}

// In-memory mirror so the rest of the game has a synchronous source of truth even if
// storage is unavailable.
const state = {
  selectedCharacter: read(KEYS.character) || null,
  currentLevel: clampLevel(parseInt(read(KEYS.level) || "1", 10)),
  score: clampScore(parseInt(read(KEYS.score) || "0", 10)),
  lives: clampLives(parseInt(read(KEYS.lives) || String(LIVES.START), 10)),
};

function clampScore(n) {
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function clampLevel(n) {
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_LEVEL);
}

function clampLives(n) {
  if (!Number.isFinite(n) || n < 0) return LIVES.START;
  return Math.min(n, LIVES.MAX);
}

export function getSelectedCharacter() {
  return state.selectedCharacter;
}

export function setSelectedCharacter(id) {
  state.selectedCharacter = id;
  write(KEYS.character, id);
}

export function getCurrentLevel() {
  return state.currentLevel;
}

export function setCurrentLevel(n) {
  state.currentLevel = clampLevel(n);
  write(KEYS.level, String(state.currentLevel));
}

// --- Journey score (Mario-style) ---------------------------------------------
// Accumulates across the playthrough (pickups + stomps) and persists like progress, so a
// reload keeps it. Reset when a brand-new game starts ("Nuova partita"), not on a per-level
// respawn (retries re-collect, like an arcade).
export function getScore() {
  return state.score;
}

export function addScore(amount) {
  state.score = clampScore(state.score + amount);
  write(KEYS.score, String(state.score));
  return state.score;
}

export function resetScore() {
  state.score = 0;
  write(KEYS.score, "0");
}

// --- Arcade lives -----------------------------------------------------------
// Lives are a per-run counter: start at LIVES.START, +1 per heart (capped at LIVES.MAX), -1 on
// every death. At 0 the run ends (Game Over → src/scenes/game.js resets via resetRun).
export function getLives() {
  return state.lives;
}

export function setLives(n) {
  state.lives = clampLives(n);
  write(KEYS.lives, String(state.lives));
  return state.lives;
}

// Grab a heart: +1 life (clamped). Returns the new total.
export function addLife() {
  return setLives(state.lives + 1);
}

// Spend a life on a death. Returns the lives REMAINING (0 ⇒ caller triggers Game Over).
export function loseLife() {
  return setLives(state.lives - 1);
}

// --- Checkpoint (persisted) -------------------------------------------------
// The last flag touched this run, stored so an interruption (pause→menu, reload, closing the
// browser) resumes mid-level — only a Game Over / Nuova partita clears it.
export function getCheckpoint() {
  const raw = read(KEYS.checkpoint);
  if (!raw) return null;
  try {
    const cp = JSON.parse(raw);
    if (cp && Number.isFinite(cp.level) && Number.isFinite(cp.x) && Number.isFinite(cp.y)) return cp;
  } catch {
    // corrupt value — treat as no checkpoint
  }
  return null;
}

export function setCheckpoint(cp) {
  write(KEYS.checkpoint, JSON.stringify({ level: cp.level, x: cp.x, y: cp.y }));
}

export function clearCheckpoint() {
  try {
    window.localStorage.removeItem(KEYS.checkpoint);
  } catch {
    // no-op
  }
}

// --- Leaderboard nickname ---------------------------------------------------
export function getNickname() {
  return read(KEYS.nickname) || "";
}

export function setNickname(name) {
  write(KEYS.nickname, String(name));
}

// --- Game Over: restart the journey, keep the Coccoline tab --------------------------------
// The arcade reset: back to level 1 with a fresh score + lives and no stale checkpoint, but the
// Coccoline bill (run + lifetime) is deliberately NOT cleared — the finale tallies every
// Coccolina spent across all attempts (the gift's running joke). A deliberate "Nuova partita"
// is the only thing that wipes the bill (resetCoccolineRun, called from the menu).
export function resetRun() {
  setCurrentLevel(1);
  resetScore();
  setLives(LIVES.START);
  clearCheckpoint();
}

// Wipe saved progress (handy for a future "reset" button / testing).
export function resetProgress() {
  state.selectedCharacter = null;
  state.currentLevel = 1;
  state.score = 0;
  state.lives = LIVES.START;
  try {
    window.localStorage.removeItem(KEYS.character);
    window.localStorage.removeItem(KEYS.level);
    window.localStorage.removeItem(KEYS.score);
    window.localStorage.removeItem(KEYS.lives);
    window.localStorage.removeItem(KEYS.checkpoint);
  } catch {
    // no-op
  }
}

// --- "Insert Coin" meta-game ------------------------
// The running tab of "debiti": every failure costs 500 Coccoline, tracked on TWO counters:
//   - "totaleCoccoline" (exact key from the spec): the lifetime grand total, never reset —
//     the historical line on the finale receipt (a bigger number is part of the joke).
//   - "pj.coccolineRun": this adventure's bill. Reset ONLY when the player explicitly
//     starts a "Nuova partita" (not on "Riprendi", not on a death respawn), so the finale
//     receipt (§2) charges for the current journey alone.
const COCCOLINE_KEY = "totaleCoccoline";
const COCCOLINE_RUN_KEY = "pj.coccolineRun";

function readCount(key) {
  const n = parseInt(read(key) || "0", 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function getCoccoline() {
  return readCount(COCCOLINE_KEY);
}

export function getCoccolineRun() {
  return readCount(COCCOLINE_RUN_KEY);
}

export function addCoccoline(amount) {
  write(COCCOLINE_KEY, String(getCoccoline() + amount));
  const run = getCoccolineRun() + amount;
  write(COCCOLINE_RUN_KEY, String(run));
  return run;
}

// Start a fresh bill for a new journey ("Nuova partita"). The lifetime total survives.
export function resetCoccolineRun() {
  try {
    window.localStorage.removeItem(COCCOLINE_RUN_KEY);
  } catch {
    // no-op
  }
}

// Reset the lifetime debt (testing / dev only — not wired to any in-game button).
export function resetCoccoline() {
  try {
    window.localStorage.removeItem(COCCOLINE_KEY);
  } catch {
    // no-op
  }
}
