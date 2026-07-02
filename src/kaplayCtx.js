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

// Read a `?maxfps=` URL override (for on-device A/B). Returns whether it was EXPLICITLY set (so the
// auto-tuning below never fights a manual choice) plus the resolved cap.
//   ?maxfps=0 (or off/invalid) → uncapped   ?maxfps=90 → cap at 90, etc.
function readMaxFpsOverride() {
  try {
    const p = new URLSearchParams(location.search).get("maxfps");
    if (p !== null) {
      const n = parseInt(p, 10);
      return { explicit: true, cap: Number.isFinite(n) && n > 0 ? n : undefined };
    }
  } catch {
    // malformed search — no override
  }
  return { explicit: false, cap: undefined };
}
const fpsOverride = readMaxFpsOverride();

// Effective simulation-rate cap for ACTIVE play. `export let` (not const) so it's a LIVE binding:
// the async refresh probe at the bottom can retune it, and every importer (the game scene that
// re-asserts it on entry, the fps overlay) sees the new value. Default: UNCAPPED, then tuned on
// touch devices once we've measured the real display refresh — see measureRefreshAndTuneCap for
// the full rationale (short version: a fixed 60 cap is smooth on a 120Hz ProMotion panel but BEATS
// against a 60Hz one, and 60Hz is already smooth uncapped). A ?maxfps= override wins outright.
export let maxFPS = fpsOverride.cap;

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
  // maxFPS: cadenza del loop, ora REFRESH-AWARE su mobile (vedi measureRefreshAndTuneCap in fondo).
  // Un iPhone ProMotion 120Hz free-running non tiene i 120 pieni (costo JS per-frame) e la cadenza
  // oscilla (120→95→110…) → "scattoso": lì cappiamo a ~60 (1 frame ogni 2 refresh, cadenza pari,
  // liscia). Ma un pannello 60Hz (molti iPhone non-Pro, laptop touch) è GIÀ liscio uncapped, e un
  // cap 60 lì "batte" contro il refresh (salti a scatti): lì restiamo uncapped. Il valore parte
  // undefined e viene ritarato dopo la misura del refresh; desktop resta libero. URL-overridable.
  maxFPS, // starts undefined (or the ?maxfps override); auto-tuned by refresh below
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

// --- Auto-tune the ACTIVE-play cap to the REAL display refresh (touch devices only) -------------
// Why measured, not assumed: a fixed 60 cap is smooth on a 120Hz ProMotion iPhone (Rt = 1/60, so it
// renders every 2nd refresh, evenly) but BEATS against a 60Hz panel — many non-Pro iPhones and
// touch laptops. The loop renders only when `accumulated > 1/maxFPS`; when the cap ≈ the refresh,
// frame-timing jitter periodically fails that check and skips a frame, which reads as a micro-
// stutter — worst during a jump's smooth arc (the exact symptom reported). A 60Hz panel is already
// smooth UNCAPPED (and can't exceed 60 anyway), so the cap there is pure downside. So: sample the
// refresh once at boot, then UNCAP ≤70Hz panels and cap high-refresh ones to render every 2nd
// frame (≈ half the refresh, nudged up a hair so the accumulator's `>` reliably clears two frame
// periods without occasionally slipping to a third). Desktop stays uncapped (GPU budget); a
// ?maxfps= override is never touched. The probe finishes during loading/menu (both throttled to
// PERF.IDLE_FPS), so the tuned value is in place well before the first level reads it on entry.
function measureRefreshAndTuneCap() {
  if (!coarsePointer || fpsOverride.explicit || typeof requestAnimationFrame !== "function") return;
  const deltas = [];
  let last = performance.now();
  let count = 0;
  const SAMPLES = 24; // ~0.4s @60Hz, ~0.2s @120Hz — enough to read the cadence
  const tick = (now) => {
    const dt = now - last;
    last = now;
    if (dt > 1 && dt < 100) deltas.push(dt); // ignore janky first frames / tab stalls
    count++;
    if (deltas.length < SAMPLES && count < SAMPLES * 3) {
      requestAnimationFrame(tick);
      return;
    }
    if (deltas.length < 4) return; // too few good samples to trust — leave it uncapped (smooth)
    deltas.sort((a, b) => a - b);
    const hz = 1000 / deltas[Math.floor(deltas.length / 2)]; // median interval → refresh Hz
    maxFPS = hz > 70 ? Math.round(hz / 2) + 2 : undefined; // tame ProMotion; uncap 60Hz-class
    // If a level is somehow already running, apply now; otherwise scene entry picks it up.
    if (k.getSceneName?.() === "game") setFrameCap(maxFPS);
  };
  requestAnimationFrame(tick);
}
measureRefreshAndTuneCap();
