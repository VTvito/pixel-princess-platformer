// fpsOverlay.js — on-screen FPS / frame-time diagnostics, shown ONLY when the URL carries
// ?fps=1 (or #fps). It exists because the real fluidity of the game can't be measured in
// desktop emulation (Edge/Chromium — see CLAUDE.md) and on Windows there is no Safari Web
// Inspector to read an iPhone's frame timings. Open the deployed game on the device with
// `?fps=1` and this overlay reports what the engine is actually doing.
//
// What it measures (and why it's read from the engine, not from a raw rAF):
//   maxFPS (src/kaplayCtx.js) caps Kaplay's SIMULATION cadence, not the browser's rAF rate —
//   on a 120Hz panel rAF still fires 120×/s even when the game steps at 60. So a naive rAF
//   counter would always read ~120 and hide the cap. Instead we watch k.time(): it only
//   advances on a real engine step, so each change marks one rendered game frame, and k.dt()
//   gives that step's wall-clock delta. From those we derive the true engine fps and the
//   WORST frame delta in the window — the worst delta is the tell for "scattoso": a steady
//   ~16.7ms means even pacing, spikes mean oscillation or GC hitches.
//
// Gated behind the query param so normal players never see it. It creates its own DOM (no
// markup in index.html, no rules in style.css), is pointer-events:none, and never touches
// gameplay/collision logic.

import { k, maxFPS } from "../kaplayCtx.js";

// Count live game objects (recursively) — total vs actually DRAWN (not hidden). The gap is the
// off-screen culling at work (src/scenes/game.js): on iOS WebKit draw-call count is the fluidity
// bottleneck, so "drawn" is the number that matters. Walked only on the 250ms render tick below.
function countObjects() {
  let total = 0;
  let drawn = 0;
  const walk = (o, hiddenAbove) => {
    for (const c of o.children || []) {
      total++;
      const hidden = hiddenAbove || !!c.hidden;
      if (!hidden) drawn++;
      walk(c, hidden);
    }
  };
  try {
    walk(k.getTreeRoot(), false);
  } catch {
    // engine/scene not ready yet
  }
  return total + " (" + drawn + " drawn)";
}

/** True when the page was opened with ?fps (any value) or #fps. */
function enabled() {
  try {
    if (new URLSearchParams(location.search).has("fps")) return true;
  } catch {
    // malformed search — fall through to the hash check
  }
  return location.hash.toLowerCase().includes("fps");
}

export function bindFpsOverlay() {
  if (!enabled()) return;

  const coarse =
    typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)")?.matches;

  const box = document.createElement("div");
  box.id = "fps-overlay";
  Object.assign(box.style, {
    position: "fixed",
    left: "50%",
    top: "6px",
    transform: "translateX(-50%)",
    zIndex: "99999",
    font: "12px/1.4 monospace",
    color: "#fff",
    background: "rgba(0,0,0,.78)",
    padding: "6px 10px",
    borderRadius: "8px",
    whiteSpace: "pre",
    textAlign: "left",
    pointerEvents: "none", // purely diagnostic — never eat touches meant for the game
  });
  document.body.appendChild(box);

  // --- Per-frame sampling, driven by our own rAF but keyed off the engine clock ---
  let lastT = -1; // k.time() at the previous observed engine step
  let frames = 0; // engine steps counted in the current display window
  let worst = 0; // worst engine frame delta (ms) in the current window
  let winStart = performance.now();

  const sample = () => {
    const t = k.time();
    if (lastT >= 0 && t !== lastT) {
      // The engine advanced since our last look → one rendered frame; k.dt() is its delta.
      frames++;
      const ms = k.dt() * 1000;
      if (ms > worst) worst = ms;
    }
    lastT = t;
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);

  const render = () => {
    const now = performance.now();
    const sec = (now - winStart) / 1000;
    const fps = sec > 0 ? frames / sec : 0;
    box.textContent = [
      "— FPS DEBUG —",
      "fps     : " + Math.round(fps),
      "worst   : " + worst.toFixed(1) + " ms",
      "objects : " + countObjects(),
      "coarse  : " + (coarse ? "yes" : "no"),
      "maxFPS  : " + (maxFPS ?? "uncapped"), // reflects the ?maxfps= override
      "dpr     : " + (window.devicePixelRatio || 1),
    ].join("\n");
    frames = 0;
    worst = 0;
    winStart = now;
  };
  render();
  setInterval(render, 250);
}
