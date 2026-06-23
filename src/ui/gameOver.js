// gameOver.js — the "Game Over" overlay, shown when the heroine loses her last life.
//
// Pure DOM (like insertCoin.js): an HTML overlay over the canvas, never a Kaplay object, so it
// stays out of the game's render/collision tree. The game scene calls showGameOver(onRestart)
// after resetting the run back to level 1 (src/state.js resetRun); pressing the button hides
// the overlay and runs the callback (which fades into a fresh level 1). The Coccoline tab is
// deliberately NOT cleared on a Game Over — the finale tallies every Coccolina across attempts.
// Markup lives in index.html; this module just toggles + wires it.

let overlay = null;
let button = null;

function els() {
  overlay ||= document.getElementById("gameover-overlay");
  button ||= document.getElementById("gameover-btn");
}

/** Show the Game Over overlay. `onRestart` runs once, when the player chooses to restart. */
export function showGameOver(onRestart) {
  els();
  if (!overlay || !button) return;
  overlay.hidden = false;
  // Assign (not addEventListener) so repeated game-overs never stack handlers.
  button.onclick = () => {
    hideGameOver();
    // Hand keyboard focus back to the canvas (clicking this DOM button took it).
    document.getElementById("game")?.focus();
    onRestart?.();
  };
}

/** Hide the overlay (also called defensively when entering other scenes). */
export function hideGameOver() {
  els();
  if (overlay) overlay.hidden = true;
}
