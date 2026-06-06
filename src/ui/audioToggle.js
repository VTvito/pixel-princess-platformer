// audioToggle.js — global bgm mute button (Specifiche_Polishing §4).
//
// A small DOM button (top-right, in index.html) toggles Kaplay's master volume between
// on and muted, which affects the currently-looping bgm in real time. The choice persists
// across reloads. Bound once at startup (like the touch buttons), so it works on every
// scene.

import { k } from "../kaplayCtx.js";

const MUTE_KEY = "pj.muted";
let btn = null;
let muted = false;

function readMuted() {
  try {
    return window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}
function writeMuted(v) {
  try {
    window.localStorage.setItem(MUTE_KEY, v ? "1" : "0");
  } catch {
    // no-op — preference just won't persist this session
  }
}

// Kaplay renamed the master-volume setter across versions; support both.
function setMasterVolume(v) {
  if (typeof k.setVolume === "function") k.setVolume(v);
  else if (typeof k.volume === "function") k.volume(v);
}

function apply() {
  setMasterVolume(muted ? 0 : 1);
  if (btn) {
    btn.textContent = muted ? "🔇" : "🔊";
    btn.classList.toggle("is-muted", muted);
    btn.setAttribute("aria-label", muted ? "Riattiva audio" : "Disattiva audio");
  }
}

/** Wire the toggle and apply the saved preference. Call once at startup. */
export function bindAudioToggle() {
  btn = document.getElementById("audio-toggle");
  muted = readMuted();
  apply(); // honour saved preference even before any sound has played
  if (!btn) return;
  btn.addEventListener("click", () => {
    muted = !muted;
    writeMuted(muted);
    apply();
  });
}
