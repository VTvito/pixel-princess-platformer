// audioToggle.js — the ONE top-right audio button.
//
// It used to be two (🎵 music + 🔊 effects) with independent buses, and "off" was signalled only
// by dimming the glyph — hard to read, and two controls where one would do. Now a single button
// mutes/unmutes BOTH buses together, and "off" is unmistakable: the glyph becomes the slashed
// speaker 🔇 and the circle turns crimson (style.css `#audio-toggle.is-muted`).
//
// The buses themselves (src/audio.js) stay separate — the settings overlay still offers a music
// and an effects volume slider, and this button never touches those levels, only the on/off flags.
// So muting and unmuting from here always restores the volumes the player had chosen.
//
// Bound once at startup (like the touch buttons), so it works in every scene. Markup: index.html.

import { isMusicOn, isSfxOn, setMusicOn, setSfxOn } from "../audio.js";

let btn = null;

/** Audio is "on" if EITHER bus is live — so the button always offers the action you'd expect. */
function isAudioOn() {
  return isMusicOn() || isSfxOn();
}

function paint() {
  if (!btn) return;
  const on = isAudioOn();
  btn.textContent = on ? "🔊" : "🔇"; // the slashed speaker IS the "off" state
  btn.classList.toggle("is-muted", !on);
  btn.setAttribute("aria-label", on ? "Disattiva audio" : "Attiva audio");
}

/** Wire the toggle and apply the saved preferences. Call once at startup. */
export function bindAudioToggle() {
  btn = document.getElementById("audio-toggle");
  paint();
  if (!btn) return;
  btn.addEventListener("click", () => {
    const next = !isAudioOn(); // one tap moves both buses to the same new state
    setMusicOn(next); // pushes the gain onto the live bgm handle (no track restart)
    setSfxOn(next);
    paint();
  });
}
