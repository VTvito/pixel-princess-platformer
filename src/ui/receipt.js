// receipt.js — finale "Scontrino" + WhatsApp payoff.
//
// Shows this adventure's Coccoline bill (plus the lifetime grand total as a separate
// line) on a paper-receipt card and a "Paga il Debito!" button that opens WhatsApp with
// the amounts substituted into the share text. Zero data leak: no fixed phone number —
// it opens the generic share sheet so Anna picks the chat.

import { formatDuration } from "../format.js";

// Share text from the spec, extended with the lifetime + time lines; encoded at click time.
function whatsappUrl(run, lifetime, timeMs) {
  const text =
    `Ho finito il gioco e sono la Principessa Perfetta! ❤️ ` +
    `Ci ho messo ${formatDuration(timeMs)}! ` +
    `Preparati, ti devo ${run} coccoline! ` +
    `(Totale storico: ${lifetime} coccoline)`;
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
}

let overlay = null;
let amountEl = null;
let lifetimeEl = null;
let timeEl = null;
let payBtn = null;
let closeBtn = null;

function els() {
  overlay ||= document.getElementById("receipt-overlay");
  amountEl ||= document.getElementById("receipt-amount");
  lifetimeEl ||= document.getElementById("receipt-lifetime");
  timeEl ||= document.getElementById("receipt-time");
  payBtn ||= document.getElementById("receipt-pay");
  closeBtn ||= document.getElementById("receipt-close");
}

/**
 * Reveal the receipt with this run's bill + the lifetime total + the net play time, and wire its
 * buttons.
 * @param {number} run       this adventure's Coccoline bill
 * @param {number} lifetime  the lifetime grand total
 * @param {number} timeMs    the run's net play time in ms (time-attack "risultato finale")
 * @param {() => void} [onClose]  runs after the player taps "Chiudi" (the finale uses it to chain
 *   the leaderboard popup). NOT fired by the defensive hideReceipt() calls from other scenes.
 */
export function showReceipt(run, lifetime, timeMs, onClose) {
  els();
  if (!overlay) return;
  if (amountEl) amountEl.textContent = String(run);
  if (lifetimeEl) lifetimeEl.textContent = String(lifetime);
  if (timeEl) timeEl.textContent = formatDuration(timeMs);
  overlay.hidden = false;
  if (payBtn) {
    payBtn.onclick = () => {
      window.open(whatsappUrl(run, lifetime, timeMs), "_blank", "noopener,noreferrer");
    };
  }
  if (closeBtn) {
    closeBtn.onclick = () => {
      hideReceipt();
      onClose?.();
    };
  }
}

/** Hide the receipt (reveals the finale + its menu button beneath). */
export function hideReceipt() {
  els();
  if (overlay) overlay.hidden = true;
}
