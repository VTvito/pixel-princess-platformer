// loading.js — minimal branded loading screen.
// Assets start loading in main.js before this scene runs; k.onLoad fires once they are
// all ready, then we hand off to the menu.

import { k } from "../kaplayCtx.js";
import { GAME_W, GAME_H, PALETTE } from "../config.js";

export function registerLoadingScene() {
  k.scene("loading", () => {
    k.add([k.rect(GAME_W, GAME_H), k.pos(0, 0), k.color(...PALETTE.deepBlue)]);

    k.add([
      k.text("The Princess Journey", { size: 56 }),
      k.pos(GAME_W / 2, GAME_H / 2 - 60),
      k.anchor("center"),
      k.color(...PALETTE.gold),
    ]);

    k.add([
      k.text("Caricamento...", { size: 28 }),
      k.pos(GAME_W / 2, GAME_H / 2 + 20),
      k.anchor("center"),
      k.color(...PALETTE.cream),
    ]);

    // A small pulsing dot as a lightweight progress indicator.
    const dot = k.add([
      k.circle(10),
      k.pos(GAME_W / 2, GAME_H / 2 + 80),
      k.anchor("center"),
      k.color(...PALETTE.rose),
      k.opacity(1),
    ]);
    dot.onUpdate(() => {
      dot.opacity = 0.4 + 0.6 * Math.abs(Math.sin(k.time() * 3));
    });

    // When every asset is ready, move to the menu.
    k.onLoad(() => k.go("menu"));
  });
}
