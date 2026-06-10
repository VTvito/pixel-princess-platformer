// menu.js — main menu + character selection + audio unlock.
// Flow: title screen with a Start button -> three character cards -> pick one ->
// start music (this is the user gesture that unlocks audio on iOS Safari) -> game.

import { k } from "../kaplayCtx.js";
import { GAME_W, GAME_H, PALETTE, CHARACTERS, MAX_LEVEL, FINALE } from "../config.js";
import {
  setSelectedCharacter,
  getSelectedCharacter,
  getCurrentLevel,
  setCurrentLevel,
  resetScore,
  resetCoccolineRun,
} from "../state.js";
import { getLevelDef } from "../levels/index.js";
import { fadeToScene } from "../ui/transition.js";
import { hideInsertCoin } from "../ui/insertCoin.js";
import { hideReceipt } from "../ui/receipt.js";
import { sfx } from "../sfx.js";
import { playBgm } from "../audio.js";

// A reusable rounded button. Returns the root game object.
function makeButton(parent, { x, y, w, h, label, onClick, base = PALETTE.gold, text = PALETTE.deepBlue }) {
  const btn = parent.add([
    k.rect(w, h, { radius: 12 }),
    k.pos(x, y),
    k.anchor("center"),
    k.area(),
    k.color(...base),
    k.scale(1),
    "button",
  ]);

  btn.add([
    k.text(label, { size: 30 }),
    k.anchor("center"),
    k.color(...text),
  ]);

  // Hover/press feedback. touchToMouse makes this work for taps too.
  btn.onHover(() => {
    btn.scale = k.vec2(1.05);
    k.setCursor("pointer");
  });
  btn.onHoverEnd(() => {
    btn.scale = k.vec2(1);
    k.setCursor("default");
  });
  btn.onClick(onClick);
  return btn;
}

export function registerMenuScene() {
  k.scene("menu", () => {
    // Defensive: clear any DOM overlay left over from gameplay / the finale.
    hideInsertCoin();
    hideReceipt();

    // Resume the gentle menu track when we return here with audio already unlocked. On the
    // very first load the AudioContext is still locked, so this no-ops until the first click
    // (the click handlers below start it within the user gesture browsers require).
    playBgm("menu-bgm", 0.4);

    // Soft fairy-tale backdrop.
    k.add([k.rect(GAME_W, GAME_H), k.pos(0, 0), k.color(...PALETTE.lilac)]);

    // Title.
    k.add([
      k.text("\u{1F451} The Princess Journey", { size: 64 }),
      k.pos(GAME_W / 2, 110),
      k.anchor("center"),
      k.color(...PALETTE.deepBlue),
    ]);

    // Two layers: the start prompt and the (initially hidden) character chooser.
    const startLayer = k.add([k.pos(0, 0)]);
    const chooserLayer = k.add([k.pos(0, 0), k.opacity(0)]);
    chooserLayer.hidden = true;

    // The Start button overlaps the (centered) middle card position. Without this guard,
    // the single click that reveals the chooser would fall through to the card beneath
    // the cursor in the same frame and instantly pick that heroine. Cards stay inert
    // until the chooser has been active for a beat.
    let chooserActive = false;

    // --- Start layer ---
    startLayer.add([
      k.text("Un dono per Anna", { size: 28 }),
      k.pos(GAME_W / 2, 200),
      k.anchor("center"),
      k.color(...PALETTE.deepBlue),
      k.opacity(0.8),
    ]);

    // Resume: if a previous session got past level 1 (saved in localStorage), offer to
    // continue from there. The chosen character and current level both persist, so a page
    // reload can pick the journey right back up — wearing the skins unlocked so far.
    const savedLevel = getCurrentLevel();
    const savedChar = getSelectedCharacter();
    const canResume = !!savedChar && savedLevel > 1;
    // At MAX_LEVEL the journey is over — resume drops into the finale cutscene, not a
    // (non-existent) playable level (getLevelDef(5) would otherwise fall back to level 1).
    const resumeFinale = savedLevel >= MAX_LEVEL;

    const openChooser = () => {
      playBgm("menu-bgm", 0.4); // first gesture → unlock + start the menu track during selection
      startLayer.hidden = true;
      chooserLayer.hidden = false;
      chooserLayer.opacity = 1;
      // Arm card selection on the next tick so this same click can't select a card.
      k.wait(0.1, () => (chooserActive = true));
    };

    if (canResume) {
      makeButton(startLayer, {
        x: GAME_W / 2,
        y: GAME_H / 2 - 10,
        w: 420,
        h: 90,
        label: resumeFinale ? "↻  Rivedi il Gran Ballo" : `↻  Riprendi · Livello ${savedLevel}`,
        onClick: () => {
          // Start the destination's track within this gesture (unlocks the AudioContext).
          if (resumeFinale) playBgm("finale-bgm", 0.34);
          else playBgm(`bgm-${getLevelDef(savedLevel).theme.decor}`, 0.32);
          sfx("select");
          fadeToScene(() => k.go(resumeFinale ? "finale" : "game")); // keeps char + level
        },
      });
      startLayer.add([
        k.text(resumeFinale ? FINALE.title : getLevelDef(savedLevel).name, { size: 20 }),
        k.pos(GAME_W / 2, GAME_H / 2 + 48),
        k.anchor("center"),
        k.color(...PALETTE.deepBlue),
        k.opacity(0.7),
      ]);
      makeButton(startLayer, {
        x: GAME_W / 2,
        y: GAME_H / 2 + 130,
        w: 300,
        h: 76,
        label: "Nuova partita",
        onClick: openChooser,
        base: PALETTE.cream,
      });
    } else {
      makeButton(startLayer, {
        x: GAME_W / 2,
        y: GAME_H / 2 + 40,
        w: 280,
        h: 90,
        label: "▶  Start",
        onClick: openChooser,
      });
    }

    // --- Character chooser layer ---
    // Label at y=180 (spans ~162-198) clears the card top edge (240, ~232 when hover-scaled).
    chooserLayer.add([
      k.text("Scegli la tua eroina", { size: 36 }),
      k.pos(GAME_W / 2, 180),
      k.anchor("center"),
      k.color(...PALETTE.deepBlue),
    ]);

    const cardW = 300;
    const cardH = 400; // tall enough that the wrapped romantic description sits inside the card
    const gap = 60;
    const totalW = CHARACTERS.length * cardW + (CHARACTERS.length - 1) * gap;
    const startX = (GAME_W - totalW) / 2 + cardW / 2;
    const cardY = GAME_H / 2 + 80;

    CHARACTERS.forEach((char, i) => {
      const cx = startX + i * (cardW + gap);

      const card = chooserLayer.add([
        k.rect(cardW, cardH, { radius: 18 }),
        k.pos(cx, cardY),
        k.anchor("center"),
        k.area(),            // generous hit area = the whole card
        k.color(...PALETTE.cream),
        k.scale(1),
        k.outline(4, k.rgb(...char.color)),
        "card",
      ]);

      // Character sprite (64×96), sized to sit in the upper half of the card, breathing
      // gently (the idle anim) so the chooser feels alive.
      const heroSprite = card.add([
        k.sprite(char.sprite),
        k.anchor("center"),
        k.pos(0, -86),
        k.scale(1.7),
      ]);
      heroSprite.play("idle");

      card.add([
        k.text(char.name, { size: 34 }),
        k.anchor("center"),
        k.pos(0, 30),
        k.color(...PALETTE.deepBlue),
      ]);

      card.add([
        k.text(char.tagline, { size: 22 }),
        k.anchor("center"),
        k.pos(0, 70),
        k.color(...char.color),
      ]);

      card.add([
        k.text(char.description, { size: 17, width: cardW - 36, align: "center", lineSpacing: 4 }),
        k.anchor("center"),
        k.pos(0, 138),
        k.color(...PALETTE.deepBlue),
        k.opacity(0.8),
      ]);

      card.onHover(() => {
        card.scale = k.vec2(1.04);
        k.setCursor("pointer");
      });
      card.onHoverEnd(() => {
        card.scale = k.vec2(1);
        k.setCursor("default");
      });

      card.onClick(() => {
        if (!chooserActive) return; // ignore the click that opened the chooser
        setSelectedCharacter(char.id);
        setCurrentLevel(1);   // "Nuova partita" always begins the journey from level 1
        resetScore();         // a fresh journey starts from zero points
        resetCoccolineRun();  // ...and a fresh bill (the lifetime total keeps counting)
        playBgm("bgm-forest", 0.32); // level 1's track, started within this gesture
        sfx("select");
        fadeToScene(() => k.go("game"));
      });
    });
  });
}
