// finale.js — "Sala da Ballo", the closing cutscene.
// A non-playable, cinematic scene: no gravity, no input bound. The chosen heroine stands
// centre-stage as the "Principessa Perfetta" wearing all six unlocked skins, with a
// centred box showing a personalized message (edit FINALE in config.js). A single button
// (or Enter/Esc) returns to the menu.

import { k } from "../kaplayCtx.js";
import { GAME_W, GAME_H, PALETTE, CHARACTERS, SKINS, FINALE } from "../config.js";
import { getSelectedCharacter, getCoccoline, getCoccolineRun } from "../state.js";
import { addSkinLayers, syncSkins } from "../entities/player.js";
import { resetInput } from "../controls.js";
import { showReceipt, hideReceipt } from "../ui/receipt.js";
import { hideInsertCoin } from "../ui/insertCoin.js";
import { hidePause } from "../ui/pauseMenu.js";
import { hideSettings } from "../ui/settings.js";
import { fadeToScene } from "../ui/transition.js";
import { sfx } from "../sfx.js";
import { playBgm } from "../audio.js";

// Camera helper — Kaplay renamed cam setters across versions; support both.
function setCam(p) {
  if (typeof k.setCamPos === "function") k.setCamPos(p);
  else k.camPos(p);
}

export function registerFinaleScene() {
  k.scene("finale", () => {
    // Defensive: clear any leftover death overlay; the receipt is shown below after a beat.
    hideInsertCoin();
    hideReceipt();
    hidePause();
    hideSettings();
    // Cinematic scene — no controls; keep the gameplay touch buttons hidden.
    document.body.classList.remove("playing");

    const charId = getSelectedCharacter();
    const char = CHARACTERS.find((c) => c.id === charId) || CHARACTERS[0];

    // Cinematic: centre the camera (no clamped game camera carries over), drop any held
    // input, and bind no keyboard movement — this scene ignores controls entirely.
    setCam(k.vec2(GAME_W / 2, GAME_H / 2));
    resetInput();

    drawBallroom();
    playBgm("finale-bgm", 0.34); // the grand waltz under the ballroom
    k.wait(0.2, () => sfx("win")); // warm fanfare as the ballroom settles in

    // --- The heroine as "Principessa Perfetta": base body + all six skins layered on ---
    const baseY = 286;
    const avatar = k.add([
      k.sprite(char.sprite),
      k.pos(GAME_W / 2, baseY),
      k.anchor("center"),
      k.scale(2.7),
      k.z(10),
      "avatar",
    ]);
    avatar.skinLayers = addSkinLayers(avatar, SKINS.map((s) => s.key));
    avatar.play("celebrate"); // arms raised — she made it
    // Gentle idle bob; children inherit the parent's position, so the skins follow —
    // but the sheet frame does not, so mirror it every update (see animspec.js).
    avatar.onUpdate(() => {
      avatar.pos.y = baseY + Math.sin(k.time() * 1.5) * 6;
      syncSkins(avatar);
    });

    // Caption above the heroine. The crown is its own object with NO color tint, so it
    // renders as a full-colour emoji — k.color() multiplies (and would darken) the glyph.
    // It also keeps font:"sans-serif" since the pixel UI font has no emoji glyphs.
    k.add([k.text("👑", { size: 40, font: "sans-serif" }), k.pos(GAME_W / 2, 86), k.anchor("center"), k.z(11)]);
    k.add([
      k.text(FINALE.heroineTitle, { size: 34 }),
      k.pos(GAME_W / 2, 132),
      k.anchor("center"),
      k.color(...PALETTE.gold),
      k.z(11),
    ]);

    // --- Message box (the personalized note; sized for the six-chapter message) ---
    // Box, title and body are tuned so the eight-line message sits fully inside the frame
    // (it used to spill past the bottom edge): the body is centred in the space below the
    // title with margin to spare above the "Torna al menu" button.
    const boxW = 820;
    const boxH = 256;
    const boxY = 518;
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
      k.text(FINALE.title, { size: 28 }),
      k.pos(GAME_W / 2, boxY - boxH / 2 + 32),
      k.anchor("center"),
      k.color(...PALETTE.rose),
      k.z(21),
    ]);
    k.add([
      // The heartfelt letter is the one place the pixel font hurt readability (long-form text),
      // so this single object overrides to "sans-serif" — the same per-object escape hatch the
      // emoji labels use. Titles + the button above/below stay pixel for the fairy-tale look.
      k.text(FINALE.message, { size: 18, width: boxW - 72, align: "center", lineSpacing: 4, font: "sans-serif" }),
      k.pos(GAME_W / 2, boxY + 22),
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
    const toMenu = () => {
      sfx("select");
      fadeToScene(() => k.go("menu"));
    };
    btn.onClick(toMenu);
    k.onKeyPress(["enter", "space", "escape"], toMenu);

    // The payoff: the receipt is a full-screen overlay that covers the heartfelt
    // message, so hold it back long enough to actually READ the journey note first (it used
    // to pop after 1.4s and bury the message). Its "Chiudi" button returns to the message.
    const RECEIPT_DELAY = 10; // s — an unhurried read of the six-chapter message before the receipt
    k.wait(RECEIPT_DELAY, () => showReceipt(getCoccolineRun(), getCoccoline()));
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
