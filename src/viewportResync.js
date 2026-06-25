// viewportResync.js — fixes the iOS-PWA "two colour bands, menu never loads" freeze on resume.
//
// Why this exists: when the installed PWA is sent to Home (backgrounded) and reopened while in
// LANDSCAPE, the game came back showing only two flat colour bands — the body background
// (#26325c / PALETTE.deepBlue) visible BELOW a too-short #game canvas, with the real content
// drawn off-screen. The DOM audio buttons stayed correctly placed (HTML, not canvas), proving
// the viewport itself was fine: only Kaplay's cached canvas geometry was stale.
//
// Root cause: Kaplay runs letterbox+stretch and recomputes the letterbox from canvas.offsetWidth/
// Height via a ResizeObserver on the canvas (vendor/kaplay-3001.0.19.mjs). On the iOS background→
// foreground transition the canvas box doesn't change between the broken state and the restored
// one, so the observer never re-fires and Kaplay keeps the dimensions it latched during the
// transient resume viewport. The user's only recovery — rotate portrait↔landscape — works
// precisely because a real orientation change forces that recompute.
//
// The fix: on every resume signal, briefly pin the canvas to the TRUE current viewport size
// (window.innerWidth/innerHeight) and then hand sizing back to the stylesheet. That box change
// makes Kaplay's ResizeObserver fire at correct dimensions — the same recompute the rotation
// triggers — so the menu/game renders right without the user touching anything. Emulation can't
// reproduce the WebKit resume latch (Edge/Chromium don't drop the context), so this is verified
// on a physical iPhone; the logic is harmless if it ever runs when nothing was wrong.

let installed = false;
let scheduled = false;

/** Pin the canvas to the live viewport for one frame so Kaplay re-letterboxes, then release it. */
function resync() {
  const canvas = document.querySelector("#game");
  if (!canvas) return; // engine/DOM not ready yet — a later resume retries
  // Force the canvas box to the real current viewport. Explicit px (not a 0-size display toggle)
  // keeps the recompute non-zero, so Kaplay never reads a transient 0 and never flashes black.
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  requestAnimationFrame(() => {
    // The observer has now seen the correct size; give sizing back to the stylesheet
    // (#game = 100% of the 100dvh body) so normal responsive behaviour resumes.
    canvas.style.width = "";
    canvas.style.height = "";
  });
}

/** Run resync now and once more after iOS has settled the restored viewport (~300 ms). */
function resyncOnResume() {
  if (document.visibilityState === "hidden") return; // ignore the hidden half of the toggle
  resync();
  if (scheduled) return; // collapse overlapping resume signals into a single delayed pass
  scheduled = true;
  setTimeout(() => {
    scheduled = false;
    resync();
  }, 300);
}

/**
 * Wire the resume-time canvas resync. Call once at startup (from main.js). Listens for every way
 * iOS hands the PWA back to the foreground: visibilitychange→visible, pageshow (incl. bfcache
 * restores), and focus.
 */
export function installViewportResync() {
  if (installed) return;
  installed = true;

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") resyncOnResume();
  });
  window.addEventListener("pageshow", resyncOnResume);
  window.addEventListener("focus", resyncOnResume);
}
