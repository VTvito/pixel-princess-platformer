// assets.js — registers every asset from the ASSETS manifest with Kaplay.
// Kaplay loads are async; main.js waits for k.onLoad before leaving the loading scene.

import { k } from "./kaplayCtx.js";
import { ASSETS } from "./config.js";

export function loadAssets() {
  for (const [key, path] of Object.entries(ASSETS.sprites)) {
    k.loadSprite(key, path);
  }
  for (const [key, path] of Object.entries(ASSETS.sounds)) {
    k.loadSound(key, path);
  }
}
