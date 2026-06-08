// game.js — plays the current level. Loads the tile map for getCurrentLevel(), follows
// the player with a clamped camera, wires the casual rules from spec §4 (touch a hazard
// or an enemy, or fall into a ravine → respawn at the start; collect themed pickups), and
// on reaching the goal runs the reward flow: unlock a skin, advance progress, continue to
// the next level with the new skin layered on (spec §3).

import { k } from "../kaplayCtx.js";
import {
  GAME_W,
  GAME_H,
  PALETTE,
  CHARACTERS,
  PHYSICS,
  MAX_LEVEL,
  unlockedSkinKeys,
  skinUnlockedBy,
} from "../config.js";
import { getSelectedCharacter, getCurrentLevel, setCurrentLevel, addCoccoline } from "../state.js";
import { bindKeyboard, resetInput } from "../controls.js";
import { makePlayer } from "../entities/player.js";
import { getLevelDef, hasLevel } from "../levels/index.js";
import { buildLevel } from "../levels/build.js";
import { showInsertCoin, hideInsertCoin } from "../ui/insertCoin.js";
import { hideReceipt } from "../ui/receipt.js";
import { fadeToScene } from "../ui/transition.js";
import { confettiBurst } from "../juice.js";
import { sfx } from "../sfx.js";

// Camera helper — Kaplay renamed cam setters across versions; support both.
function setCam(p) {
  if (typeof k.setCamPos === "function") k.setCamPos(p);
  else k.camPos(p);
}

export function registerGameScene() {
  k.scene("game", () => {
    // Defensive: clear any DOM overlay left over from another scene.
    hideInsertCoin();
    hideReceipt();

    const charId = getSelectedCharacter();
    const char = CHARACTERS.find((c) => c.id === charId) || CHARACTERS[0];
    const level = getCurrentLevel();
    const def = getLevelDef(level);
    const theme = def.theme;
    const icon = theme.collectibleIcon || "🍎";
    const hudColor = theme.hudText || PALETTE.cream; // some themes (snow) need dark text

    k.setGravity(PHYSICS.GRAVITY);
    resetInput(); // no direction carried in from the menu
    bindKeyboard(); // scene-scoped; touch buttons were bound once at startup

    drawBackground(theme);

    // Build the tile map (platforms, ravines, hazards, collectibles, enemies, goal).
    const { spawn, worldW, worldH, collectiblesTotal } = buildLevel(def);

    // The heroine, wearing every skin unlocked so far (spec §3). z above the tiles.
    const player = makePlayer(char, spawn, unlockedSkinKeys(level));
    player.use(k.z(10));

    // --- Camera follows horizontally, clamped to the level bounds ---
    const halfW = GAME_W / 2;
    const maxCamX = Math.max(halfW, worldW - halfW);
    k.onUpdate(() => {
      const cx = Math.min(Math.max(player.pos.x, halfW), maxCamX);
      setCam(k.vec2(cx, GAME_H / 2));
    });

    // --- Failure flow (spec §1: no silent respawn — every failure accrues a debt) ---
    // Touching a lethal obstacle or falling off the world freezes the heroine and shows a
    // DOM "Insert Coin" overlay; inserting 500 Coccoline restarts THIS level from the start
    // (skins persist, since they're derived from the saved level in state — not reset here).
    let finished = false;
    let dead = false;
    function die() {
      if (finished || dead) return;
      dead = true;
      player.paused = true; // freeze the heroine behind the overlay
      sfx("oops"); // gentle "you slipped" cue (no harsh game-over — spec §1)
      resetInput();
      showInsertCoin(() => {
        sfx("coin"); // arcade-coin chime as the debt is banked
        addCoccoline(500);
        k.go("game"); // restart the current level from the beginning
      });
    }
    // Fell into a ravine / off the bottom of the world.
    player.onUpdate(() => {
      if (!finished && !dead && player.pos.y > worldH + 120) die();
    });
    // Touched a static hazard (thorns / urchins / icicle) or a moving enemy (crab / flyer).
    player.onCollide("hazard", () => {
      if (!finished && !dead) die();
    });
    player.onCollide("enemy", () => {
      if (!finished && !dead) die();
    });

    // --- HUD (fixed; ignores the camera) ---
    k.add([k.text(char.name, { size: 28 }), k.pos(24, 18), k.color(...hudColor), k.fixed(), k.z(50)]);
    k.add([
      k.text(def.name, { size: 20 }),
      k.pos(24, 52),
      k.color(...hudColor),
      k.opacity(0.85),
      k.fixed(),
      k.z(50),
    ]);
    const itemLabel = k.add([
      k.text(`${icon} 0/${collectiblesTotal}`, { size: 26 }),
      k.pos(GAME_W - 24, 18),
      k.anchor("topright"),
      k.color(...PALETTE.gold),
      k.fixed(),
      k.z(50),
    ]);

    // --- Collectibles (golden apples / pearls) ---
    let collected = 0;
    player.onCollide("collectible", (item) => {
      if (finished || dead) return;
      // Confetti pop + chime at the pickup (spec §3).
      confettiBurst(item.pos, [
        theme.collectible,
        theme.collectibleAccent || PALETTE.cream,
        PALETTE.gold,
      ]);
      sfx("collect");
      k.destroy(item);
      collected += 1;
      itemLabel.text = `${icon} ${collected}/${collectiblesTotal}`;
    });

    // --- Goal: unlock a skin, advance progress, continue to the next level ---
    player.onCollide("goal", () => {
      if (finished || dead) return;
      finished = true;
      sfx("goal"); // triumphant arpeggio on clearing the level
      resetInput();
      const reward = skinUnlockedBy(level);
      setCurrentLevel(level + 1); // persist progress (drives the skin layering next level)
      showReward(reward, collected, collectiblesTotal, icon, level + 1);
    });

    // --- Level-name banner that fades after a moment ---
    const banner = k.add([
      k.text(def.name, { size: 48 }),
      k.pos(GAME_W / 2, 110),
      k.anchor("center"),
      k.color(...hudColor),
      k.opacity(1),
      k.fixed(),
      k.z(60),
    ]);
    let bannerT = 0;
    banner.onUpdate(() => {
      bannerT += k.dt();
      if (bannerT > 2) banner.opacity = Math.max(0, banner.opacity - k.dt());
      if (banner.opacity <= 0) k.destroy(banner);
    });

    // Back to the menu (ESC). No full-screen tap handler, so it doesn't fight the
    // on-screen controls during play.
    k.onKeyPress("escape", () => fadeToScene(() => k.go("menu")));
  });
}

// --- Themed backdrop (placeholder shapes; real art is a later prompt) ---
function drawBackground(theme) {
  k.add([k.rect(GAME_W, GAME_H), k.pos(0, 0), k.color(...theme.bg), k.fixed(), k.z(-100)]);
  k.add([
    k.rect(GAME_W, 180),
    k.pos(0, GAME_H - 180),
    k.color(...theme.bgBand),
    k.opacity(0.5),
    k.fixed(),
    k.z(-99),
  ]);
  drawParallax(theme); // depth layers that scroll slower than the camera (spec §3)
  if (theme.decor === "coral") drawCoral(theme);
  else if (theme.decor === "rooftops") {
    drawRooftops(theme);
    drawMotes(theme); // dusk fireflies/embers — ambient motion like coral's bubbles
  } else if (theme.decor === "snow") drawSnow(theme);
  else {
    drawForest(theme);
    drawMotes(theme); // enchanted-forest fireflies/pollen
  }
}

// Current camera x (Kaplay renamed the getter across versions).
function getCamX() {
  const p = typeof k.getCamPos === "function" ? k.getCamPos() : k.camPos();
  return p && Number.isFinite(p.x) ? p.x : GAME_W / 2;
}

// --- Parallax (spec §3): two layers of distant rolling hills that drift left as the camera
// advances, each at a fraction of camera speed (0.2x far, 0.5x near) for depth. They're big
// circles centred just below the screen, so only broad, overlapping domes show as a hilly
// ridge. Screen-fixed and repositioned + wrapped every frame, so they tile across any level.
// Colours come from each theme's parallaxFar/parallaxNear (tuned per level for contrast,
// with a fallback to the old decoFar/solid tones for any level that omits them). ---
function drawParallax(theme) {
  const far = theme.parallaxFar || theme.decoFar;
  const near = theme.parallaxNear || theme.solid;
  const layers = [
    { factor: 0.2, color: far, cy: GAME_H + 130, r: 340, gap: 520, op: 0.45 },
    { factor: 0.5, color: near, cy: GAME_H + 90, r: 280, gap: 420, op: 0.55 },
  ];
  layers.forEach(({ factor, color, cy, r, gap, op }) => {
    const count = Math.ceil(GAME_W / gap) + 3;
    const span = count * gap;
    const blobs = [];
    for (let i = 0; i < count; i++) {
      blobs.push(
        k.add([
          k.circle(r),
          k.pos(i * gap, cy),
          k.anchor("center"),
          k.color(...color),
          k.opacity(op),
          k.fixed(),
          k.z(-98), // above the bg band (-99), behind the themed decor (-95/-96)
          { baseX: i * gap },
        ]),
      );
    }
    k.onUpdate(() => {
      const shift = getCamX() * factor;
      blobs.forEach((b) => {
        let x = (b.baseX - shift) % span;
        if (x < 0) x += span; // wrap into [0, span)
        b.pos.x = x - 1.5 * gap; // lead-in off the left edge
      });
    });
  });
}

// Tall tree silhouettes (alberi alti). Fixed = a calm far-parallax layer.
function drawForest(theme) {
  const treeXs = [120, 360, 640, 920, 1180];
  treeXs.forEach((tx, i) => {
    const far = i % 2 === 0;
    const col = far ? theme.decoFar : theme.decoNear;
    const h = far ? 380 : 320;
    k.add([k.rect(26, h), k.pos(tx, GAME_H - 120), k.anchor("bot"), k.color(...col), k.fixed(), k.z(-95)]);
    for (let t = 0; t < 3; t++) {
      const cw = 160 - t * 32;
      k.add([
        k.polygon([k.vec2(-cw / 2, 0), k.vec2(cw / 2, 0), k.vec2(0, -130)]),
        k.pos(tx, GAME_H - 120 - h * 0.45 - t * 72),
        k.color(...col),
        k.fixed(),
        k.z(-94),
      ]);
    }
  });
}

// Coral fronds + drifting bubbles for the underwater level.
function drawCoral(theme) {
  const coralXs = [140, 380, 660, 940, 1180];
  coralXs.forEach((cxp, i) => {
    const far = i % 2 === 0;
    const col = far ? theme.decoFar : theme.decoNear;
    const h = far ? 220 : 170;
    const baseY = GAME_H - 80;
    // A branching coral: a trunk plus a couple of arms.
    k.add([k.rect(20, h), k.pos(cxp, baseY), k.anchor("bot"), k.color(...col), k.fixed(), k.z(-95)]);
    k.add([k.rect(16, h * 0.6), k.pos(cxp - 28, baseY), k.anchor("bot"), k.color(...col), k.fixed(), k.z(-95), k.rotate(18)]);
    k.add([k.rect(16, h * 0.6), k.pos(cxp + 28, baseY), k.anchor("bot"), k.color(...col), k.fixed(), k.z(-95), k.rotate(-18)]);
  });
  // Drifting bubbles.
  for (let i = 0; i < 14; i++) {
    const bx = k.rand(0, GAME_W);
    const speed = k.rand(12, 30);
    const bub = k.add([
      k.circle(k.rand(3, 8)),
      k.pos(bx, k.rand(0, GAME_H)),
      k.color(200, 230, 245),
      k.opacity(0.25),
      k.fixed(),
      k.z(-90),
    ]);
    bub.onUpdate(() => {
      bub.pos.y -= speed * k.dt();
      if (bub.pos.y < -10) bub.pos.y = GAME_H + 10;
    });
  }
}

// Pagoda-roof silhouettes for the eastern-rooftops level (calm far-parallax layer).
function drawRooftops(theme) {
  const roofs = [
    { x: 180, w: 300, far: true },
    { x: 520, w: 250, far: false },
    { x: 870, w: 320, far: true },
    { x: 1170, w: 250, far: false },
  ];
  roofs.forEach((r) => {
    const col = r.far ? theme.decoFar : theme.decoNear;
    const baseY = GAME_H - (r.far ? 150 : 120);
    // Wall block under the roof.
    k.add([k.rect(r.w - 90, 180), k.pos(r.x, baseY), k.anchor("top"), k.color(...col), k.fixed(), k.z(-96)]);
    // Upturned pagoda roof (a wide trapezoid).
    k.add([
      k.polygon([k.vec2(-r.w / 2, 0), k.vec2(r.w / 2, 0), k.vec2(r.w / 2 - 46, -76), k.vec2(-r.w / 2 + 46, -76)]),
      k.pos(r.x, baseY),
      k.color(...col),
      k.fixed(),
      k.z(-95),
    ]);
    // A small finial on the ridge.
    k.add([k.rect(8, 26), k.pos(r.x, baseY - 76), k.anchor("bot"), k.color(...col), k.fixed(), k.z(-95)]);
  });
}

// Floating ambient motes that drift upward, gently sway, and twinkle — used for the
// enchanted forest's fireflies/pollen and the eastern-rooftops dusk embers (tint via
// theme.mote). Mirrors the drifting bubbles (coral) and snow (alpine) so every level has
// signature ambient motion.
function drawMotes(theme) {
  const tint = theme.mote || [255, 198, 120];
  for (let i = 0; i < 18; i++) {
    const rise = k.rand(10, 26);
    const swayAmp = k.rand(6, 16);
    const swaySpd = k.rand(0.6, 1.4);
    const baseOp = k.rand(0.3, 0.6);
    const m = k.add([
      k.circle(k.rand(2, 4)),
      k.pos(k.rand(0, GAME_W), k.rand(0, GAME_H)),
      k.color(...tint),
      k.opacity(baseOp),
      k.fixed(),
      k.z(-90),
      { baseX: 0, t: k.rand(0, Math.PI * 2), baseOp },
    ]);
    m.baseX = m.pos.x;
    m.onUpdate(() => {
      m.t += k.dt() * swaySpd;
      m.pos.y -= rise * k.dt();
      m.pos.x = m.baseX + Math.sin(m.t) * swayAmp;
      m.opacity = m.baseOp * (0.6 + 0.4 * (0.5 + 0.5 * Math.sin(m.t * 2.3))); // gentle twinkle
      if (m.pos.y < -8) {
        m.pos.y = GAME_H + 8;
        m.baseX = k.rand(0, GAME_W);
      }
    });
  }
}

// Snowy peaks + falling snow for the alpine level.
function drawSnow(theme) {
  const peaks = [
    { x: 220, w: 540, h: 360, far: true },
    { x: 690, w: 620, h: 440, far: false },
    { x: 1150, w: 560, h: 380, far: true },
  ];
  const baseY = GAME_H - 120;
  peaks.forEach((p) => {
    const col = p.far ? theme.decoFar : theme.decoNear;
    k.add([
      k.polygon([k.vec2(-p.w / 2, 0), k.vec2(p.w / 2, 0), k.vec2(0, -p.h)]),
      k.pos(p.x, baseY),
      k.color(...col),
      k.fixed(),
      k.z(-95),
    ]);
    // Bright snow cap near the summit.
    k.add([
      k.polygon([k.vec2(-58, 0), k.vec2(58, 0), k.vec2(0, -88)]),
      k.pos(p.x, baseY - p.h + 88),
      k.color(240, 248, 255),
      k.fixed(),
      k.z(-94),
    ]);
  });
  // Falling snowflakes.
  for (let i = 0; i < 40; i++) {
    const speed = k.rand(22, 56);
    const drift = k.rand(-14, 14);
    const fl = k.add([
      k.circle(k.rand(1.5, 3.5)),
      k.pos(k.rand(0, GAME_W), k.rand(0, GAME_H)),
      k.color(255, 255, 255),
      k.opacity(0.85),
      k.fixed(),
      k.z(-90),
    ]);
    fl.onUpdate(() => {
      fl.pos.y += speed * k.dt();
      fl.pos.x += drift * k.dt();
      if (fl.pos.y > GAME_H + 6) {
        fl.pos.y = -6;
        fl.pos.x = k.rand(0, GAME_W);
      }
    });
  }
}

// --- Reward overlay: announce the unlocked skin, then continue to the next level ---
function showReward(reward, got, total, icon, nextLevel) {
  k.add([
    k.rect(GAME_W, GAME_H),
    k.pos(0, 0),
    k.color(...PALETTE.deepBlue),
    k.opacity(0.6),
    k.fixed(),
    k.z(80),
  ]);
  k.add([
    k.text("Livello completato!", { size: 50 }),
    k.pos(GAME_W / 2, GAME_H / 2 - 110),
    k.anchor("center"),
    k.color(...PALETTE.cream),
    k.fixed(),
    k.z(81),
  ]);
  if (reward) {
    k.add([
      k.text("Hai sbloccato:", { size: 26 }),
      k.pos(GAME_W / 2, GAME_H / 2 - 40),
      k.anchor("center"),
      k.color(...PALETTE.cream),
      k.opacity(0.9),
      k.fixed(),
      k.z(81),
    ]);
    k.add([
      k.text(`✨ ${reward.name} ✨`, { size: 38 }),
      k.pos(GAME_W / 2, GAME_H / 2 + 2),
      k.anchor("center"),
      k.color(...PALETTE.gold),
      k.fixed(),
      k.z(81),
    ]);
  }
  k.add([
    k.text(`${icon} ${got}/${total}`, { size: 26 }),
    k.pos(GAME_W / 2, GAME_H / 2 + 56),
    k.anchor("center"),
    k.color(...PALETTE.cream),
    k.opacity(0.9),
    k.fixed(),
    k.z(81),
  ]);

  // Where does "continue" lead? Another playable level, the finale (after the last one),
  // or — defensively — back to the menu.
  const more = hasLevel(nextLevel);
  const toFinale = !more && nextLevel >= MAX_LEVEL;
  const label = more ? "Continua  ▶" : toFinale ? "Al Gran Ballo  ▶" : "Torna al menu";
  const dest = more ? "game" : toFinale ? "finale" : "menu";

  const btn = k.add([
    k.rect(320, 78, { radius: 14 }),
    k.pos(GAME_W / 2, GAME_H / 2 + 140),
    k.anchor("center"),
    k.area(),
    k.color(...PALETTE.gold),
    k.fixed(),
    k.z(81),
  ]);
  btn.add([
    k.text(label, { size: 26 }),
    k.anchor("center"),
    k.color(...PALETTE.deepBlue),
  ]);

  const proceed = () => {
    sfx("select");
    fadeToScene(() => k.go(dest));
  };
  btn.onClick(proceed);
  k.onKeyPress(["enter", "space"], proceed);
  if (toFinale) {
    k.add([
      k.text("La tua storia ti aspetta...", { size: 18 }),
      k.pos(GAME_W / 2, GAME_H / 2 + 196),
      k.anchor("center"),
      k.color(...PALETTE.cream),
      k.opacity(0.7),
      k.fixed(),
      k.z(81),
    ]);
  }
}
