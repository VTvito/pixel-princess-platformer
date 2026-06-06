// transition.js — scene fade transitions (Specifiche_Polishing §4).
//
// Native CSS opacity fade on a black DOM layer (#fade): fade to black, switch the Kaplay
// scene while covered, then fade back in — so finishing a level and starting the next one
// don't snap. Using the browser's transition (per the spec's multi-agent note) keeps this
// off Kaplay's render tree.

const DURATION = 350; // keep in sync with the #fade CSS transition duration

let fadeEl = null;
function el() {
  fadeEl ||= document.getElementById("fade");
  return fadeEl;
}

/**
 * Fade out, run `go` (e.g. () => k.go("game")) while the screen is black, then fade in.
 * Falls back to an instant switch if the overlay is missing.
 * @param {() => void} go  performs the scene switch
 */
export function fadeToScene(go) {
  const f = el();
  if (!f) {
    go();
    return;
  }
  f.classList.add("is-visible");
  window.setTimeout(() => {
    go();
    // Two RAFs so the new scene paints (still black) before we start fading back in.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => f.classList.remove("is-visible")),
    );
  }, DURATION);
}
