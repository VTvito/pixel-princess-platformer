// finale.js — "Sala da Ballo", the closing cutscene (spec §5).
// A non-playable, cinematic scene: no gravity, no input bound. The chosen heroine stands
// centre-stage as the "Principessa Perfetta" wearing all four unlocked skins, with a
// centred box showing a personalized message (edit FINALE in config.js). A single button
// (or Enter/Esc) returns to the menu.

import { k } from "../kaplayCtx.js";
import { GAME_W, GAME_H, PALETTE, CHARACTERS, SKINS, FINALE } from "../config.js";
import { getSelectedCharacter } from "../state.js";
import { addSkinLayers } from "../entities/player.js";
import { resetInput } from "../controls.js";

// Camera helper — Kaplay renamed cam setters across versions; support both.
function setCam(p) {
  if (typeof k.setCamPos === "function") k.setCamPos(p);
  else k.camPos(p);
}

export function registerFinaleScene() {
  k.scene("finale", () => {
    const charId = getSelectedCharacter();
    const char = CHARACTERS.find((c) => c.id === charId) || CHARACTERS[0];

    // Cinematic: centre the camera (no clamped game camera carries over), drop any held
    // input, and bind no keyboard movement — this scene ignores controls entirely.
    setCam(k.vec2(GAME_W / 2, GAME_H / 2));
    resetInput();

    drawBallroom();

    // --- The heroine as "Principessa Perfetta": base body + all four skins layered on ---
    const baseY = 300;
    const avatar = k.add([
      k.sprite(char.sprite),
      k.pos(GAME_W / 2, baseY),
      k.anchor("center"),
      k.scale(4),
      k.z(10),
      "avatar",
    ]);
    avatar.skinLayers = addSkinLayers(avatar, SKINS.map((s) => s.key));
    // Gentle idle bob; children inherit the parent's position, so the skins follow.
    avatar.onUpdate(() => {
      avatar.pos.y = baseY + Math.sin(k.time() * 1.5) * 6;
    });

    // Caption above the heroine. The crown is its own object with NO color tint, so it
    // renders as a full-colour emoji — k.color() multiplies (and would darken) the glyph.
    k.add([k.text("👑", { size: 40 }), k.pos(GAME_W / 2, 86), k.anchor("center"), k.z(11)]);
    k.add([
      k.text(FINALE.heroineTitle, { size: 34 }),
      k.pos(GAME_W / 2, 132),
      k.anchor("center"),
      k.color(...PALETTE.gold),
      k.z(11),
    ]);

    // --- Message box (the personalized note) ---
    const boxW = 760;
    const boxH = 210;
    const boxY = GAME_H - 175;
    k.add([
      k.rect(boxW, boxH, { radius: 20 }),
      k.pos(GAME_W / 2, boxY),
      k.anchor("center"),
      k.color(...PALETTE.cream),
      k.opacity(0.95),
      k.outline(4, k.rgb(...PALETTE.gold)),
      k.z(20),
    ]);
    k.add([
      k.text(FINALE.title, { size: 30 }),
      k.pos(GAME_W / 2, boxY - boxH / 2 + 36),
      k.anchor("center"),
      k.color(...PALETTE.rose),
      k.z(21),
    ]);
    k.add([
      k.text(FINALE.message, { size: 22, width: boxW - 80, align: "center", lineSpacing: 6 }),
      k.pos(GAME_W / 2, boxY + 14),
      k.anchor("center"),
      k.color(...PALETTE.deepBlue),
      k.z(21),
    ]);

    // --- Return-to-menu button (also Enter / Space / Esc) ---
    const btn = k.add([
      k.rect(260, 60, { radius: 14 }),
      k.pos(GAME_W / 2, GAME_H - 34),
      k.anchor("center"),
      k.area(),
      k.color(...PALETTE.gold),
      k.z(30),
    ]);
    btn.add([k.text("Torna al menu", { size: 24 }), k.anchor("center"), k.color(...PALETTE.deepBlue)]);
    btn.onHover(() => {
      btn.scale = k.vec2(1.05);
      k.setCursor("pointer");
    });
    btn.onHoverEnd(() => {
      btn.scale = k.vec2(1);
      k.setCursor("default");
    });
    const toMenu = () => k.go("menu");
    btn.onClick(toMenu);
    k.onKeyPress(["enter", "space", "escape"], toMenu);
  });
}

// --- Grand ballroom backdrop (primitive art, matching the level draw* style) ---
function drawBallroom() {
  // Warm wall + a brighter floor band.
  k.add([k.rect(GAME_W, GAME_H), k.pos(0, 0), k.color(...PALETTE.lilac), k.z(-100)]);
  k.add([k.rect(GAME_W, 200), k.pos(0, GAME_H - 200), k.color(...PALETTE.cream), k.opacity(0.4), k.z(-99)]);

  // A few stately columns.
  [200, 480, 800, 1080].forEach((cx) => {
    k.add([k.rect(56, 460), k.pos(cx, 110), k.anchor("top"), k.color(...PALETTE.cream), k.opacity(0.5), k.z(-95)]);
    // Capital + base blocks.
    k.add([k.rect(72, 22), k.pos(cx, 110), k.anchor("top"), k.color(...PALETTE.gold), k.opacity(0.6), k.z(-94)]);
    k.add([k.rect(72, 22), k.pos(cx, 568), k.anchor("bot"), k.color(...PALETTE.gold), k.opacity(0.6), k.z(-94)]);
  });

  // A simple chandelier centred near the top.
  k.add([k.rect(6, 70), k.pos(GAME_W / 2, 0), k.anchor("top"), k.color(...PALETTE.gold), k.z(-93)]);
  k.add([k.circle(26), k.pos(GAME_W / 2, 80), k.color(...PALETTE.gold), k.opacity(0.9), k.z(-93)]);

  // Twinkling sparkles drifting in the hall (scene-scoped → auto-cleaned on leave).
  for (let i = 0; i < 24; i++) {
    const phase = k.rand(0, Math.PI * 2);
    const speed = k.rand(1.5, 3.5);
    const sp = k.add([
      k.circle(k.rand(1.5, 3.5)),
      k.pos(k.rand(0, GAME_W), k.rand(60, GAME_H - 220)),
      k.color(...PALETTE.gold),
      k.opacity(0.6),
      k.z(-90),
    ]);
    sp.onUpdate(() => {
      sp.opacity = 0.25 + 0.5 * Math.abs(Math.sin(k.time() * speed + phase));
    });
  }
}
