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
  SCORE,
  POWERUP,
  MAX_LEVEL,
  unlockedSkinKeys,
  skinUnlockedBy,
} from "../config.js";
import {
  getSelectedCharacter,
  getCurrentLevel,
  setCurrentLevel,
  addCoccoline,
  addScore,
  getScore,
} from "../state.js";
import { bindKeyboard, resetInput } from "../controls.js";
import { makePlayer } from "../entities/player.js";
import { getLevelDef, hasLevel } from "../levels/index.js";
import { buildLevel } from "../levels/build.js";
import { showInsertCoin, hideInsertCoin } from "../ui/insertCoin.js";
import { hideReceipt } from "../ui/receipt.js";
import { fadeToScene } from "../ui/transition.js";
import { confettiBurst } from "../juice.js";
import { sfx } from "../sfx.js";
import { playBgm } from "../audio.js";

// Camera helper — Kaplay renamed cam setters across versions; support both.
function setCam(p) {
  if (typeof k.setCamPos === "function") k.setCamPos(p);
  else k.camPos(p);
}

// Give the game canvas keyboard focus (so keys work after a DOM-overlay respawn). The
// canvas carries tabindex="0" (index.html) so it can hold focus.
function focusCanvas() {
  const canvas = k.canvas || (typeof document !== "undefined" && document.getElementById("game"));
  canvas?.focus?.();
}

export function registerGameScene() {
  k.scene("game", () => {
    // Defensive: clear any DOM overlay left over from another scene.
    hideInsertCoin();
    hideReceipt();

    // Dev autoplay hook (tools/test/play.mjs): reset the per-level goal flag on entry.
    // `deaths` is cumulative across retries (the bot zeroes it before a run). No-op off
    // localhost, where window.__pj is never attached (see main.js).
    const dbg = (typeof window !== "undefined" && window.__pj && window.__pj.debug) || null;
    if (dbg) dbg.reachedGoal = false;

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
    // Return keyboard focus to the canvas. The "Insert Coin" overlay is a DOM button, so
    // clicking it to respawn moves focus off the canvas — without this, keys silently stop
    // working after a restart ("the heroine won't start"). See src/ui/insertCoin.js too.
    focusCanvas();
    playBgm("game-bgm", 0.32); // gameplay music (idempotent: a level restart won't restart it)

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
      // Round to whole pixels: with crisp/nearest-neighbour sampling, a fractional camera
      // makes tiles/sprites shimmer ("scattoso") as they cross sample boundaries.
      setCam(k.vec2(Math.round(cx), GAME_H / 2));
    });

    // --- Failure flow (spec §1: no silent respawn — every failure accrues a debt) ---
    // Touching a lethal obstacle or falling off the world freezes the heroine and shows a
    // DOM "Insert Coin" overlay; inserting 500 Coccoline restarts THIS level from the start
    // (skins persist, since they're derived from the saved level in state — not reset here).
    let finished = false;
    let dead = false;
    // Star power-up: while invincible, hazards/enemies can't hurt the heroine and touching an
    // enemy defeats it. A fall off the world still ends the run (handled in die's callers).
    let invincibleUntil = 0;
    const isInvincible = () => k.time() < invincibleUntil;
    function die() {
      if (finished || dead) return;
      dead = true;
      if (dbg) dbg.deaths += 1;
      player.setAnim("hurt"); // the "ops" face — set before pausing freezes updates
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
    // Touched a static hazard (thorns / urchins / icicle) → respawn, unless star-invincible.
    player.onCollide("hazard", () => {
      if (!finished && !dead && !isInvincible()) die();
    });
    // Moving enemy (crab / flyer). While star-invincible, any contact plows through it for
    // points. Otherwise Mario-style stomp: coming DOWN onto it from above defeats it with a
    // hop + points; any other contact (side / from below) respawns.
    player.onCollide("enemy", (enemy) => {
      if (finished || dead) return;
      const stomping = player.vel.y > 60 && player.pos.y < enemy.pos.y;
      if (isInvincible() || stomping) {
        confettiBurst(enemy.pos, [theme.collectible, PALETTE.cream, PALETTE.gold]);
        sfx("jump"); // springy bounce / plough-through
        k.destroy(enemy);
        if (stomping) player.vel.y = -PHYSICS.STOMP_BOUNCE; // bounce back up off a stomp
        bumpScore(SCORE.STOMP);
      } else {
        die();
      }
    });
    // Star power-up: grant a window of invincibility + points, with a pulsing aura on the
    // heroine for feedback. Re-grabbing simply refreshes the timer.
    player.onCollide("powerup", (star) => {
      if (finished || dead) return;
      confettiBurst(star.pos, [PALETTE.gold, PALETTE.cream, theme.collectible]);
      sfx("coin");
      k.destroy(star);
      invincibleUntil = k.time() + POWERUP.DURATION;
      bumpScore(SCORE.POWERUP);
      spawnInvincibleAura();
    });
    // The aura that trails the heroine while a star is active (one at a time).
    function spawnInvincibleAura() {
      if (k.get("inv-aura").length) return; // already showing; the timer was just refreshed
      const aura = k.add([
        k.circle(42),
        k.pos(player.pos),
        k.anchor("center"),
        k.color(...PALETTE.gold),
        k.opacity(0),
        k.z(9), // just behind the heroine (z 10)
        "inv-aura",
      ]);
      aura.onUpdate(() => {
        if (!isInvincible()) return k.destroy(aura);
        aura.pos = player.pos;
        const pulse = 0.5 + 0.5 * Math.sin(k.time() * 12);
        aura.opacity = 0.16 + 0.2 * pulse;
        aura.radius = 38 + 8 * pulse;
      });
    }

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
    // Running journey score (Mario-style): pickups + stomps. Persists across levels.
    const scoreLabel = k.add([
      k.text(`★ ${getScore()}`, { size: 22 }),
      k.pos(GAME_W - 24, 54),
      k.anchor("topright"),
      k.color(...hudColor),
      k.fixed(),
      k.z(50),
    ]);
    const bumpScore = (amount) => {
      addScore(amount);
      scoreLabel.text = `★ ${getScore()}`;
    };
    // Invincibility indicator (top centre): shown only while a star is active, counting down.
    const invLabel = k.add([
      k.text("", { size: 24 }),
      k.pos(GAME_W / 2, 30),
      k.anchor("center"),
      k.color(...PALETTE.gold),
      k.fixed(),
      k.z(50),
    ]);
    invLabel.hidden = true;
    k.onUpdate(() => {
      const active = isInvincible();
      invLabel.hidden = !active;
      if (active) invLabel.text = `★ INVINCIBILE  ${Math.ceil(invincibleUntil - k.time())}`;
    });

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
      bumpScore(SCORE.PICKUP);
    });

    // --- Goal: unlock a skin, advance progress, continue to the next level ---
    player.onCollide("goal", () => {
      if (finished || dead) return;
      finished = true;
      if (dbg) dbg.reachedGoal = true;
      player.setAnim("celebrate"); // arms up while the reward card shows
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

// --- Themed backdrop (spec §2): three generated parallax image layers per theme (sky / mid /
// near) plus the signature ambient particles. The static silhouette polygons were replaced by
// the mid/near images; the particle systems (motes / bubbles / snow) are kept as juice. ---
function drawBackground(theme) {
  const decor = theme.decor; // "forest" | "coral" | "rooftops" | "snow" → background key prefix
  // Sky: a full-screen (1280×720) gradient image, screen-fixed behind everything.
  k.add([k.sprite(`${decor}_sky`), k.pos(0, 0), k.fixed(), k.z(-100)]);
  drawParallax(decor); // mid + near silhouette layers, scrolled below camera speed
  // Signature ambient particles per theme.
  if (decor === "coral") drawBubbles();
  else if (decor === "snow") drawSnowflakes();
  else drawMotes(theme); // forest fireflies/pollen + rooftops dusk embers
}

// Current camera x (Kaplay renamed the getter across versions).
function getCamX() {
  const p = typeof k.getCamPos === "function" ? k.getCamPos() : k.camPos();
  return p && Number.isFinite(p.x) ? p.x : GAME_W / 2;
}

// --- Parallax (spec §2/§3): the "<decor>_mid" and "<decor>_near" images, screen-fixed and
// bottom-aligned, scrolled at a fraction of camera speed (0.5 / 0.8) for depth. Each image is
// 1920px wide; we lay down enough copies to cover the viewport and wrap them modulo the strip
// span every frame, so the silhouettes tile seamlessly across any level width. ---
function drawParallax(decor) {
  const layers = [
    { key: `${decor}_mid`, imgW: 1920, factor: 0.5, z: -98 },
    { key: `${decor}_near`, imgW: 1920, factor: 0.8, z: -97 },
  ];
  layers.forEach(({ key, imgW, factor, z }) => {
    const count = Math.ceil(GAME_W / imgW) + 2; // cover the viewport + room to wrap
    const span = count * imgW;
    const tiles = [];
    for (let i = 0; i < count; i++) {
      tiles.push(
        k.add([
          k.sprite(key),
          k.pos(i * imgW, GAME_H),
          k.anchor("botleft"), // sit the silhouette on the bottom edge
          k.fixed(),
          k.z(z),
          { baseX: i * imgW },
        ]),
      );
    }
    k.onUpdate(() => {
      const shift = getCamX() * factor;
      tiles.forEach((t) => {
        let x = (t.baseX - shift) % span;
        if (x < 0) x += span; // wrap into [0, span)
        t.pos.x = Math.round(x - imgW); // whole pixels (no shimmer); lead-in off the left edge
      });
    });
  });
}

// Drifting bubbles for the underwater level (extracted from the old drawCoral; the coral
// fronds now live in the coral_mid/near parallax images).
function drawBubbles() {
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

// Falling snow for the alpine level (extracted from the old drawSnow; the peaks now live in
// the snow_mid/near parallax images).
function drawSnowflakes() {
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
    k.text(`${icon} ${got}/${total}    ★ ${getScore()}`, { size: 26 }),
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
