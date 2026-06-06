// receipt.js — finale "Scontrino" + WhatsApp payoff (Specifiche_Polishing §2).
//
// Shows the running Coccoline debt as a paper-receipt card and a "Paga il Debito!"
// button that opens WhatsApp with the amount substituted into the share text. Zero data
// leak: no fixed phone number — it opens the generic share sheet so Anna picks the chat.

// The exact share link from the spec; [X] is replaced with the live total at click time.
const WHATSAPP_URL =
  "https://api.whatsapp.com/send?text=Ho%20finito%20il%20gioco%20e%20sono%20la%20Principessa%20Perfetta!%20%E2%9D%A4%EF%B8%8F%20Preparati,%20ti%20devo%20[X]%20coccoline!";

let overlay = null;
let amountEl = null;
let payBtn = null;
let closeBtn = null;

function els() {
  overlay ||= document.getElementById("receipt-overlay");
  amountEl ||= document.getElementById("receipt-amount");
  payBtn ||= document.getElementById("receipt-pay");
  closeBtn ||= document.getElementById("receipt-close");
}

/** Reveal the receipt with the given total (Coccoline) and wire its buttons. */
export function showReceipt(total) {
  els();
  if (!overlay) return;
  if (amountEl) amountEl.textContent = String(total);
  overlay.hidden = false;
  if (payBtn) {
    payBtn.onclick = () => {
      window.open(WHATSAPP_URL.replace("[X]", String(total)), "_blank", "noopener,noreferrer");
    };
  }
  if (closeBtn) closeBtn.onclick = hideReceipt;
}

/** Hide the receipt (reveals the finale + its menu button beneath). */
export function hideReceipt() {
  els();
  if (overlay) overlay.hidden = true;
}
