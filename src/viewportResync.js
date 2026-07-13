// viewportResync.js — keeps Kaplay's canvas geometry honest across RESUME and ROTATION.
//
// Why this exists: Kaplay runs letterbox+stretch and recomputes the letterbox from
// canvas.offsetWidth/Height via a ResizeObserver on the canvas (vendor/kaplay-3001.0.19.mjs). That
// observer has two properties that bite on iOS:
//   1. it EARLY-RETURNS when the box dimensions are unchanged (it caches lastWidth/lastHeight), and
//   2. it DEFERS the actual recompute to the engine's next input tick (`events.onOnce("input")`).
//
// Two symptoms, one root cause — a stale letterbox nobody recomputes:
//
//   • RESUME. Send the installed PWA to Home in LANDSCAPE and reopen it: only two flat colour bands
//     showed (the body #26325c below a too-short canvas) and the menu never appeared. The canvas box
//     doesn't change across that transition, so (1) keeps the observer silent and Kaplay keeps the
//     dimensions it latched during the transient resume viewport. The DOM audio button stayed
//     correctly placed the whole time, proving the viewport itself was fine.
//
//   • ROTATION. Rotating the device while playing sometimes left the game frozen/blank until the
//     player rotated back and forth again. Nothing in the app listened for `resize` or
//     `orientationchange` at all — recovery was left entirely to that same observer. iOS reports
//     INTERMEDIATE viewport sizes mid-rotation, so it can latch one of those and then, if the final
//     size happens to match something it already saw, never correct it (1). And because the recompute
//     waits for an input tick (2), a scene throttled to PERF.IDLE_FPS/FROZEN_FPS (30 or 10 fps —
//     menu, pause, finale) takes up to 100ms per attempt. Rotating twice worked because it forced a
//     fresh, different box size.
//
// The fix, shared by both paths: briefly PIN the canvas to the true current viewport
// (window.innerWidth/innerHeight), then hand sizing back to the stylesheet. That box change makes
// the observer fire at correct dimensions — the same recompute the manual double-rotation forced.
// Because iOS settles the viewport over a few hundred ms, we repeat the pass on a short schedule
// instead of once, and we temporarily UNCAP the frame loop so the deferred recompute actually gets
// its input tick promptly.
//
// Emulation can't reproduce the WebKit latch (Edge/Chromium don't drop the context), so the real
// fix is verified on a physical iPhone; the logic is harmless if it ever runs when nothing was wrong.

import { setFrameCap, maxFPS } from "./kaplayCtx.js";

let installed = false;
let passes = 0; // resync passes still scheduled — while > 0 we hold the loop uncapped
let debounce = 0; // resize coalescing timer

/** Pin the canvas to the live viewport for one frame so Kaplay re-letterboxes, then release it. */
function resync() {
  const canvas = document.querySelector("#game");
  if (!canvas) return; // engine/DOM not ready yet — a later signal retries
  // Force the canvas box to the real current viewport. Explicit px (not a 0-size display toggle)
  // keeps the recompute non-zero, so Kaplay never reads a transient 0 and never flashes black.
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  const release = () => {
    // The observer has now seen the correct size; give sizing back to the stylesheet
    // (#game = 100% of the 100dvh body) so normal responsive behaviour resumes.
    canvas.style.width = "";
    canvas.style.height = "";
  };
  requestAnimationFrame(release);
  // Belt and braces: a backgrounded page may never run that rAF, which would leave the inline px
  // glued on. A timer clears them regardless (release is idempotent).
  setTimeout(release, 250);
}

/**
 * Run the resync now and again as the viewport settles.
 *
 * The staged delays are for iOS: mid-rotation (and mid-resume) `window.innerWidth/Height` are still
 * transitioning, so a single pass can pin the WRONG size. Re-running at ~150ms and ~450ms lands at
 * least one pass on the final geometry. While passes are pending we also uncap the frame loop —
 * Kaplay's resize recompute waits for an input tick, and an idle/frozen scene ticks at 10-30fps.
 * The scene re-asserts its own cap on entry, so restoring the active `maxFPS` here leaks no state.
 */
function scheduleResync(delays = [150, 450]) {
  if (document.visibilityState === "hidden") return; // nothing to fix off-screen
  setFrameCap(0); // uncapped — let the deferred recompute land immediately
  resync(); // pass 1: right now
  if (!delays.length) {
    setFrameCap(maxFPS);
    return;
  }
  passes += delays.length; // overlapping signals just extend the uncapped window
  for (const ms of delays) {
    setTimeout(() => {
      resync();
      if (--passes <= 0) {
        passes = 0;
        setFrameCap(maxFPS); // back to the active-play cap; scenes re-assert their own anyway
      }
    }, ms);
  }
}

/**
 * Wire the canvas resync. Call once at startup (from main.js).
 *
 * RESUME signals — every way iOS hands the PWA back: visibilitychange→visible, pageshow (incl.
 * bfcache restores), focus.
 * GEOMETRY signals — orientationchange, screen.orientation change, and a debounced resize (which
 * also covers desktop window drags and the iOS toolbar settling).
 */
export function installViewportResync() {
  if (installed) return;
  installed = true;

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") scheduleResync();
  });
  window.addEventListener("pageshow", () => scheduleResync());
  window.addEventListener("focus", () => scheduleResync());

  // A rotation fires several of these in a burst; coalesce them, then run the staged passes once.
  const onGeometry = () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => scheduleResync([150, 450]), 80);
  };
  window.addEventListener("orientationchange", onGeometry);
  window.addEventListener("resize", onGeometry);
  window.screen?.orientation?.addEventListener?.("change", onGeometry);
}
