// sfx.js — tiny wrapper around k.play for gameplay sound effects (Specifiche_Polishing §3/§4).
// Every SFX goes through Kaplay's audio, so the global 🔊/🔇 toggle (which sets the master
// volume via k.setVolume in ui/audioToggle.js) mutes them automatically — no extra wiring.
// Per-sound base volumes keep the mix balanced against the bgm; the call is wrapped so a
// not-yet-loaded sound or a still-locked AudioContext can never throw into gameplay.

import { k } from "./kaplayCtx.js";

// Relative loudness per cue (master mute/▲ is applied globally on top of these).
const VOL = {
  jump: 0.35,
  collect: 0.5,
  coin: 0.55,
  oops: 0.5,
  goal: 0.6,
  win: 0.75,
  select: 0.4,
};

/**
 * Play a one-shot sound effect by asset key (see ASSETS.sounds in config.js).
 * @param {string} name  sound key, e.g. "jump"
 * @param {object} [opts]  extra k.play options (merged over the per-sound default volume)
 * @returns the playback handle, or null if it couldn't play (failed silently)
 */
export function sfx(name, opts = {}) {
  try {
    return k.play(name, { volume: VOL[name] ?? 0.5, ...opts });
  } catch {
    return null; // sound not loaded / audio still locked — never break gameplay
  }
}
