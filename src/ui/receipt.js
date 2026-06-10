// receipt.js — finale "Scontrino" + WhatsApp payoff (Specifiche_Polishing §2).
//
// Shows this adventure's Coccoline bill (plus the lifetime grand total as a separate
// line) on a paper-receipt card and a "Paga il Debito!" button that opens WhatsApp with
// the amounts substituted into the share text. Zero data leak: no fixed phone number —
// it opens the generic share sheet so Anna picks the chat.

// Share text from the spec, extended with the lifetime line; encoded at click time.
function whatsappUrl(run, lifetime) {
  const text =
    `Ho finito il gioco e sono la Principessa Perfetta! ❤️ ` +
    `Preparati, ti devo ${run} coccoline! ` +
    `(Totale storico: ${lifetime} coccoline)`;
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
}

let overlay = null;
let amountEl = null;
let lifetimeEl = null;
let payBtn = null;
let closeBtn = null;

function els() {
  overlay ||= document.getElementById("receipt-overlay");
  amountEl ||= document.getElementById("receipt-amount");
  lifetimeEl ||= document.getElementById("receipt-lifetime");
  payBtn ||= document.getElementById("receipt-pay");
  closeBtn ||= document.getElementById("receipt-close");
}

/** Reveal the receipt with this run's bill + the lifetime total, and wire its buttons. */
export function showReceipt(run, lifetime) {
  els();
  if (!overlay) return;
  if (amountEl) amountEl.textContent = String(run);
  if (lifetimeEl) lifetimeEl.textContent = String(lifetime);
  overlay.hidden = false;
  if (payBtn) {
    payBtn.onclick = () => {
      window.open(whatsappUrl(run, lifetime), "_blank", "noopener,noreferrer");
    };
  }
  if (closeBtn) closeBtn.onclick = hideReceipt;
}

/** Hide the receipt (reveals the finale + its menu button beneath). */
export function hideReceipt() {
  els();
  if (overlay) overlay.hidden = true;
}
