// build.js — turns a level definition (see level1.js / level2.js) into game objects.
// Reusable across every themed level: it only knows the tile legend, not the specific
// layout, and reads colours/visuals from the level's `theme`. Returns the bits the scene
// needs to wire gameplay (spawn point, world size, collectible count). Collisions, HUD and
// respawn live in the scene; this file just builds the world.
//
// Tile legend: "=" solid  "^" hazard (thorns/urchins)  "o" collectible  "c" crab enemy
//              "f" flyer enemy (air)  "s" stalactite hazard (falls)
//              "@" spawn   ">" goal   " " air (a gap in the ground rows is a ravine)

import { k } from "../kaplayCtx.js";
import { PALETTE, ENEMIES, HAZARDS } from "../config.js";

/**
 * Render a level's tile map.
 * @param {{tileSize:number, map:string[], theme:object}} def
 * @returns {{spawn: any, worldW:number, worldH:number, collectiblesTotal:number}}
 */
export function buildLevel(def) {
  const TILE = def.tileSize;
  const rows = def.map;
  const theme = def.theme;
  const cols = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const worldW = cols * TILE;
  const worldH = rows.length * TILE;

  let spawn = null;
  let collectiblesTotal = 0;

  rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      const x = c * TILE;
      const y = r * TILE;
      switch (ch) {
        case "=":
          // Solid ground/platform tile + a thin top accent (decorative).
          k.add([
            k.rect(TILE, TILE),
            k.pos(x, y),
            k.area(),
            k.body({ isStatic: true }),
            k.color(...theme.solid),
            "solid",
          ]);
          k.add([k.rect(TILE, 7), k.pos(x, y), k.color(...theme.solidTop), k.z(1)]);
          break;
        case "^":
          makeHazard(x, y, TILE, theme);
          break;
        case "o":
          makeCollectible(x + TILE / 2, y + TILE / 2, theme);
          collectiblesTotal += 1;
          break;
        case "c":
          makeCrab(x + TILE / 2, y + TILE / 2, theme);
          break;
        case "f":
          makeFlyer(x + TILE / 2, y + TILE / 2, theme);
          break;
        case "s":
          makeStalactite(x, y, TILE, theme, worldH);
          break;
        case "@":
          // Spawn the player centred horizontally, feet on the cell's bottom edge.
          spawn = k.vec2(x + TILE / 2, y);
          break;
        case ">":
          makeGoal(x + TILE / 2, y + TILE / 2, theme);
          break;
        default:
          break; // space / unknown = empty air (ravines are just gaps in the ground)
      }
    }
  });

  if (!spawn) spawn = k.vec2(TILE * 1.5, 0); // defensive fallback if a level omits "@"
  return { spawn, worldW, worldH, collectiblesTotal };
}

// --- Static hazard (thorns / sea urchins): a low spiky block, tagged "hazard".
function makeHazard(x, y, TILE, theme) {
  const topY = y + TILE * 0.5; // sits on the lower half of the cell (on the ground)
  k.add([
    k.rect(TILE, TILE * 0.5),
    k.pos(x, topY),
    k.area({ scale: 0.85 }), // slightly forgiving hitbox (casual difficulty)
    k.color(...theme.hazard),
    k.z(2),
    "hazard",
  ]);
  for (let i = 0; i < 4; i++) {
    k.add([
      k.polygon([k.vec2(0, 0), k.vec2(16, 0), k.vec2(8, -16)]),
      k.pos(x + i * 16, topY),
      k.color(...theme.hazardTip),
      k.z(2),
    ]);
  }
}

// --- Collectible (golden apple / pearl): a gently bobbing pickup, tagged "collectible".
function makeCollectible(cx, cy, theme) {
  const item = k.add([
    k.circle(13),
    k.color(...theme.collectible),
    k.pos(cx, cy),
    k.anchor("center"),
    k.area({ scale: 0.95 }),
    k.z(3),
    "collectible",
    { baseY: cy, t: k.rand(0, Math.PI * 2) },
  ]);
  // Small highlight so a pale pearl still reads as a sphere.
  item.add([k.circle(4), k.color(...(theme.collectibleAccent || PALETTE.cream)), k.pos(-4, -4)]);
  // Forest apples get a stem + leaf; other themes skip it.
  if (theme.leaf) {
    item.add([k.rect(3, 7), k.color(96, 64, 42), k.anchor("bot"), k.pos(0, -11)]);
    item.add([
      k.polygon([k.vec2(0, 0), k.vec2(11, -2), k.vec2(2, -8)]),
      k.color(...theme.leaf),
      k.pos(1, -13),
    ]);
  }
  item.onUpdate(() => {
    item.t += k.dt() * 3;
    item.pos.y = item.baseY + Math.sin(item.t) * 4;
  });
  return item;
}

// --- Crab enemy: patrols horizontally, tagged "enemy". Primitive art (no asset needed).
function makeCrab(cx, cy, theme) {
  const body = theme.enemy || [196, 64, 58];
  const claw = theme.enemyAccent || [230, 110, 96];
  // The shell is on the parent so area() infers the collider shape (no k.Rect needed).
  const crab = k.add([
    k.rect(40, 24, { radius: 11 }),
    k.color(...body),
    k.pos(cx, cy),
    k.anchor("center"),
    k.area({ scale: 0.92 }),
    k.z(4),
    "enemy",
    { baseX: cx, dir: 1 },
  ]);
  // Eyes.
  crab.add([k.circle(3), k.color(255, 255, 255), k.anchor("center"), k.pos(-6, -9)]);
  crab.add([k.circle(3), k.color(255, 255, 255), k.anchor("center"), k.pos(6, -9)]);
  crab.add([k.circle(1.5), k.color(20, 20, 20), k.anchor("center"), k.pos(-6, -9)]);
  crab.add([k.circle(1.5), k.color(20, 20, 20), k.anchor("center"), k.pos(6, -9)]);
  // Claws.
  crab.add([k.circle(6), k.color(...claw), k.anchor("center"), k.pos(-22, 2)]);
  crab.add([k.circle(6), k.color(...claw), k.anchor("center"), k.pos(22, 2)]);

  crab.onUpdate(() => {
    crab.move(crab.dir * ENEMIES.CRAB_SPEED, 0);
    if (crab.pos.x > crab.baseX + ENEMIES.CRAB_RANGE) crab.dir = -1;
    else if (crab.pos.x < crab.baseX - ENEMIES.CRAB_RANGE) crab.dir = 1;
  });
  return crab;
}

// --- Flyer enemy (ostacolo volante, Livello 3): patrols horizontally in the air with a
// gentle vertical bob. Tagged "enemy" so the scene respawns the player on contact.
function makeFlyer(cx, cy, theme) {
  const body = theme.enemy || [48, 44, 64];
  const wing = theme.enemyAccent || [26, 24, 40];
  // The body is on the parent so area() infers the collider (no k.body — it floats).
  const flyer = k.add([
    k.rect(34, 18, { radius: 9 }),
    k.color(...body),
    k.pos(cx, cy),
    k.anchor("center"),
    k.area({ scale: 0.9 }),
    k.z(4),
    "enemy",
    { baseX: cx, baseY: cy, dir: 1, t: k.rand(0, Math.PI * 2) },
  ]);
  // Two swept-back wings + an eye (reads as a little crow/bird).
  flyer.add([k.polygon([k.vec2(0, 0), k.vec2(-24, -13), k.vec2(-20, 7)]), k.color(...wing), k.pos(-8, -1)]);
  flyer.add([k.polygon([k.vec2(0, 0), k.vec2(24, -13), k.vec2(20, 7)]), k.color(...wing), k.pos(8, -1)]);
  flyer.add([k.circle(2.5), k.color(255, 255, 255), k.anchor("center"), k.pos(9, -3)]);

  flyer.onUpdate(() => {
    flyer.pos.x += flyer.dir * ENEMIES.FLY_SPEED * k.dt();
    if (flyer.pos.x > flyer.baseX + ENEMIES.FLY_RANGE) flyer.dir = -1;
    else if (flyer.pos.x < flyer.baseX - ENEMIES.FLY_RANGE) flyer.dir = 1;
    flyer.t += k.dt() * ENEMIES.FLY_BOB_SPEED;
    flyer.pos.y = flyer.baseY + Math.sin(flyer.t) * ENEMIES.FLY_BOB;
  });
  return flyer;
}

// --- Stalactite hazard (stalattite, Livello 4): an icicle that hangs from the ceiling and
// drops on a timer, then resets to the top. Tagged "hazard" (touch = respawn) at all times.
function makeStalactite(x, y, TILE, theme, worldH) {
  // Icicle = a downward-pointing triangle; the polygon itself carries the area collider.
  const stal = k.add([
    k.polygon([k.vec2(0, 0), k.vec2(TILE, 0), k.vec2(TILE / 2, TILE * 0.95)]),
    k.pos(x, y),
    k.area({ scale: 0.8 }),
    k.color(...theme.hazard),
    k.z(4),
    "hazard",
    { homeY: y, vy: 0, falling: false, timer: k.rand(0.6, HAZARDS.STALACTITE_INTERVAL) },
  ]);
  // A brighter tip so the ice reads against the snowy backdrop.
  stal.add([
    k.polygon([k.vec2(-7, 0), k.vec2(7, 0), k.vec2(0, 22)]),
    k.color(...(theme.hazardTip || PALETTE.cream)),
    k.pos(TILE / 2, TILE * 0.95 - 24),
  ]);

  stal.onUpdate(() => {
    if (!stal.falling) {
      stal.timer -= k.dt();
      if (stal.timer <= 0) stal.falling = true;
      return;
    }
    stal.vy += HAZARDS.STALACTITE_GRAVITY * k.dt();
    stal.pos.y += stal.vy * k.dt();
    if (stal.pos.y > worldH + 80) {
      stal.pos.y = stal.homeY;
      stal.vy = 0;
      stal.falling = false;
      stal.timer = k.rand(1.0, HAZARDS.STALACTITE_INTERVAL);
    }
  });
  return stal;
}

// --- Goal: a shimmering light beam at the end of the level, tagged "goal".
function makeGoal(cx, cy, theme) {
  const H = 230;
  const beam = k.add([
    k.rect(54, H),
    k.pos(cx, cy + 20),
    k.anchor("bot"),
    k.color(...(theme.goal || PALETTE.gold)),
    k.opacity(0.3),
    k.area(),
    k.z(2),
    "goal",
  ]);
  beam.onUpdate(() => {
    beam.opacity = 0.22 + 0.16 * Math.abs(Math.sin(k.time() * 2));
  });
  k.add([
    k.text("✨", { size: 44 }),
    k.pos(cx, cy + 20 - H),
    k.anchor("center"),
    k.z(3),
  ]);
}
