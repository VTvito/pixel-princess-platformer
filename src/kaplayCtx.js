// kaplayCtx.js — creates the one Kaplay context and exports it.
// Every other module imports `k` from here, so there is exactly one engine instance
// and no global (window) pollution.

// Kaplay is vendored (pinned 3001.0.19, downloaded from unpkg) so production never
// depends on a CDN being up, and the game can later work offline as a PWA.
import kaplay from "../vendor/kaplay-3001.0.19.mjs";
import { GAME_W, GAME_H, PALETTE } from "./config.js";

// Touch devices (phones/tablets) usually pair a high devicePixelRatio (3 on iPhone) with a
// modest mobile GPU. Rendering the virtual 1280×720 world at 2× there means a ~2560×1440
// backbuffer — ~4× the fragment/fill work of density 1 — which makes the game feel "scattoso"
// (choppy) on iOS. Since the art is nearest-neighbour pixel art scaled to full-screen anyway,
// dropping to density 1 on mobile is barely perceptible visually but vastly smoother. Desktop
// keeps min(dpr, 2) for crisp HUD text where the GPU budget is there.
// Exported so gameplay can lighten per-frame work on touch devices (e.g. fewer ambient
// particles — see src/scenes/game.js), where the GPU/CPU budget is tighter than desktop.
// Detect touch/mobile robustly: `pointer: coarse` is the usual signal, but some iOS browser
// configs report it inconsistently — `navigator.maxTouchPoints > 0` is true on every iPhone/iPad,
// so OR-ing it in guarantees the mobile render path (density 1, fewer particles, fps cap) actually
// engages on the device. A desktop with a touchscreen also takes this path — a harmless trade.
export const coarsePointer =
  typeof window !== "undefined" &&
  (window.matchMedia?.("(pointer: coarse)")?.matches ||
    (typeof navigator !== "undefined" && (navigator.maxTouchPoints || 0) > 0));

// Effective simulation-rate cap. Default: 60 on touch (steady pacing — see the maxFPS note
// below), uncapped on desktop. A `?maxfps=` URL override lets us A/B the cap ON THE DEVICE,
// which emulation can't judge — the key open question is whether a 60 cap on a 120Hz iPhone
// (ProMotion) reads smoother or choppier than free-running:
//   ?maxfps=0  (or off/invalid) → uncapped   ?maxfps=90 → cap at 90, etc.
// Exported so the FPS overlay (src/ui/fpsOverlay.js) can report the value actually in force.
function resolveMaxFPS() {
  let cap = coarsePointer ? 60 : undefined;
  try {
    const p = new URLSearchParams(location.search).get("maxfps");
    if (p !== null) {
      const n = parseInt(p, 10);
      cap = Number.isFinite(n) && n > 0 ? n : undefined; // 0 / off / NaN → uncapped
    }
  } catch {
    // malformed search — keep the default
  }
  return cap;
}
export const maxFPS = resolveMaxFPS();

// The options are kept in a NAMED object (not an inline literal) because the Kaplay frame
// loop reads `gopt.maxFPS` LIVE every step (`Rt = gopt.maxFPS ? 1/gopt.maxFPS : 0`) off the
// very object we pass in — it never clones or buffers it. So mutating `gameOpts.maxFPS` here
// re-caps the loop from the next frame, no engine re-init needed. `setFrameCap` below uses
// that to throttle the render when nothing is happening (menu/pause/premio) — see the
// per-state caps wired in the scenes. This is the load-bearing trick for the "run cooler
// while idle" work: the game's ACTIVE 60fps feel is untouched; only the standing-still states
// drop their frame rate so an iPhone's GPU stops cooking behind a static overlay.
const gameOpts = {
  width: GAME_W,
  height: GAME_H,
  // letterbox + stretch: scale to the viewport while keeping the 16:9 landscape aspect
  // ratio, adding bars on off-ratio screens instead of distorting.
  letterbox: true,
  stretch: true,
  background: PALETTE.sky,
  canvas: document.querySelector("#game"),
  global: false,           // use the returned context, no globals
  touchToMouse: true,      // taps fire onClick — menu works on mobile
  // Density 1 on touch/mobile (smooth over crisp — see coarsePointer note above), capped 2 on desktop.
  pixelDensity: coarsePointer ? 1 : Math.min(window.devicePixelRatio || 1, 2),
  // maxFPS: blocca il loop a 60fps a cadenza regolare SU MOBILE. Un iPhone ProMotion gira a
  // 120Hz, ma l'engine free-running non tiene i 120 pieni a causa del costo JS per-frame, così
  // la cadenza oscilla (120→95→110…) e gli intervalli irregolari si leggono come "scattoso"
  // anche con fps medio alto. Un 60 fermo è più liscio di un 90-110 ballerino — è l'obiettivo
  // di fluidità su mobile. Desktop resta libero (di norma già a 60Hz).
  maxFPS, // resolved above (default 60 on touch / uncapped on desktop; URL-overridable for A/B)
  crisp: true, // nearest-neighbour sampling so the generated 64px tiles/sprites stay sharp
  // Default UI font: the vendored pixel font (loaded in src/assets.js as "pixel"). Every
  // k.text() inherits it, so the HUD/menus read as pixel art instead of system sans-serif.
  // The few labels with emoji/symbol glyphs the font lacks (▶ ★ ✨ 👑) override to
  // font:"sans-serif" per object. Until the async load finishes (the loading scene), Kaplay
  // falls back to its built-in font for the brief "Caricamento..." text.
  font: "pixel",
};

export const k = kaplay(gameOpts);

// Re-cap the render loop AT RUNTIME by mutating the live options object Kaplay reads each
// frame (see the gameOpts note above). Scenes call this to run cooler when the game is just
// sitting there: 30fps on menus/finale/loading/reward, ~10 behind the pause + death overlays,
// and back to the full `maxFPS` (60 mobile / uncapped desktop) the instant real play resumes.
//   cap falsy or <= 0 → uncapped   |   cap > 0 → lock the loop to `cap` fps
// It changes ONLY the frame rate, never gameplay dt/physics (Kaplay steps a fixed dt), so
// throttling an idle scene can't alter behaviour — it just draws fewer frames of a scene that
// isn't moving anyway.
export function setFrameCap(cap) {
  gameOpts.maxFPS = cap && cap > 0 ? cap : undefined;
}
