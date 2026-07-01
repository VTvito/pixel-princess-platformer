// game.js — plays the current level. Loads the tile map for getCurrentLevel(), follows
// the player with a clamped camera, wires the casual rules (touch a hazard
// or an enemy, or fall into a ravine → respawn at the start; collect themed pickups), and
// on reaching the goal runs the reward flow: unlock a skin, advance progress, continue to
// the next level with the new skin layered on.

import { k, coarsePointer, maxFPS, setFrameCap } from "../kaplayCtx.js";
import {
  GAME_W,
  GAME_H,
  PALETTE,
  CHARACTERS,
  PHYSICS,
  CAMERA,
  MECHANICS,
  SCORE,
  POWERUP,
  PERF,
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
  getLives,
  addLife,
  addHeartTaken,
  loseLife,
  getCheckpoint,
  setCheckpoint,
  clearCheckpoint,
  resetRun,
} from "../state.js";
import { bindKeyboard, resetInput } from "../controls.js";
import { makePlayer, addSkinLayers, syncSkins } from "../entities/player.js";
import { getLevelDef, hasLevel } from "../levels/index.js";
import { buildLevel } from "../levels/build.js";
import { showInsertCoin, hideInsertCoin } from "../ui/insertCoin.js";
import { showGameOver, hideGameOver } from "../ui/gameOver.js";
import { hideLeaderboard } from "../ui/leaderboard.js";
import { showPause, hidePause } from "../ui/pauseMenu.js";
import { showSettings, hideSettings } from "../ui/settings.js";
import { hideReceipt } from "../ui/receipt.js";
import { fadeToScene } from "../ui/transition.js";
import { confettiBurst, dustPuff, hitStop, screenShake, resetHitStop } from "../juice.js";
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

// Checkpoint memory (Phase 4): survives the k.go("game") restart that the death flow
// uses, but resets when the level changes or the scene is entered fresh from the menu (so
// "Nuova partita" can never inherit a stale checkpoint). It is ALSO mirrored to localStorage
// (src/state.js) so an interruption — reload, closing the browser, menu→resume — picks the
// level back up from the last flag (see the entry logic below).
let checkpointAt = null;
let checkpointLevel = 0;
let respawningFromDeath = false;
// Set by the pause menu's "Ricomincia il livello": a voluntary do-over starts at the level's
// spawn, ignoring the persisted checkpoint for this one entry (the checkpoint itself is kept).
let forceSpawn = false;

export function registerGameScene() {
  k.scene("game", () => {
    // Defensive: clear any DOM overlay left over from another scene, and make sure the
    // world is running (a previous pause always unfreezes before leaving, but re-entry
    // resets it too so a stale pause can never carry over).
    hideInsertCoin();
    hideGameOver();
    hideReceipt();
    hideLeaderboard();
    hidePause();
    hideSettings();
    k.getTreeRoot().paused = false;
    resetHitStop(); // a hit-stop interrupted by the restart must never leak a 0.15× timeScale here
    setFrameCap(maxFPS); // active play runs at the full rate (60 mobile / uncapped desktop); a
    // previous menu/pause/reward may have throttled it — restore it the instant a level starts.
    // Reveal the on-screen touch controls (CSS shows them only while body.playing).
    document.body.classList.add("playing");

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
    playBgm(`bgm-${theme.decor}`, 0.32); // the theme's own track (idempotent on restart)

    drawBackground(theme);

    // Build the tile map (platforms, ravines, hazards, collectibles, enemies, goal).
    const { spawn, worldW, worldH, collectiblesTotal } = buildLevel(def);

    // Where does the heroine start?
    //  • A death-retry on this same level resumes from the in-memory checkpoint.
    //  • Any OTHER entry (menu "Riprendi", a reload, reopening the browser) falls back to the
    //    PERSISTED checkpoint for this level, so an interruption picks up mid-level.
    //  • A brand-new game ("Nuova partita") cleared the checkpoint, and a voluntary pause
    //    restart (forceSpawn) ignores it for this one entry → both start at the level's spawn.
    if (!respawningFromDeath || checkpointLevel !== level) checkpointAt = null;
    if (!checkpointAt && !forceSpawn) {
      const cp = getCheckpoint();
      if (cp && cp.level === level) checkpointAt = { x: cp.x, y: cp.y };
    }
    forceSpawn = false;
    checkpointLevel = level;
    respawningFromDeath = false;
    const startPos = checkpointAt ? k.vec2(checkpointAt.x, checkpointAt.y) : spawn;

    // The heroine, wearing every skin unlocked so far. z above the tiles.
    // def.feel lets a level tweak the handling (e.g. the icy level's longer accel ramp).
    const player = makePlayer(char, startPos, unlockedSkinKeys(level), def.feel || {});
    player.use(k.z(10));

    // --- Camera: leads the heroine in her facing direction (Mario-style lookahead) and
    // eases toward the target, clamped to the level bounds. Vertical follow only engages
    // on maps taller than the viewport (height-11 maps render exactly as before); it
    // tracks a point slightly above the heroine so she sits below the screen centre.
    const halfW = GAME_W / 2;
    const halfH = GAME_H / 2;
    const maxCamX = Math.max(halfW, worldW - halfW);
    const maxCamY = Math.max(halfH, worldH - halfH);
    const followY = worldH > GAME_H;
    const camTargetY = () => Math.min(Math.max(player.pos.y - 40, halfH), maxCamY);
    let camX = Math.min(Math.max(player.pos.x, halfW), maxCamX); // start centred on spawn
    let camY = followY ? camTargetY() : halfH;
    k.onUpdate(() => {
      const targetX = Math.min(Math.max(player.pos.x + player.facing * CAMERA.LOOKAHEAD, halfW), maxCamX);
      camX += (targetX - camX) * (1 - Math.exp(-k.dt() * CAMERA.EASE));
      if (followY) camY += (camTargetY() - camY) * (1 - Math.exp(-k.dt() * CAMERA.EASE));
      // Round to whole pixels: with crisp/nearest-neighbour sampling, a fractional camera
      // makes tiles/sprites shimmer ("scattoso") as they cross sample boundaries.
      setCam(k.vec2(Math.round(camX), Math.round(camY)));
    });

    // --- Off-screen culling (the mobile fluidity fix) -----------------------------------
    // On iOS WebKit each sprite is a separate draw call and the per-call overhead is FAR higher
    // than on desktop Chromium. A level is ~120 cells wide → ~545 tiles/props/pickups drawn every
    // frame, almost all off-camera — which pinned an iPhone 17 at ~11fps while desktop stayed
    // smooth. Hiding everything well outside the view means WebKit only draws what's visible.
    // `hidden` skips rendering ONLY — colliders/bodies and the enemy AI keep running — and the
    // generous margin un-hides objects long before they scroll on (no pop-in). Centre on the
    // player (the camera tracks her within a small lookahead, far less than the margin).
    const cullables = ["solid", "scenery", "decor", "hazard", "collectible", "powerup", "feather", "heart", "enemy"]
      .flatMap((t) => k.get(t));
    const CULL_MARGIN = GAME_W * 0.75; // ~¾ screen of lead each side beyond the view
    k.onUpdate(() => {
      const cx = player.pos.x;
      for (let i = 0; i < cullables.length; i++) {
        const o = cullables[i];
        o.hidden = Math.abs(o.pos.x - cx) > CULL_MARGIN;
      }
    });

    // --- Failure flow (no silent respawn — every failure accrues a debt) ---
    // Touching a lethal obstacle or falling off the world freezes the heroine and shows a
    // DOM "Insert Coin" overlay; inserting 500 Coccoline restarts THIS level from the start
    // (skins persist, since they're derived from the saved level in state — not reset here).
    let finished = false;
    let dead = false;
    // Star power-up: while invincible, hazards/enemies can't hurt the heroine and touching an
    // enemy defeats it. A fall off the world still ends the run (handled in die's callers).
    let invincibleUntil = 0;
    const isInvincible = () => k.time() < invincibleUntil;
    // Feather power-up: a short high-jump window (boosts the player's jump force).
    let featherUntil = 0;
    const hasFeather = () => k.time() < featherUntil;
    function die() {
      if (finished || dead) return;
      dead = true;
      player.setAnim("hurt"); // the "ops" face — set before pausing freezes updates
      player.paused = true; // freeze the heroine behind the overlay
      setFrameCap(PERF.FROZEN_FPS); // world is stopped behind the Insert-Coin / Game Over overlay
      sfx("oops"); // gentle "you slipped" cue (no harsh game-over)
      resetInput();
      addCoccoline(500); // the bill is sacred — every slip costs 500, banked immediately
      const left = loseLife(); // …and a life
      if (left <= 0) {
        // Out of lives: the run is over. Reset progress back to level 1 (score wiped, lives
        // refilled, checkpoint cleared) — but the Coccoline tab keeps growing — then offer a
        // restart from the very beginning.
        resetRun();
        showGameOver(() => {
          respawningFromDeath = false; // fresh start from level 1's spawn, no checkpoint
          fadeToScene(() => k.go("game"));
        });
        return;
      }
      showInsertCoin(left, () => {
        sfx("coin"); // arcade-coin chime as the debt is banked
        respawningFromDeath = true; // the restart below may resume from a checkpoint
        k.go("game"); // restart the current level (from the last checkpoint, if any)
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
        // Multi-hp enemies (the armored swooper): a stomp wounds and ENRAGES it — it
        // flashes, bounces her off, and dives faster from now on. The star plows
        // through hp outright (invincibility is earned). (The final boss is NOT an "enemy"
        // and has its own handler below — it never reaches here.)
        if (stomping && !isInvincible() && enemy.hp && --enemy.hp > 0) {
          player.vel.y = -PHYSICS.STOMP_BOUNCE;
          hitStop();
          screenShake(4);
          dustPuff(enemy.pos);
          sfx("stomp");
          enemy.swoopTime *= 0.72; // enrage: quicker dives…
          enemy.swoopCooldown *= 0.72; // …and shorter rests
          if (enemy.art) {
            enemy.art.color = k.rgb(255, 120, 120); // wound flash
            k.wait(0.18, () => {
              // Reset to the enemy's own base tint (iron for the armored swooper), not a
              // hard-coded grey.
              if (enemy.exists() && enemy.art) enemy.art.color = enemy.baseTint ?? k.rgb(150, 150, 170);
            });
          }
          bumpScore(SCORE.STOMP);
          return;
        }
        confettiBurst(enemy.pos, [theme.collectible, PALETTE.cream, PALETTE.gold]);
        sfx("stomp"); // satisfying squash thud
        const wasBoss = !!enemy.hp;
        k.destroy(enemy);
        if (stomping) {
          player.vel.y = -PHYSICS.STOMP_BOUNCE; // bounce back up off a stomp
          // Impact weight: a tiny freeze + shake + dust make the stomp land.
          hitStop();
          screenShake(wasBoss ? 6 : 3);
          dustPuff(enemy.pos);
        }
        bumpScore(wasBoss ? SCORE.STOMP * 3 : SCORE.STOMP); // felling the guardian pays
      } else {
        die();
      }
    });
    // --- Final boss (Livello 6 "Custode di Pietra"): a DEDICATED handler, separate from the
    // "enemy" one, so the boss BODY is HARMLESS to touch — only its shockwaves / falling debris
    // (tagged "hazard", handled above) can hurt her. This is the encounter's softlock-proofing:
    // she can never die just by being near the boss, only by failing to dodge a telegraphed
    // attack. She damages it ONLY by stomping from above during its vulnerable window
    // (boss.invulnerable === false); each hit enrages it. Felling it destroys the lone "boss"
    // object, which unlocks the gated goal (see the goal handler). Guaranteed beatable: the
    // boss's vulnerable window recurs forever regardless of where she stands.
    player.onCollide("boss", (boss) => {
      if (finished || dead) return;
      const stomping = player.vel.y > 60 && player.pos.y < boss.pos.y;
      if (!stomping) return; // body contact is safe — the danger is the attacks, not the stone
      player.vel.y = -PHYSICS.STOMP_BOUNCE; // always bounce off it
      if (boss.invulnerable) return; // hovering/attacking out of reach → no damage this hit
      boss.hp -= 1;
      if (boss.hp <= 0) {
        // Felled: confetti, a big impact, triple points — then it's gone and the doors open.
        confettiBurst(boss.pos, [theme.collectible, PALETTE.cream, PALETTE.gold]);
        sfx("stomp");
        screenShake(6);
        dustPuff(boss.pos);
        bumpScore(SCORE.STOMP * 3);
        k.destroy(boss);
      } else {
        boss.onStomped?.(); // flash + retreat; it rises to attack again, faster
        sfx("stomp");
        hitStop();
        screenShake(4);
        dustPuff(boss.pos);
        bumpScore(SCORE.STOMP);
      }
    });
    // Checkpoint flag (Phase 4): touching it sets the respawn point for this level —
    // deaths still cost 500 Coccoline (the meta is sacred), but the retry starts here.
    player.onCollide("checkpoint", (flag) => {
      if (finished || dead || flag.activated) return;
      flag.activated = true;
      // Same semantics as the spawn point: x centred on the pole, y = the lane cell top.
      checkpointAt = { x: flag.pos.x + 32, y: flag.pos.y + 64 };
      setCheckpoint({ level, x: checkpointAt.x, y: checkpointAt.y }); // survive a browser close
      flag.art?.use(k.color(255, 200, 150)); // the pennant warms up once it's yours
      confettiBurst(k.vec2(flag.pos.x + 32, flag.pos.y + 40), [PALETTE.gold, PALETTE.cream, PALETTE.rose]);
      sfx("checkpoint");
    });

    // Updraft columns (Phase 4, coral level): while inside, the fall is caught and she is
    // lifted gently toward the column's rise speed. Jumping inside still works.
    player.onCollideUpdate("updraft", () => {
      if (finished || dead) return;
      player.vel.y += (MECHANICS.UPDRAFT_LIFT - player.vel.y) * (1 - Math.exp(-k.dt() * 2.5));
    });

    // Breeze columns (garden level): a horizontal petal current — extra forward drift,
    // and the fall is softened to a glide so long assisted jumps feel like floating.
    // Anti-wedge: BREEZE_FALL holds her height so a glide can't sink into the gap — but if
    // she enters at lane level the same hold can pin her in the far corner (pushed into the
    // landing wall, unable to fall, and above the kill-plane so she never dies). We flag the
    // overlap here and, in the onUpdate below, nudge her up when she stalls against a wall.
    let inBreeze = false;
    let breezePrevX = player.pos.x;
    const BREEZE_UNSTICK_LIFT = 240; // px/s upward applied only while wedged (no free glide)
    player.onCollideUpdate("breeze", () => {
      if (finished || dead) return;
      inBreeze = true;
      player.move(MECHANICS.BREEZE_PUSH, 0);
      if (player.vel.y > MECHANICS.BREEZE_FALL) {
        player.vel.y += (MECHANICS.BREEZE_FALL - player.vel.y) * (1 - Math.exp(-k.dt() * 4));
      }
    });
    // Frame-to-frame stall check (robust to the breeze being many small cells, so the
    // collide handler can fire several times per frame): if she's airborne inside a breeze
    // yet not drifting at all, she's wedged against the far wall — lift her a touch so she
    // clears the ledge lip and the current carries her on instead of freezing in the corner.
    player.onUpdate(() => {
      if (inBreeze && !finished && !dead && !player.isGrounded()) {
        if (Math.abs(player.pos.x - breezePrevX) < 1 && player.vel.y > -BREEZE_UNSTICK_LIFT) {
          player.vel.y = -BREEZE_UNSTICK_LIFT;
        }
      }
      breezePrevX = player.pos.x;
      inBreeze = false;
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

    // Feather power-up: grant a high-jump window + points, with a cool aura trailing her.
    // Re-grabbing simply refreshes the timer. Placed off the critical path, so it's always
    // an optional pickup (jumpMul stays 1 if she never grabs one).
    player.onCollide("feather", (f) => {
      if (finished || dead) return;
      confettiBurst(f.pos, [PALETTE.cream, theme.collectibleGlow || PALETTE.gold, [200, 224, 248]]);
      sfx("spring"); // a lift-y chirp fits the high-jump
      k.destroy(f);
      featherUntil = k.time() + POWERUP.FEATHER_DURATION;
      player.jumpMul = POWERUP.FEATHER_JUMP_MUL;
      bumpScore(SCORE.POWERUP);
      spawnFeatherAura();
    });
    // The cool aura that trails the heroine while the feather is active (one at a time).
    function spawnFeatherAura() {
      if (k.get("feather-aura").length) return; // already showing; the timer was just refreshed
      const aura = k.add([
        k.circle(30),
        k.pos(player.pos),
        k.anchor("center"),
        k.color(190, 215, 245),
        k.opacity(0),
        k.z(9),
        "feather-aura",
      ]);
      aura.onUpdate(() => {
        if (!hasFeather()) return k.destroy(aura);
        aura.pos = player.pos;
        const pulse = 0.5 + 0.5 * Math.sin(k.time() * 8);
        aura.opacity = 0.12 + 0.16 * pulse;
        aura.radius = 26 + 6 * pulse;
      });
    }

    // --- HUD (fixed; ignores the camera) ---
    // x=88 leaves room for the top-left pause button (54px circle at left:16).
    k.add([k.text(char.name, { size: 28 }), k.pos(88, 18), k.color(...hudColor), k.fixed(), k.z(50)]);
    k.add([
      k.text(def.name, { size: 20 }),
      k.pos(88, 52),
      k.color(...hudColor),
      k.opacity(0.85),
      k.fixed(),
      k.z(50),
    ]);
    // I tre counter (🍎/★/♥) vivono nella colonna sinistra a x=88, impilati sotto nome+livello:
    // lo stesso schema del nome (scavalcare i pulsanti DOM degli angoli). A destra c'erano i
    // pulsanti audio (🎵/🔊, DOM position:fixed, sempre sopra il canvas): right-anchored qui i
    // counter finivano coperti. Spostandoli a sinistra (dove c'è solo l'angolo del pulsante pausa,
    // già scavalcato da x=88) la sovrapposizione sparisce a prescindere dalle bande di letterbox.
    const itemLabel = k.add([
      // sans-serif: the label leads with the theme's collectible emoji, which the pixel font lacks.
      k.text(`${icon} 0/${collectiblesTotal}`, { size: 26, font: "sans-serif" }),
      k.pos(88, 84),
      k.color(...PALETTE.gold),
      k.fixed(),
      k.z(50),
    ]);
    // Running journey score (Mario-style): pickups + stomps. Persists across levels.
    const scoreLabel = k.add([
      // sans-serif: the ★ glyph isn't in the pixel font.
      k.text(`★ ${getScore()}`, { size: 22, font: "sans-serif" }),
      k.pos(88, 116),
      k.color(...hudColor),
      k.fixed(),
      k.z(50),
    ]);
    const bumpScore = (amount) => {
      addScore(amount);
      scoreLabel.text = `★ ${getScore()}`;
    };
    // Lives (arcade): a compact heart count, under the score. ♥ isn't in the pixel
    // font → sans-serif. Updated on a heart pickup; a death leaves the scene and re-enters.
    const livesLabel = k.add([
      k.text(`♥ ${getLives()}`, { size: 22, font: "sans-serif" }),
      k.pos(88, 146),
      k.color(...PALETTE.rose),
      k.fixed(),
      k.z(50),
    ]);
    const updateLives = () => (livesLabel.text = `♥ ${getLives()}`);
    // Invincibility indicator (top centre): shown only while a star is active, counting down.
    const invLabel = k.add([
      // sans-serif: shows "★ INVINCIBILE …" and the ★ glyph isn't in the pixel font.
      k.text("", { size: 24, font: "sans-serif" }),
      k.pos(GAME_W / 2, 30),
      k.anchor("center"),
      k.color(...PALETTE.gold),
      k.fixed(),
      k.z(50),
    ]);
    invLabel.hidden = true;
    // Feather indicator (just below the star one; "PIUMA" has no special glyph → pixel font).
    const featherLabel = k.add([
      k.text("", { size: 24 }),
      k.pos(GAME_W / 2, 60),
      k.anchor("center"),
      k.color(190, 215, 245),
      k.fixed(),
      k.z(50),
    ]);
    featherLabel.hidden = true;
    // Only rebuild the timer strings when the displayed integer second actually changes:
    // the labels tick once per second, but the loop runs every frame — interpolating a new
    // string 60×/s just to show the same number churns the GC (a source of micro-stutter).
    let lastInvSec = -1;
    let lastFeatherSec = -1;
    k.onUpdate(() => {
      const active = isInvincible();
      invLabel.hidden = !active;
      if (active) {
        const sec = Math.ceil(invincibleUntil - k.time());
        if (sec !== lastInvSec) {
          invLabel.text = `★ INVINCIBILE  ${sec}`;
          lastInvSec = sec;
        }
      } else lastInvSec = -1;
      const feather = hasFeather();
      featherLabel.hidden = !feather;
      if (feather) {
        const sec = Math.ceil(featherUntil - k.time());
        if (sec !== lastFeatherSec) {
          featherLabel.text = `PIUMA  ${sec}`;
          lastFeatherSec = sec;
        }
      } else {
        lastFeatherSec = -1;
        if (player.jumpMul !== 1) player.jumpMul = 1; // high-jump lapsed → back to normal
      }
    });

    // --- Collectibles (golden apples / pearls) ---
    let collected = 0;
    player.onCollide("collectible", (item) => {
      if (finished || dead) return;
      // Confetti pop + chime at the pickup.
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

    // --- Hearts (arcade lives): a heart grants +1 life (capped at LIVES.MAX in state) ---
    player.onCollide("heart", (h) => {
      if (finished || dead) return;
      confettiBurst(h.pos, [PALETTE.rose, PALETTE.cream, PALETTE.gold]);
      sfx("collect");
      k.destroy(h);
      addLife();
      addHeartTaken(level); // remember it so a checkpoint retry won't respawn it (no life loop)
      updateLives();
    });

    // A throttled floating hint when she reaches a still-gated goal (Livello 6 boss).
    let bossHintAt = 0;
    function showBossHint() {
      if (k.time() < bossHintAt) return;
      bossHintAt = k.time() + 2.2;
      const hint = k.add([
        k.text("Sconfiggi il Custode per passare!", { size: 24 }),
        k.pos(player.pos.x, player.pos.y - 96),
        k.anchor("center"),
        k.color(...PALETTE.gold),
        k.z(55),
        { age: 0 },
      ]);
      hint.onUpdate(() => {
        hint.age += k.dt();
        hint.pos.y -= 16 * k.dt();
        if (hint.age > 1.4) hint.opacity = Math.max(0, 1 - (hint.age - 1.4) / 0.6);
        if (hint.age > 2) k.destroy(hint);
      });
    }

    // --- Goal: unlock a skin, advance progress, continue to the next level ---
    player.onCollide("goal", () => {
      if (finished || dead) return;
      // Boss gate (Livello 6): the ballroom doors stay sealed until the Custode di Pietra is
      // felled. As soon as the lone "boss" object is destroyed this check passes — no physical
      // wall to get stuck behind, and the boss is guaranteed beatable, so this can't softlock.
      if (k.get("boss").length > 0) {
        showBossHint();
        return;
      }
      finished = true;
      checkpointAt = null; // the journey continues — next level starts clean
      clearCheckpoint(); // …and the persisted one is spent (lives carry over to the next level)
      player.setAnim("celebrate"); // arms up while the reward card shows
      sfx("goal"); // triumphant arpeggio on clearing the level
      // The last chapter's doors deserve fireworks: staggered confetti around her.
      if (level >= MAX_LEVEL - 1) {
        for (let i = 0; i < 5; i++) {
          k.wait(i * 0.22, () => {
            confettiBurst(
              k.vec2(player.pos.x + (i - 2) * 70, player.pos.y - 40 - (i % 3) * 50),
              [PALETTE.gold, PALETTE.cream, theme.collectible, PALETTE.rose],
            );
          });
        }
        screenShake(4);
      }
      resetInput();
      const reward = skinUnlockedBy(level);
      setCurrentLevel(level + 1); // persist progress (drives the skin layering next level)
      showReward(reward, collected, collectiblesTotal, icon, level + 1);
    });

    // --- Chapter banner that fades after a moment ---
    const banner = k.add([
      k.text(`Capitolo ${level} — ${def.name}`, { size: 44 }),
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

    // --- Pause (ESC or the top-left button) ---
    // Freezes the whole game tree (k.getTreeRoot().paused) and shows a DOM overlay whose
    // buttons stay clickable while everything else is frozen. Every exit unfreezes first so
    // a paused tree can never leak into the next scene.
    let paused = false;
    const setFrozen = (on) => {
      paused = on;
      k.getTreeRoot().paused = on;
      // Nothing moves behind the pause overlay, so drop the render rate hard while frozen and
      // restore the full play rate on resume (the single pause chokepoint).
      setFrameCap(on ? PERF.FROZEN_FPS : maxFPS);
    };
    function pauseGame() {
      if (finished || dead || paused) return;
      setFrozen(true);
      resetInput(); // drop any held direction so she doesn't drift on resume
      showPause({
        onResume: resumeGame,
        // Settings stacks over the pause card; the world stays frozen and the pause card
        // reappears when settings closes.
        onSettings: () => showSettings(),
        onRestart: () => {
          hidePause();
          setFrozen(false);
          respawningFromDeath = false; // full restart from the level's start, not a checkpoint
          forceSpawn = true; // …and ignore the persisted checkpoint for this one entry
          fadeToScene(() => k.go("game"));
        },
        onMenu: () => {
          hidePause();
          setFrozen(false);
          fadeToScene(() => k.go("menu"));
        },
      });
    }
    function resumeGame() {
      if (!paused) return;
      hidePause();
      setFrozen(false);
      focusCanvas(); // clicking the DOM button took focus; give it back for the keys
    }
    k.onKeyPress("escape", () => (paused ? resumeGame() : pauseGame()));
    // The on-screen pause button (DOM). Reassigned each scene entry; the button is only
    // visible during gameplay (body.playing), so a stale closure can't be reached elsewhere.
    const pauseBtn = document.getElementById("pause-toggle");
    if (pauseBtn) pauseBtn.onclick = () => (paused ? resumeGame() : pauseGame());
  });
}

// --- Themed backdrop: three generated parallax image layers per theme (sky / mid /
// near) plus the signature ambient particles. The static silhouette polygons were replaced by
// the mid/near images; the particle systems (motes / bubbles / snow) are kept as juice.
// Exported so the menu can reuse the same living backdrop (src/scenes/menu.js). ---
export function drawBackground(theme) {
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

// --- Parallax: the "<decor>_mid" and "<decor>_near" images, screen-fixed and
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
  const N = coarsePointer ? 7 : 14; // lighter ambient load on mobile (near-identical look)
  for (let i = 0; i < N; i++) {
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
  const N = coarsePointer ? 8 : 18; // lighter ambient load on mobile (near-identical look)
  for (let i = 0; i < N; i++) {
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
  const N = coarsePointer ? 18 : 40; // lighter ambient load on mobile (near-identical look)
  for (let i = 0; i < N; i++) {
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
  // Level cleared → the world is done; only a gently bobbing hero animates. 30fps is plenty
  // (the next scene, game or finale, re-asserts its own cap on entry).
  setFrameCap(PERF.IDLE_FPS);
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
    k.pos(GAME_W / 2, GAME_H / 2 - 210),
    k.anchor("center"),
    k.color(...PALETTE.cream),
    k.fixed(),
    k.z(81),
  ]);
  if (reward) {
    // The unlock as a *reveal*, not a line of text: a golden spotlight with the heroine
    // standing in it, already wearing the skin she just earned (every layer unlocked so
    // far, the newest on top). Mirrors the finale avatar (src/scenes/finale.js).
    const heroY = GAME_H / 2 - 40;
    for (const [radius, alpha] of [[132, 0.1], [96, 0.13], [64, 0.17]]) {
      k.add([
        k.circle(radius),
        k.pos(GAME_W / 2, heroY),
        k.anchor("center"),
        k.color(...PALETTE.gold),
        k.opacity(alpha),
        k.fixed(),
        k.z(81),
      ]);
    }
    const char = CHARACTERS.find((c) => c.id === getSelectedCharacter()) || CHARACTERS[0];
    const hero = k.add([
      k.sprite(char.sprite),
      k.pos(GAME_W / 2, heroY),
      k.anchor("center"),
      k.scale(1.9),
      k.fixed(),
      k.z(82),
    ]);
    hero.skinLayers = addSkinLayers(hero, unlockedSkinKeys(nextLevel));
    hero.play("celebrate"); // arms up in the spotlight
    hero.onUpdate(() => {
      hero.pos.y = heroY + Math.sin(k.time() * 1.5) * 5; // gentle bob
      syncSkins(hero); // children share the sheet frame but don't animate on their own
    });

    k.add([
      k.text("Hai sbloccato:", { size: 26 }),
      k.pos(GAME_W / 2, GAME_H / 2 + 70),
      k.anchor("center"),
      k.color(...PALETTE.cream),
      k.opacity(0.9),
      k.fixed(),
      k.z(81),
    ]);
    k.add([
      k.text(reward.name, { size: 38 }),
      k.pos(GAME_W / 2, GAME_H / 2 + 110),
      k.anchor("center"),
      k.color(...PALETTE.gold),
      k.fixed(),
      k.z(81),
    ]);
  }
  k.add([
    // sans-serif: contains the collectible emoji + ★, neither of which the pixel font has.
    k.text(`${icon} ${got}/${total}    ★ ${getScore()}`, { size: 26, font: "sans-serif" }),
    k.pos(GAME_W / 2, GAME_H / 2 + 160),
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
  const label = more ? "Continua" : toFinale ? "Al Gran Ballo" : "Torna al menu";
  const dest = more ? "game" : toFinale ? "finale" : "menu";

  const btn = k.add([
    k.rect(320, 78, { radius: 14 }),
    k.pos(GAME_W / 2, GAME_H / 2 + 230),
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
      k.pos(GAME_W / 2, GAME_H / 2 + 288),
      k.anchor("center"),
      k.color(...PALETTE.cream),
      k.opacity(0.7),
      k.fixed(),
      k.z(81),
    ]);
  }
}
