// juice.js — small "game feel" helpers. Pure Kaplay, no DOM,
// so it never touches the UI overlays: confetti bursts, dust puffs, screen shake and
// hit-stop. (Squash & stretch lives in the player entity; parallax lives in the game
// scene, both tightly coupled to those files.)

import { k, coarsePointer } from "./kaplayCtx.js";

/**
 * Burst of confetti at a world position: small coloured rectangles that fly outward, fall
 * under gravity, spin, and fade out. Scene-scoped, so they auto-clean on scene change.
 * @param {{x:number,y:number}} pos  world position (e.g. a collected item's centre)
 * @param {number[][]} colors        RGB triples to pick from
 */
export function confettiBurst(pos, colors = [[212, 175, 55], [255, 255, 255], [231, 150, 173]]) {
  // Fewer confetti on mobile (8 vs 14): each is a live alpha-blended particle with its own
  // per-frame update, and a burst can fire mid-run (pickups) right when the GPU is busiest.
  // The reduction is momentary and imperceptible, but shaves the peak fill/CPU on iOS.
  const COUNT = coarsePointer ? 8 : 14;
  for (let i = 0; i < COUNT; i++) {
    const col = colors[i % colors.length] || [255, 255, 255];
    const ang = k.rand(0, Math.PI * 2);
    const spd = k.rand(80, 240);
    const w = k.rand(5, 11);
    const p = k.add([
      k.rect(w, w * k.rand(0.5, 1)),
      k.pos(pos.x, pos.y),
      k.anchor("center"),
      k.color(...col),
      k.opacity(1),
      k.rotate(k.rand(0, 360)),
      k.z(40), // above gameplay, below the HUD (z 50) and DOM overlays
      {
        vel: k.vec2(Math.cos(ang) * spd, Math.sin(ang) * spd - k.rand(40, 120)),
        spin: k.rand(-360, 360),
        life: k.rand(0.5, 0.9),
        age: 0,
      },
    ]);
    p.onUpdate(() => {
      const dt = k.dt();
      p.age += dt;
      p.vel.y += 600 * dt; // gravity
      p.pos = p.pos.add(p.vel.scale(dt));
      p.angle += p.spin * dt;
      p.opacity = Math.max(0, 1 - p.age / p.life);
      if (p.age >= p.life) k.destroy(p);
    });
  }
}

/**
 * A little dust cloud at the heroine's feet: a few grey-cream squares that drift up and
 * out, then fade. Used on landings and skids (big puff) and as a faint trickle while
 * running (count 1). Same hand-rolled particle idiom as confettiBurst — deliberately not
 * the engine's particles() comp, so there is ONE well-understood pattern in the codebase.
 * @param {{x:number,y:number}} pos  world position (the feet)
 * @param {{count?:number, dir?:number}} [opts]  dir: bias drift toward -1 left / +1 right
 */
export function dustPuff(pos, { count = 5, dir = 0 } = {}) {
  for (let i = 0; i < count; i++) {
    const tone = k.rand(0.85, 1);
    const p = k.add([
      k.rect(k.rand(3, 6), k.rand(3, 6)),
      k.pos(pos.x + k.rand(-10, 10), pos.y + k.rand(-4, 2)),
      k.anchor("center"),
      k.color(235 * tone, 230 * tone, 218 * tone),
      k.opacity(0.7),
      k.z(9), // just behind the heroine (z 10)
      {
        vel: k.vec2(k.rand(-30, 30) + dir * k.rand(20, 60), -k.rand(20, 55)),
        life: k.rand(0.25, 0.45),
        age: 0,
      },
    ]);
    p.onUpdate(() => {
      const dt = k.dt();
      p.age += dt;
      p.vel.y -= 40 * dt; // dust floats, it doesn't fall
      p.pos = p.pos.add(p.vel.scale(dt));
      p.opacity = Math.max(0, 0.7 * (1 - p.age / p.life));
      if (p.age >= p.life) k.destroy(p);
    });
  }
}

// Hit-stop: freeze the action for a beat (Mario-style impact weight). Implemented via
// debug.timeScale with a re-entrancy guard so overlapping stomps can't strand the game
// in slow motion; DOM overlays are outside Kaplay and unaffected.
let stopping = false;
export function hitStop(duration = 0.08, scale = 0.15) {
  if (stopping) return;
  stopping = true;
  k.debug.timeScale = scale;
  // k.wait respects timeScale, so wait for the SCALED duration to restore on real time.
  k.wait(duration * scale, () => {
    k.debug.timeScale = 1;
    stopping = false;
  });
}

/**
 * Force-clear any in-flight hit-stop. hitStop() drops k.debug.timeScale to 0.15 and relies on a
 * SCENE-SCOPED k.wait to restore it. If a scene change (k.go) happens inside that ~80ms window —
 * e.g. a stomp immediately followed by a death/respawn or reaching the goal — the restore timer
 * is cancelled with the old scene tree and timeScale stays at 0.15: the whole game then runs at
 * 15% speed and reads as FROZEN / stuck, with `stopping` latched true (so future hit-stops no-op
 * too). Scenes call this on entry so a stale hit-stop can never leak across a transition.
 */
export function resetHitStop() {
  stopping = false;
  k.debug.timeScale = 1;
}

/** Small screen shake (wraps k.shake so callers don't reach into the engine). */
export function screenShake(intensity = 3) {
  k.shake(intensity);
}
