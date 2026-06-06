// insertCoin.js — the "Insert Coin" death overlay (Specifiche_Polishing §1).
//
// Pure DOM: the spec requires an HTML overlay sovrapposto al canvas, NOT a Kaplay
// object, so it stays out of the game's collision/render tree entirely. The game scene
// calls showInsertCoin(onContinue) when the heroine fails; pressing "Inserisci Coin"
// hides the overlay and runs the callback (which banks 500 Coccoline and restarts the
// level). Markup lives in index.html; this module just toggles + wires it.

let overlay = null;
let button = null;

function els() {
  overlay ||= document.getElementById("coin-overlay");
  button ||= document.getElementById("coin-btn");
}

/** Show the death overlay. `onContinue` runs once, when the player inserts the coin. */
export function showInsertCoin(onContinue) {
  els();
  if (!overlay || !button) return;
  overlay.hidden = false;
  // Assign (not addEventListener) so repeated deaths never stack handlers.
  button.onclick = () => {
    hideInsertCoin();
    onContinue?.();
  };
}

/** Hide the overlay (also called defensively when entering other scenes). */
export function hideInsertCoin() {
  els();
  if (overlay) overlay.hidden = true;
}
