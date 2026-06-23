// installHint.js — a small, dismissible "Aggiungi a Home" banner shown only on iOS Safari.
// iPhone Safari tabs can't hide the browser toolbar (there is no Fullscreen API on iPhone),
// so the only way to play truly full-screen is to install the PWA via Share → "Aggiungi a
// Home". This nudges that, once, until the user closes it (the dismissal is persisted). It is
// never shown when already running as an installed standalone app, nor on non-iOS devices.

const DISMISS_KEY = "pj.installHint";

function isIOS() {
  const ua = navigator.userAgent || "";
  // iPhone/iPod/iPad UA, plus iPadOS 13+ which masquerades as desktop Safari on a Mac.
  return (
    /iphone|ipod|ipad/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isStandalone() {
  // iOS Safari sets navigator.standalone; other engines expose the display-mode media query.
  return (
    window.navigator.standalone === true ||
    (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches)
  );
}

function dismissed() {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "0";
  } catch {
    return false;
  }
}
function persistDismissed() {
  try {
    window.localStorage.setItem(DISMISS_KEY, "0");
  } catch {
    // preference just won't persist this session
  }
}

/** Reveal the iOS install hint when appropriate and wire its close button. Call once. */
export function bindInstallHint() {
  const el = document.getElementById("install-hint");
  if (!el) return;
  if (!isIOS() || isStandalone() || dismissed()) return; // not relevant → stay hidden

  const close = document.getElementById("install-close");
  const hide = () => (el.hidden = true);
  if (close) {
    close.addEventListener("click", () => {
      persistDismissed(); // an explicit close silences it for good
      hide();
    });
  }
  el.hidden = false;
  // Auto-fade after a while so it never lingers over gameplay (not persisted — only an
  // explicit close stops it returning next session). Il banner ora è un passo-passo su due
  // righe (Condividi → "Aggiungi a Home"): più testo da leggere, quindi più tempo a video.
  window.setTimeout(hide, 14000);
}
