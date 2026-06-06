// juice.js — small "game feel" helpers (Specifiche_Polishing §3). Pure Kaplay, no DOM,
// so it never touches the UI overlays. Currently: a confetti burst for pickups. (Squash &
// stretch lives in the player entity; parallax lives in the game scene, both tightly
// coupled to those files.)

import { k } from "./kaplayCtx.js";

/**
 * Burst of confetti at a world position: small coloured rectangles that fly outward, fall
 * under gravity, spin, and fade out. Scene-scoped, so they auto-clean on scene change.
 * @param {{x:number,y:number}} pos  world position (e.g. a collected item's centre)
 * @param {number[][]} colors        RGB triples to pick from
 */
export function confettiBurst(pos, colors = [[212, 175, 55], [255, 255, 255], [231, 150, 173]]) {
  const COUNT = 14;
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
