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
