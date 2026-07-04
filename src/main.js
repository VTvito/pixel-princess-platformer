// main.js — entry point. Creates the engine (via kaplayCtx), registers scenes, starts
// loading assets, and shows the loading scene which advances to the menu when ready.

import { k } from "./kaplayCtx.js";
import { loadAssets } from "./assets.js";
import { getRunTime } from "./state.js";
import { bindTouchButtons, getInput } from "./controls.js";
import { bindAudioToggle } from "./ui/audioToggle.js";
import { installAudioUnlock } from "./audioUnlock.js";
import { installViewportResync } from "./viewportResync.js";
import { installBackgroundFreeze } from "./backgroundFreeze.js";
import { bindInstallHint } from "./ui/installHint.js";
import { bindAudioDebug } from "./ui/audioDebug.js";
import { bindFpsOverlay } from "./ui/fpsOverlay.js";
import { registerLoadingScene } from "./scenes/loading.js";
import { registerMenuScene } from "./scenes/menu.js";
import { registerGameScene } from "./scenes/game.js";
import { registerFinaleScene } from "./scenes/finale.js";

// Kick off async asset loading (Kaplay resolves k.onLoad when finished).
loadAssets();

// Wire the on-screen touch buttons once (CSS hides them on non-touch devices).
bindTouchButtons();

// Wire the global audio on/off button once; it applies any saved mute preference.
bindAudioToggle();

// Unlock the WebAudio context on the first real DOM gesture (iOS Safari needs this — see
// src/audioUnlock.js). Without it, neither music nor SFX ever play on iPhone.
installAudioUnlock();

// Re-letterbox the canvas when iOS hands the PWA back from the background: on resume in
// landscape Kaplay sometimes keeps a stale canvas size (only two colour bands show, the menu
// never loads) and a manual rotation was the only recovery. See src/viewportResync.js.
installViewportResync();

// Idle the whole PWA while it's backgrounded: freeze the game tree + suspend audio on
// visibilitychange→hidden so iOS actually suspends the app (no phantom Screen-Time "usage"
// racking up hours, no battery drain, and the time-attack clock stops). See src/backgroundFreeze.js.
installBackgroundFreeze();

// "Add to Home" hint on iOS Safari (true fullscreen lives only in the installed PWA).
bindInstallHint();

// On-screen WebAudio diagnostics — only renders when the URL carries ?audiodebug=1. Lets a
// real iPhone report its AudioContext state when iOS audio can't be reproduced in emulation.
bindAudioDebug();

// On-screen FPS / frame-time diagnostics — only renders when the URL carries ?fps=1. Lets a
// real iPhone report the engine's actual cadence (fps + worst frame delta), since emulation
// can't measure on-device fluidity. See src/ui/fpsOverlay.js.
bindFpsOverlay();

// Register every scene before navigating.
registerLoadingScene();
registerMenuScene();
registerGameScene();
registerFinaleScene();

// Start on the loading screen; it calls k.go("menu") once assets are ready.
k.go("loading");

// Register the service worker for offline play / PWA install (src/sw.js → /sw.js at the
// site root, scope "/"). Production only: on localhost it would cache files between the
// Playwright test runs (and dev edits), serving stale content — so the dev/test loop stays
// service-worker-free, exactly like the window.__pj dev handle below.
if (
  "serviceWorker" in navigator &&
  location.hostname !== "localhost" &&
  location.hostname !== "127.0.0.1"
) {
  // Keep an installed PWA on the latest deploy. If a worker already controls this page, a later
  // `controllerchange` means a NEW deploy's worker took over (sw.js does skipWaiting + clients.claim
  // so it activates at once) → reload once so the running session switches to the fresh code. The
  // "already controlled" guard skips the reload on the very first install (nothing to replace); the
  // update check runs at load / on foreground, so any reload lands near startup, not mid-level.
  let reloading = false;
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) return;
      reloading = true;
      location.reload();
    });
  }
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .then((reg) => {
        reg.update?.(); // check for a newer worker now…
        // …and again whenever the installed app is brought back to the foreground.
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") reg.update?.();
        });
      })
      .catch(() => {
        // Offline support just won't be available this session — never break the game over it.
      });
  });
}

// Dev-only test handle (localhost). Lets automated tests/dev tools introspect the
// engine AND drive it: `input` is the live virtual-input object (set .left/.right/.jump
// to play headlessly without synthetic key events); `getRunTime` reads the time-attack clock
// so the background-freeze test can assert it stops. Never attached on a real deployment.
if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
  window.__pj = { k, input: getInput(), getRunTime };
}
