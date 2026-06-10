// player.js — the playable heroine, reusable across all levels.
// Owns physics (gravity body + collider) and reads the virtual input layer each frame to
// move and jump. Levels just call makePlayer(char, pos); they don't touch input details.

import { k } from "../kaplayCtx.js";
import { PHYSICS } from "../config.js";
import { getInput, consumeJump } from "../controls.js";
import { sfx } from "../sfx.js";

// Heroine sprites are 64×96 (taller than wide, drawn by the pixel-art pipeline in tools/gen/).
// Rendered 1:1; the collider (see k.area below) is inset so the heroine clears the 64px
// level grid — the oversized 2× collider used to wall her in on every level.
const PLAYER_SCALE = 1;

/**
 * Layer clothing skins as child sprites on a parent (the player, or the finale avatar).
 * Children inherit the parent's position/scale, so each layer sits centred and scales with
 * the body automatically — flipX is NOT inherited and must be synced by the caller if the
 * parent can flip. Add order = paint order (skirt under … under crown).
 * @param {*} parent  the game object to attach layers to
 * @param {string[]} keys  sprite asset keys, in paint order
 * @returns {Array} the created layer objects
 */
export function addSkinLayers(parent, keys = []) {
  return keys.map((key) => parent.add([k.sprite(key), k.anchor("center"), k.pos(0, 0)]));
}

/**
 * Spawn the player.
 * @param {{sprite:string}} char  the chosen character (from CHARACTERS)
 * @param {import("../../vendor/kaplay-3001.0.19.mjs").Vec2} pos spawn position
 * @param {string[]} skinKeys  sprite keys to layer on top of the base body (spec §3),
 *   in paint order (e.g. ["skirt"] on level 2). Each is a 64×64 transparent overlay.
 * @returns the player game object
 */
export function makePlayer(char, pos, skinKeys = []) {
  const player = k.add([
    k.sprite(char.sprite),
    k.pos(pos),
    k.anchor("center"),
    k.scale(PLAYER_SCALE),
    // Collider ~40×92: narrower than the 64px art so she fits one-tile gaps and lands
    // forgivingly, nearly full-height so she still reads as solid. Tuned against the 64px
    // level grid (see src/levels/*.js) and validated by tools/test/play.mjs.
    k.area({ scale: k.vec2(0.62, 0.96) }),
    k.body(), // gravity + collisions (k.setGravity is set by the scene)
    "player",
    { facing: 1 }, // 1 = right, -1 = left
  ]);

  // Skin layering: child sprites at the same centre (shared with the finale avatar).
  // flipX and frame are not inherited, so the onUpdate below syncs them each frame.
  player.skinKeys = skinKeys;
  player.skinLayers = addSkinLayers(player, skinKeys);

  // Animation state machine. The state is derived from physics each update (run / idle /
  // jump / fall); scene code can take over for scripted moments (hurt / celebrate) via
  // setAnim, which locks the auto states until the scene rebuilds the player.
  player.animLock = false;
  player.setAnim = (name) => {
    player.animLock = true;
    player.play(name);
    syncSkins(player);
  };
  player.play("idle");

  // Squash & stretch (spec §3). A squash factor eases back to neutral each frame and gets
  // "kicked" on jump (tall + thin) and on landing (wide + short); the rendered scale is
  // BASE * squash, so children (skins) inherit it. Magnitudes are modest and vertical-
  // dominant so the brief change to the area() collider can't cause an unfair hazard hit.
  const BASE = PLAYER_SCALE;
  player.squashX = 1;
  player.squashY = 1;
  let wasGrounded = true;

  // Movement feel state. vx is the horizontal velocity, set INSTANTLY from input (no
  // acceleration ramp): the heroine starts and stops at once, for tight Mario-style control
  // on the ground and in the air. The timers give small forgiveness windows (coyote = jump
  // just after a ledge, buffer = jump pressed just before landing); jumpCut ensures the
  // variable-height cut is applied at most once per jump.
  player.vx = 0;
  let sinceGrounded = 0;
  let sinceJumpPressed = Infinity;
  let jumpCut = true;

  player.onUpdate(() => {
    const input = getInput();
    const dt = k.dt();

    // Horizontal movement: instant velocity from input (no inertia/slide), so control is
    // tight and predictable. Direction held -> full speed at once; released -> stop at once.
    let target = 0;
    if (input.left && !input.right) {
      target = -PHYSICS.RUN_SPEED;
      player.facing = -1;
    } else if (input.right && !input.left) {
      target = PHYSICS.RUN_SPEED;
      player.facing = 1;
    }
    const groundedNow = player.isGrounded();
    player.vx = target; // instant
    player.move(player.vx, 0); // framerate-independent (px/s)

    // Face travel direction (sprites authored facing right).
    player.flipX = player.facing === -1;

    // Jump with coyote time + input buffering. Remember the most recent press, and allow a
    // jump if we're grounded (or within the coyote window of having been).
    sinceGrounded = groundedNow ? 0 : sinceGrounded + dt;
    sinceJumpPressed = consumeJump() ? 0 : sinceJumpPressed + dt;
    if (sinceJumpPressed <= PHYSICS.JUMP_BUFFER && (groundedNow || sinceGrounded <= PHYSICS.COYOTE_TIME)) {
      player.jump(PHYSICS.JUMP_FORCE);
      sfx("jump");
      player.squashX = 0.9; // stretch tall on take-off
      player.squashY = 1.18;
      sinceJumpPressed = Infinity; // consume the buffered press
      sinceGrounded = Infinity; // prevent an immediate second jump via coyote
      jumpCut = false; // arm the variable-height cut for this jump
    }

    // Variable jump height: if the button is released while still rising, cut the upward
    // velocity once so a tap gives a short hop and a hold gives the full arc.
    if (!input.jumpHeld && player.vel.y < 0 && !jumpCut) {
      player.vel.y *= PHYSICS.JUMP_CUT;
      jumpCut = true;
    }
    // Faster fall than rise for a snappier, less floaty arc.
    if (player.vel.y > 0) {
      player.vel.y += (PHYSICS.FALL_MULT - 1) * PHYSICS.GRAVITY * dt;
    }

    // Landing impact: airborne -> grounded this frame.
    const grounded = groundedNow;
    if (grounded && !wasGrounded) {
      player.squashX = 1.1; // squash wide on land
      player.squashY = 0.82;
    }
    wasGrounded = grounded;

    // Ease the squash back to neutral (framerate-independent) and apply it.
    const ease = 1 - Math.exp(-k.dt() * 15);
    player.squashX += (1 - player.squashX) * ease;
    player.squashY += (1 - player.squashY) * ease;
    player.scale = k.vec2(BASE * player.squashX, BASE * player.squashY);

    // Animation state from physics (unless a scripted anim took over), then mirror
    // flipX + frame to the skin layers — they are never animated independently.
    if (!player.animLock) {
      const next = !groundedNow ? (player.vel.y < 0 ? "jump" : "fall") : player.vx !== 0 ? "run" : "idle";
      if (player.curAnim() !== next) player.play(next);
    }
    syncSkins(player);
  });

  return player;
}

// Mirror the parent's facing + sheet frame onto every skin layer (the layers share the
// parent's sheet layout — see src/animspec.js — so equal frame index = equal pose).
// Exported for the finale avatar, which layers skins the same way.
export function syncSkins(parent) {
  for (const layer of parent.skinLayers) {
    layer.flipX = parent.flipX;
    layer.frame = parent.frame;
  }
}
