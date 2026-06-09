// build.js — turns a level definition (see level1.js / level2.js) into game objects.
// Reusable across every themed level: it only knows the tile legend, not the specific
// layout, and reads colours/visuals from the level's `theme`. Returns the bits the scene
// needs to wire gameplay (spawn point, world size, collectible count). Collisions, HUD and
// respawn live in the scene; this file just builds the world.
//
// Tile legend: "=" solid  "^" hazard (thorns/urchins)  "o" collectible  "*" star power-up
//              "c" crab enemy  "f" flyer enemy (air)  "s" stalactite hazard (falls)
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
        case "=": {
          // Solid tile. Pick a neighbour-aware frame so surfaces read as grassy tops, buried
          // dirt fill, or floating slabs — then tint the whole sprite with theme.solid (the
          // atlas frames are neutral grey with baked bevel/texture, so the tint keeps
          // contrast). Collider (area + static body) is identical to the old rect.
          const airAbove = (rows[r - 1]?.[c] ?? " ") !== "=";
          const airBelow = (rows[r + 1]?.[c] ?? " ") !== "=";
          const frame = airAbove && airBelow ? "platform" : airAbove ? "ground_top" : "ground_fill";
          k.add([
            k.sprite(frame),
            k.pos(x, y),
            k.area(),
            k.body({ isStatic: true }),
            k.color(...theme.solid),
            "solid",
          ]);
          // Bright grass/snow lip on exposed top surfaces (keeps the faithful two-tone look).
          if (airAbove) {
            k.add([k.rect(TILE, 7), k.pos(x, y), k.color(...theme.solidTop), k.z(1)]);
          }
          break;
        }
        case "^":
          makeHazard(x, y, TILE, theme);
          break;
        case "o":
          makeCollectible(x + TILE / 2, y + TILE / 2, theme);
          collectiblesTotal += 1;
          break;
        case "*":
          makePowerup(x + TILE / 2, y + TILE / 2);
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
// The collider is the original invisible half-cell rect (identical hitbox + "hazard" tag +
// top-left pos so the bot's lane probes are unchanged); the spike art is a child sprite,
// tinted with the theme. The sprite's content occupies its lower ~48px (top is transparent),
// so anchored to the cell bottom it matches the old spikes' visual extent.
function makeHazard(x, y, TILE, theme) {
  const topY = y + TILE * 0.5; // sits on the lower half of the cell (on the ground)
  const base = k.add([
    k.rect(TILE, TILE * 0.5),
    k.pos(x, topY),
    k.area({ scale: 0.85 }), // slightly forgiving hitbox (casual difficulty)
    k.opacity(0), // collider-only; the sprite below provides the visuals
    k.z(2),
    "hazard",
  ]);
  base.add([k.sprite("hazard_spike"), k.anchor("bot"), k.color(...theme.hazard), k.pos(TILE / 2, TILE / 2)]);
}

// --- Collectible (golden apple / pearl): a gently bobbing pickup, tagged "collectible".
function makeCollectible(cx, cy, theme) {
  // Collider-only invisible body: keeps the exact circle hitbox + "collectible" tag + bob
  // state, so the pickup feel and the autoplay bot are unchanged. The art is a per-theme
  // child sprite (apple/pearl/lantern/crystal), with the soft aura kept as juice.
  const item = k.add([
    k.circle(13),
    k.opacity(0),
    k.pos(cx, cy),
    k.anchor("center"),
    k.area({ scale: 0.95 }),
    k.z(3),
    "collectible",
    { baseY: cy, t: k.rand(0, Math.PI * 2) },
  ]);
  // Soft themed aura so the pickup reads as precious (spec §3 juiciness). Pure decoration.
  const halo = item.add([
    k.circle(20),
    k.color(...(theme.collectibleGlow || PALETTE.gold)),
    k.anchor("center"),
    k.pos(0, 0),
    k.opacity(0.16),
    k.z(2), // behind the gem sprite (z3) where child z is honoured
  ]);
  const sprite = item.add([
    k.sprite(theme.collectibleSprite || "apple"),
    k.anchor("center"),
    k.pos(0, 0),
    k.rotate(0), // enables the gentle sway below
    k.z(3),
  ]);
  item.onUpdate(() => {
    item.t += k.dt() * 3;
    item.pos.y = item.baseY + Math.sin(item.t) * 5; // a touch more bob than before (spec §4)
    sprite.angle = Math.sin(item.t * 0.8) * 6; // gentle sway
    halo.opacity = 0.12 + 0.12 * (0.5 + 0.5 * Math.sin(item.t * 1.6)); // gentle flicker
  });
  return item;
}

// --- Star power-up: a bobbing, spinning golden star, tagged "powerup". Grabbing it grants a
// short invincibility window (handled in the game scene). Drawn from primitives (a 5-point
// star polygon + a warm halo) so it needs no art asset and reads the same in every theme.
function starPoints(outer, inner) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5; // start at the top, 36° steps
    pts.push(k.vec2(Math.cos(a) * r, Math.sin(a) * r));
  }
  return pts;
}

function makePowerup(cx, cy) {
  const star = k.add([
    k.polygon(starPoints(17, 7.5)),
    k.pos(cx, cy),
    k.anchor("center"),
    k.color(...PALETTE.gold),
    k.area({ scale: 1.1 }), // slightly generous pickup (casual)
    k.rotate(0),
    k.z(3),
    "powerup",
    { baseY: cy, t: k.rand(0, Math.PI * 2) },
  ]);
  // Warm aura behind the star so it reads as "special" (more than a plain collectible).
  const halo = star.add([
    k.circle(22),
    k.color(...PALETTE.gold),
    k.anchor("center"),
    k.pos(0, 0),
    k.opacity(0.18),
    k.z(2),
  ]);
  star.onUpdate(() => {
    star.t += k.dt() * 3;
    star.pos.y = star.baseY + Math.sin(star.t) * 6; // bob
    star.angle = Math.sin(star.t * 0.6) * 14; // gentle wobble-spin
    halo.opacity = 0.14 + 0.14 * (0.5 + 0.5 * Math.sin(star.t * 2)); // pulse
  });
  return star;
}

// --- Crab enemy: patrols horizontally, tagged "enemy". Primitive art (no asset needed).
function makeCrab(cx, cy, theme) {
  // Collider-only invisible body (same 40×24 hitbox + "enemy" tag + patrol state); the crab
  // art is a child sprite. Movement logic is unchanged so the bot reads it identically.
  const crab = k.add([
    k.rect(40, 24, { radius: 11 }),
    k.opacity(0),
    k.pos(cx, cy),
    k.anchor("center"),
    k.area({ scale: 0.92 }),
    k.z(4),
    "enemy",
    { baseX: cx, dir: 1 },
  ]);
  const art = crab.add([k.sprite("crab"), k.anchor("center"), k.pos(0, 0)]);

  crab.onUpdate(() => {
    crab.move(crab.dir * ENEMIES.CRAB_SPEED, 0);
    if (crab.pos.x > crab.baseX + ENEMIES.CRAB_RANGE) crab.dir = -1;
    else if (crab.pos.x < crab.baseX - ENEMIES.CRAB_RANGE) crab.dir = 1;
    art.flipX = crab.dir < 0; // face travel direction
  });
  return crab;
}

// --- Flyer enemy (ostacolo volante, Livello 3): patrols horizontally in the air with a
// gentle vertical bob. Tagged "enemy" so the scene respawns the player on contact.
function makeFlyer(cx, cy, theme) {
  // Collider-only invisible body (same 34×18 hitbox + "enemy" tag + float state); the bird
  // art is a child sprite. Movement is unchanged so the bot's air-enemy probe is unaffected.
  const flyer = k.add([
    k.rect(34, 18, { radius: 9 }),
    k.opacity(0),
    k.pos(cx, cy),
    k.anchor("center"),
    k.area({ scale: 0.9 }),
    k.z(4),
    "enemy",
    { baseX: cx, baseY: cy, dir: 1, t: k.rand(0, Math.PI * 2) },
  ]);
  flyer.add([k.sprite("flyer"), k.anchor("center"), k.pos(0, 0)]);

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
  // Collider-only invisible triangle (same hitbox + "hazard" tag + drop state); the icicle
  // art is a child sprite tinted with the theme. Drop logic is unchanged.
  const stal = k.add([
    k.polygon([k.vec2(0, 0), k.vec2(TILE, 0), k.vec2(TILE / 2, TILE * 0.95)]),
    k.opacity(0),
    k.pos(x, y),
    k.area({ scale: 0.8 }),
    k.z(4),
    "hazard",
    { homeY: y, vy: 0, falling: false, timer: k.rand(0.6, HAZARDS.STALACTITE_INTERVAL) },
  ]);
  stal.add([k.sprite("hazard_icicle"), k.anchor("top"), k.color(...theme.hazard), k.pos(TILE / 2, 0)]);

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
  const goalCol = theme.goal || PALETTE.gold;
  // The portal arch sprite (neutral grey, tinted with the goal colour) stands on the ground,
  // behind the existing shimmering beam which stays as the magical glow + the "goal" collider.
  k.add([k.sprite("portal"), k.pos(cx, cy + 20), k.anchor("bot"), k.color(...goalCol), k.z(1)]);
  const beam = k.add([
    k.rect(54, H),
    k.pos(cx, cy + 20),
    k.anchor("bot"),
    k.color(...goalCol),
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
  // Rising motes along the beam — a little magic at the level's end (spec §3). Scene-scoped
  // via k.loop (stops + cleans up on scene change); pure decoration, no collider.
  const moteCol = theme.goal || PALETTE.gold;
  k.loop(0.3, () => {
    const m = k.add([
      k.circle(k.rand(2, 4)),
      k.pos(cx + k.rand(-18, 18), cy + 16),
      k.anchor("center"),
      k.color(...moteCol),
      k.opacity(0.85),
      k.z(2),
      { vy: k.rand(45, 80), age: 0, life: k.rand(1.0, 1.6) },
    ]);
    m.onUpdate(() => {
      m.age += k.dt();
      m.pos.y -= m.vy * k.dt();
      m.opacity = Math.max(0, 0.85 * (1 - m.age / m.life));
      if (m.age >= m.life) k.destroy(m);
    });
  });
}
