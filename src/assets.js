// assets.js — registers every asset from the ASSETS manifest with Kaplay.
// Kaplay loads are async; main.js waits for k.onLoad before leaving the loading scene.

import { k } from "./kaplayCtx.js";
import { ASSETS } from "./config.js";
import { SHEET, ANIMS, ANIMATED_SPRITES } from "./animspec.js";

export function loadAssets() {
  for (const [key, path] of Object.entries(ASSETS.sprites)) {
    if (ANIMATED_SPRITES.includes(key)) {
      // Heroines + skins are 8×2 animation sheets sharing one contract (animspec.js).
      k.loadSprite(key, path, { sliceX: SHEET.cols, sliceY: SHEET.rows, anims: ANIMS });
    } else {
      k.loadSprite(key, path);
    }
  }
  // Tile atlas (spec §2): one image, many named frames usable as k.sprite("ground_top").
  if (ASSETS.tiles) {
    k.loadSpriteAtlas(ASSETS.tiles.atlas, ASSETS.tiles.frames);
  }
  // Parallax background layers (spec §2).
  for (const [key, path] of Object.entries(ASSETS.backgrounds || {})) {
    k.loadSprite(key, path);
  }
  for (const [key, path] of Object.entries(ASSETS.sounds)) {
    k.loadSound(key, path);
  }
}
