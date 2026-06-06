// main.js — entry point. Creates the engine (via kaplayCtx), registers scenes, starts
// loading assets, and shows the loading scene which advances to the menu when ready.

import { k } from "./kaplayCtx.js";
import { loadAssets } from "./assets.js";
import { bindTouchButtons } from "./controls.js";
import { bindAudioToggle } from "./ui/audioToggle.js";
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

// Register every scene before navigating.
registerLoadingScene();
registerMenuScene();
registerGameScene();
registerFinaleScene();

// Start on the loading screen; it calls k.go("menu") once assets are ready.
k.go("loading");

// Dev-only test handle (localhost). Lets automated tests/dev tools introspect the
// engine; never attached on a real deployment.
if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
  window.__pj = { k };
}
