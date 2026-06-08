// player.js — the playable heroine, reusable across all levels.
// Owns physics (gravity body + collider) and reads the virtual input layer each frame to
// move and jump. Levels just call makePlayer(char, pos); they don't touch input details.

import { k } from "../kaplayCtx.js";
import { PHYSICS } from "../config.js";
import { getInput, consumeJump } from "../controls.js";
import { sfx } from "../sfx.js";

// Placeholder sprites are 64×64; scale up so the heroine reads at the game's resolution.
const PLAYER_SCALE = 2;

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
 * @param {import("https://unpkg.com/kaplay@3001.0.19/dist/kaplay.mjs").Vec2} pos spawn position
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
    k.area(),
    k.body(), // gravity + collisions (k.setGravity is set by the scene)
    "player",
    { facing: 1 }, // 1 = right, -1 = left
  ]);

  // Skin layering: child sprites at the same centre (shared with the finale avatar).
  // flipX is not inherited, so the onUpdate below syncs it each frame.
  player.skinKeys = skinKeys;
  player.skinLayers = addSkinLayers(player, skinKeys);

  // Squash & stretch (spec §3). A squash factor eases back to neutral each frame and gets
  // "kicked" on jump (tall + thin) and on landing (wide + short); the rendered scale is
  // BASE * squash, so children (skins) inherit it. Magnitudes are modest and vertical-
  // dominant so the brief change to the area() collider can't cause an unfair hazard hit.
  const BASE = PLAYER_SCALE;
  player.squashX = 1;
  player.squashY = 1;
  let wasGrounded = true;

  player.onUpdate(() => {
    const input = getInput();

    // Horizontal movement (held). move() is framerate-independent (px/s).
    if (input.left && !input.right) {
      player.move(-PHYSICS.MOVE_SPEED, 0);
      player.facing = -1;
    } else if (input.right && !input.left) {
      player.move(PHYSICS.MOVE_SPEED, 0);
      player.facing = 1;
    }
    // Face travel direction (sprites authored facing right). Skin layers must flip too —
    // flipX is not inherited from the parent transform.
    player.flipX = player.facing === -1;
    player.skinLayers.forEach((layer) => (layer.flipX = player.flipX));

    // Jump: edge-triggered and only from the ground (no double-jump).
    if (consumeJump() && player.isGrounded()) {
      player.jump(PHYSICS.JUMP_FORCE);
      sfx("jump");
      player.squashX = 0.9; // stretch tall on take-off
      player.squashY = 1.18;
    }

    // Landing impact: airborne -> grounded this frame.
    const grounded = player.isGrounded();
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
  });

  return player;
}
