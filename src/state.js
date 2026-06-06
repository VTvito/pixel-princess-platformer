// state.js — game state + localStorage persistence.
// Persists across reloads so progress (chosen character, current level) survives.
// All storage access is guarded: Safari private mode can throw on localStorage.

import { MAX_LEVEL } from "./config.js";

const KEYS = {
  character: "pj.character",
  level: "pj.currentLevel",
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
};

function clampLevel(n) {
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_LEVEL);
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

// Wipe saved progress (handy for a future "reset" button / testing).
export function resetProgress() {
  state.selectedCharacter = null;
  state.currentLevel = 1;
  try {
    window.localStorage.removeItem(KEYS.character);
    window.localStorage.removeItem(KEYS.level);
  } catch {
    // no-op
  }
}

// --- "Insert Coin" meta-game (Specifiche_Polishing §1) ------------------------
// The running tab of "debiti": every failure costs 500 Coccoline. Stored under the exact
// key the spec names ("totaleCoccoline"), initialised to 0 on first read, and read back
// for the finale receipt (§2). The debt is deliberately cumulative across the whole gift
// (a bigger number is the joke), so it is NOT cleared by resetProgress / "Nuova partita".
const COCCOLINE_KEY = "totaleCoccoline";

export function getCoccoline() {
  const n = parseInt(read(COCCOLINE_KEY) || "0", 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function addCoccoline(amount) {
  const total = getCoccoline() + amount;
  write(COCCOLINE_KEY, String(total));
  return total;
}

// Reset the debt (testing / dev only — not wired to any in-game button).
export function resetCoccoline() {
  try {
    window.localStorage.removeItem(COCCOLINE_KEY);
  } catch {
    // no-op
  }
}
