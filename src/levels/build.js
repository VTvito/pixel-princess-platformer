// build.js — turns a level definition (see level1.js / level2.js) into game objects.
// Reusable across every themed level: it only knows the tile legend, not the specific
// layout, and reads colours/visuals from the level's `theme`. Returns the bits the scene
// needs to wire gameplay (spawn point, world size, collectible count). Collisions, HUD and
// respawn live in the scene; this file just builds the world.
//
// Tile legend: "=" solid  "^" hazard (thorns/urchins)  "o" collectible  "*" star power-up
//              "c" crab enemy  "f" flyer enemy (air)  "s" stalactite hazard (falls)
//              "h" hopper enemy (Rospo Saltatore: hops in timed arcs on the ground)
//              "#" semisolid one-way platform   "M" spring mushroom   "!" crumble platform
//              "F" checkpoint flag   "g" swooper (diving ghost)   "r" roller (chasing ball)
//              "w" updraft column cell   "B" breeze column cell (horizontal petal current)
//              "P" pendulum chandelier (anchor cell; the lethal bob swings below)
//              "S" armored swooper (2-hp diving guardian — enrages on a stomp)
//              "+" feather (high-jump power-up)   "H" heart (arcade life: +1 vita)
//              "G" final boss "Custode di Pietra" (Livello 6 climax: multi-phase, gates the goal)
//              "@" spawn   ">" goal   " " air (a gap in the ground rows is a ravine)
// Moving platforms are not ASCII: a level may add `movers: [{x,y,w,dx,dy,period,phase}]`
// (cells; dx/dy = travel amplitude in cells) — see makeMover.

import { k } from "../kaplayCtx.js";
import { PALETTE, ENEMIES, HAZARDS, MECHANICS, PHYSICS, GAME_W, BOSS } from "../config.js";
import { sfx } from "../sfx.js";
import { getHeartsTaken } from "../state.js";

// Cached heroine reference shared by the enemy-AI updates below. `k.get("player")` scans the
// whole object tree (hundreds of tiles per level, no culling), and the diving/chasing enemies
// would do it EVERY frame — pure waste on a mobile CPU. Memoize it instead.
//
// CACHE INVALIDATION — must reset on every scene (re)build: a death/restart goes through
// `k.go("game")`, which ORPHANS the old scene's objects rather than `destroy()`-ing them, so
// the previous heroine's `.exists()` can still report true. Trusting `.exists()` alone would
// keep returning the stale, frozen heroine from the last life and the swoopers/rollers
// would track a ghost. So `buildLevel()` nulls this at the top of every build (it runs
// once per scene setup, before any enemy update fires); the `.exists()` re-query is a belt-and-
// suspenders guard for a heroine destroyed WITHIN a single life.
let cachedPlayer = null;
function getPlayer() {
  if (!cachedPlayer || !cachedPlayer.exists()) cachedPlayer = k.get("player")[0] ?? null;
  return cachedPlayer;
}

/**
 * Render a level's tile map.
 * @param {{tileSize:number, map:string[], theme:object}} def
 * @returns {{spawn: any, worldW:number, worldH:number, collectiblesTotal:number}}
 */
export function buildLevel(def) {
  cachedPlayer = null; // drop any reference from a previous life/level (see note above)
  const TILE = def.tileSize;
  const rows = def.map;
  const theme = def.theme;
  // Whether THIS level's heart was already grabbed this run — if so, don't respawn it on a
  // checkpoint retry (it would let the player re-bank +1 vita on every death). See state.js.
  const heartTaken = getHeartsTaken().includes(def.id);
  const cols = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const worldW = cols * TILE;
  const worldH = rows.length * TILE;
  // Boolean map of static "=" cells, filled during the pass below and greedy-meshed into a few
  // big colliders afterward (buildSolidColliders) — far fewer static bodies for mobile collision.
  const solidGrid = rows.map(() => new Array(cols).fill(false));

  let spawn = null;
  let collectiblesTotal = 0;
  const decorSpots = []; // exposed, item-free ground tops — candidates for decor props

  rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      const x = c * TILE;
      const y = r * TILE;
      switch (ch) {
        case "=": {
          // Solid tile. Pick a neighbour-aware frame so surfaces read as grassy tops, buried
          // dirt fill, carved terrace edges, or floating slabs — then tint the whole sprite
          // with theme.solid (the atlas frames are neutral grey with baked shading, so the
          // tint keeps contrast). Variants are chosen by a deterministic position hash so
          // long runs don't visibly repeat. Collider (area + static body) is unchanged.
          const airAbove = (rows[r - 1]?.[c] ?? " ") !== "=";
          const airBelow = (rows[r + 1]?.[c] ?? " ") !== "=";
          const airLeft = (row[c - 1] ?? " ") !== "=";
          const airRight = (row[c + 1] ?? " ") !== "=";
          let frame;
          if (airAbove && airBelow) frame = "platform";
          else if (airAbove && airLeft && !airRight) frame = "ground_top_l";
          else if (airAbove && airRight && !airLeft) frame = "ground_top_r";
          else if (airAbove) frame = (c * 7 + r) % 3 === 0 ? "ground_top_2" : "ground_top";
          else frame = (c * 5 + r * 3) % 4 === 0 ? "ground_fill_2" : "ground_fill";
          // VISUAL only — no per-tile collider. All "=" cells are recorded in solidGrid and
          // greedy-meshed into a few big static bodies after the pass (buildSolidColliders), so
          // the engine isn't running collision over hundreds of tile bodies every frame (the
          // mobile fluidity killer). "scenery" tag → drawn-only + off-screen culled like caps.
          k.add([
            k.sprite(frame),
            k.pos(x, y),
            k.color(...theme.solid),
            "scenery",
          ]);
          solidGrid[r][c] = true;
          // Bright grass/snow cap on exposed top surfaces: a transparent pixel overlay with
          // blades, tinted theme.solidTop (keeps the faithful two-tone surface look).
          if (airAbove) {
            k.add([k.sprite(c % 2 ? "grass_cap_2" : "grass_cap"), k.pos(x, y), k.color(...theme.solidTop), k.z(1), "scenery"]);
            // Ground tops (not floating slabs) with truly empty air above can host a
            // decor prop — anything in the cell above (item/hazard/spawn/goal) vetoes it.
            if (!airBelow && (rows[r - 1]?.[c] ?? " ") === " ") decorSpots.push({ c, r });
          }
          break;
        }
        case "#":
          makeSemisolid(x, y, TILE, theme);
          break;
        case "M":
          makeSpring(x, y, TILE);
          break;
        case "!":
          makeCrumble(x, y, TILE, theme);
          break;
        case "F":
          makeCheckpoint(x, y, TILE);
          break;
        case "g":
          makeSwooper(x + TILE / 2, y + TILE / 2);
          break;
        case "S":
          makeArmoredSwooper(x + TILE / 2, y + TILE / 2);
          break;
        case "G": {
          // Final boss: scan DOWN this column for the arena floor (first solid "=" cell) so the
          // boss derives its hover/window heights from the real staircase top below it (makeBoss).
          let fr = r;
          while (fr < rows.length && (rows[fr]?.[c] ?? " ") !== "=") fr++;
          // Softlock guard: if the column has no solid floor below (a level-data slip — moving
          // the boss, a new level), fr would run off the map and the boss would spawn near the
          // world bottom, breaking the fight WHILE still gating the goal. Fall back to a few
          // cells under the tile so the heights stay sane and the encounter stays winnable.
          if (fr >= rows.length) fr = r + 4;
          makeBoss(x + TILE / 2, fr * TILE, theme);
          break;
        }
        case "r":
          makeRoller(x + TILE / 2, y + TILE / 2);
          break;
        case "w":
          makeUpdraft(x, y, TILE, theme);
          break;
        case "B":
          makeBreeze(x, y, TILE, theme);
          break;
        case "P":
          makePendulum(x + TILE / 2, y + TILE / 2, theme);
          break;
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
        case "+":
          makeFeather(x + TILE / 2, y + TILE / 2);
          break;
        case "H":
          if (!heartTaken) makeHeart(x + TILE / 2, y + TILE / 2); // skip if already grabbed this run
          break;
        case "c":
          makeCrab(x + TILE / 2, y + TILE / 2, theme);
          break;
        case "f":
          makeFlyer(x + TILE / 2, y + TILE / 2, theme);
          break;
        case "h":
          makeHopper(x + TILE / 2, y + TILE / 2, theme);
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

  // Merge the static "=" tiles into as few colliders as possible (greedy meshing). On iOS
  // WebKit the engine running collision over ~hundreds of individual tile bodies every frame was
  // the dominant fluidity cost (desktop didn't care; culling only skips DRAWING hidden tiles, not
  // their collision). Consolidating contiguous cells into big rectangles keeps the exact same
  // hitboxes with ~10× fewer static bodies.
  buildSolidColliders(solidGrid, TILE);

  // Moving platforms (data-driven, not ASCII — see the legend note at the top).
  for (const m of def.movers || []) makeMover(m, TILE, theme);

  // Decor props: collider-free scenery. Procedural dressing on the ground tops collected
  // above, plus authored hero placements (def.decor, data-driven like movers) — a tree
  // framing the goal, lanterns flanking a checkpoint. Neither touches gameplay or collision.
  placeDecorProps(theme, decorSpots, TILE);
  for (const d of def.decor || []) {
    makeDecorProp(d.key, (d.x + 0.5) * TILE, (d.y + 1) * TILE, !!d.fg);
  }

  if (!spawn) spawn = k.vec2(TILE * 1.5, 0); // defensive fallback if a level omits "@"
  return { spawn, worldW, worldH, collectiblesTotal };
}

// Greedy-mesh a boolean grid of solid cells into a minimal set of static box colliders. Each
// emitted body is invisible (no sprite — the per-tile "scenery" sprites carry the visuals) and
// tagged "solid", so the player body lands/blocks exactly as on the old per-tile bodies but the
// engine checks a handful of bodies per frame instead of hundreds. See the call site for why.
function buildSolidColliders(grid, TILE) {
  const rows = grid.length;
  const used = grid.map((row) => row.map(() => false));
  for (let r = 0; r < rows; r++) {
    const cols = grid[r].length;
    for (let c = 0; c < cols; c++) {
      if (!grid[r][c] || used[r][c]) continue;
      // Widen right while the row stays solid + unused…
      let w = 1;
      while (c + w < cols && grid[r][c + w] && !used[r][c + w]) w++;
      // …then grow down while every column of the [c, c+w) span is solid + unused.
      let h = 1;
      grow: while (r + h < rows) {
        for (let cc = c; cc < c + w; cc++) {
          if (!grid[r + h][cc] || used[r + h][cc]) break grow;
        }
        h++;
      }
      for (let rr = r; rr < r + h; rr++) for (let cc = c; cc < c + w; cc++) used[rr][cc] = true;
      k.add([
        k.pos(c * TILE, r * TILE),
        k.area({ shape: new k.Rect(k.vec2(0, 0), w * TILE, h * TILE) }),
        k.body({ isStatic: true }),
        "solid",
      ]);
    }
  }
}

// --- Decor props: pure scenery (no area/body), sprite keys from theme.props ------------
// Rooted plants sway gently; everything else stands still. z 0 keeps props behind the
// grass caps (z 1) and the heroine (z 10); rare small accents go to z 12 (foreground,
// in front of her but low and small enough never to hide her).
const SWAY_PROPS = new Set(["deco_kelp", "deco_fern"]);

function makeDecorProp(key, cx, baseY, fg) {
  const prop = k.add([
    k.sprite(key),
    k.pos(Math.round(cx), Math.round(baseY)),
    k.anchor("bot"),
    k.z(fg ? 12 : 0),
    ...(SWAY_PROPS.has(key) ? [k.rotate(0)] : []),
    "decor",
  ]);
  if (SWAY_PROPS.has(key)) {
    const phase = (cx * 0.013) % (Math.PI * 2); // desync neighbours
    prop.onUpdate(() => {
      prop.angle = Math.sin(k.time() * 1.1 + phase) * 3;
    });
  }
  return prop;
}

// Procedural dressing: ~1 candidate cell in 6 gets a prop, chosen from the theme's
// weighted menu. Deterministic position hashes (same style as the tile variants) so the
// scenery is stable across reloads — no rand(), no churn in screenshots.
function placeDecorProps(theme, spots, TILE) {
  const menu = theme.props || [];
  if (!menu.length) return;
  const totalWeight = menu.reduce((s, p) => s + (p.weight || 1), 0);
  for (const { c, r } of spots) {
    if ((c * 13 + r * 7) % 6 !== 0) continue;
    let pick = (c * 31 + r * 17) % totalWeight;
    let entry = menu[menu.length - 1];
    for (const p of menu) {
      pick -= p.weight || 1;
      if (pick < 0) {
        entry = p;
        break;
      }
    }
    // Foreground accents: only fg-capable props (small ones), roughly 1 placement in 4.
    const fg = !!entry.fg && (c * 11 + r * 5) % 4 === 0;
    makeDecorProp(entry.key, c * TILE + TILE / 2, r * TILE, fg);
  }
}

// --- Semisolid platform: pass through from below/sides, stand on top (one-way).
// Hand-rolled one-way logic (kaplay's platformEffector exists but its minified arc math
// is opaque): resolve the collision only when the body is falling AND its feet are at or
// above the slab's top — i.e. a landing. Everything else (jumping up through it, walking
// into its side) passes through.
function makeSemisolid(x, y, TILE, theme) {
  const slab = k.add([
    k.sprite("semisolid"),
    k.pos(x, y),
    k.area({ shape: new k.Rect(k.vec2(0, 0), TILE, TILE * 0.34) }),
    k.body({ isStatic: true }),
    k.color(...theme.solid),
    "solid",
    "semisolid",
  ]);
  slab.onBeforePhysicsResolve((col) => {
    const b = col.target;
    const feetY = b.pos.y + (b.height || 92) / 2;
    if (b.vel.y < 0 || feetY > slab.pos.y + 18) col.preventResolution();
  });
  return slab;
}

// --- Spring mushroom: auto-bounce on contact from above — no button needed; it fires the
// moment she lands on the cap. Launches higher than a jump.
function makeSpring(x, y, TILE) {
  const spring = k.add([
    k.rect(TILE * 0.7, TILE * 0.6),
    k.opacity(0),
    k.pos(x + TILE * 0.15, y + TILE * 0.4), // collider on the cap, low in the cell
    k.area(),
    k.z(3),
    "spring",
  ]);
  const art = spring.add([k.sprite("spring"), k.anchor("bot"), k.pos(TILE * 0.35, TILE * 0.6)]);
  spring.onCollide("player", (p) => {
    if (p.pos.y > spring.pos.y) return; // only a bounce when she lands on the cap
    p.bounce(MECHANICS.SPRING_VEL); // full, reliable launch (disarms the variable-height cut)
    p.squashX = 0.8; // extra-tall stretch on the way up
    p.squashY = 1.3;
    art.play("bounce");
    k.wait(0.3, () => (art.frame = 0));
    sfx("spring");
  });
  return spring;
}

// --- Crumble platform: trembles when stood on, falls away, reforms a moment later.
function makeCrumble(x, y, TILE, theme) {
  const home = k.vec2(x, y);
  const plat = k.add([
    k.sprite("platform"),
    k.pos(home),
    k.area(),
    k.body({ isStatic: true }),
    k.color(...theme.solid),
    k.opacity(1),
    "solid",
    "crumble",
    { state: "intact", t: 0, vy: 0 },
  ]);
  plat.onCollide("player", (p) => {
    if (plat.state === "intact" && p.pos.y < plat.pos.y) {
      plat.state = "shaking";
      plat.t = 0;
      sfx("crumble");
    }
  });
  plat.onUpdate(() => {
    const dt = k.dt();
    if (plat.state === "shaking") {
      plat.t += dt;
      plat.pos.x = home.x + Math.sin(plat.t * 60) * 2; // tremble telegraph
      if (plat.t >= MECHANICS.CRUMBLE_SHAKE) {
        plat.state = "falling";
        plat.vy = 0;
        plat.pos.x = home.x;
        plat.unuse("body"); // stops being standable the moment it lets go
      }
    } else if (plat.state === "falling") {
      plat.vy += PHYSICS.GRAVITY * 0.8 * dt;
      plat.pos.y += plat.vy * dt;
      plat.opacity = Math.max(0, plat.opacity - dt * 1.6);
      if (plat.opacity <= 0) {
        plat.state = "gone";
        plat.t = 0;
      }
    } else if (plat.state === "gone") {
      plat.t += dt;
      if (plat.t >= MECHANICS.CRUMBLE_RESPAWN) {
        plat.pos = k.vec2(home);
        plat.opacity = 1;
        plat.use(k.body({ isStatic: true }));
        plat.state = "intact";
      }
    }
  });
  return plat;
}

// --- Checkpoint flag: waving pennant; the game scene wires activation (respawn point +
// chime + confetti) via the "checkpoint" tag.
function makeCheckpoint(x, y, TILE) {
  const flag = k.add([
    k.rect(TILE, TILE * 2),
    k.opacity(0),
    k.pos(x, y - TILE), // collider covers the pole's two cells
    k.area(),
    k.z(2),
    "checkpoint",
    { activated: false },
  ]);
  const art = flag.add([k.sprite("flag"), k.anchor("bot"), k.pos(TILE / 2, TILE * 2)]);
  art.play("wave");
  flag.art = art;
  return flag;
}

// --- Swooper: hovers in the air, dives toward the lane when the heroine comes near, then
// floats back up. Tagged "enemy" → stompable, lethal on side contact (same rules as all).
function makeSwooper(cx, cy, opts = {}) {
  const swooper = k.add([
    k.rect(34, 30, { radius: 10 }),
    k.opacity(0),
    k.pos(cx, cy),
    k.anchor("center"),
    k.area({ scale: 0.85 }),
    k.z(4),
    "enemy",
    {
      baseY: cy,
      diving: false,
      t: 0,
      cooldown: 0,
      hp: opts.hp, // undefined for a regular swooper → a single stomp fells it
      // Per-instance dive tunables so a wounded armored swooper can ENRAGE (the game scene
      // shortens these on each stomp); a regular swooper just keeps them at the constants.
      swoopTime: MECHANICS.SWOOP_TIME,
      swoopCooldown: MECHANICS.SWOOP_COOLDOWN,
    },
  ]);
  const art = swooper.add([k.sprite("swooper"), k.anchor("center"), k.pos(0, 0)]);
  if (opts.tint) {
    art.use(k.color(...opts.tint)); // armored = iron-tinted ghost
    swooper.baseTint = k.rgb(...opts.tint); // the wound flash resets to this, not stone-grey
  }
  art.play("float");
  swooper.art = art; // exposed so the game scene can flash it on a (non-fatal) stomp
  swooper.onUpdate(() => {
    const dt = k.dt();
    const p = getPlayer();
    if (!swooper.diving) {
      swooper.cooldown -= dt;
      swooper.pos.y = swooper.baseY + Math.sin(k.time() * 2.2) * 8; // idle hover
      if (p && swooper.cooldown <= 0 && Math.abs(p.pos.x - swooper.pos.x) < MECHANICS.SWOOP_RANGE) {
        swooper.diving = true;
        swooper.t = 0;
      }
    } else {
      swooper.t += dt;
      const f = Math.min(1, swooper.t / swooper.swoopTime);
      swooper.pos.y = swooper.baseY + Math.sin(f * Math.PI) * MECHANICS.SWOOP_DROP; // down & back
      if (p) swooper.pos.x += Math.sign(p.pos.x - swooper.pos.x) * 46 * dt; // lean toward her
      if (f >= 1) {
        swooper.diving = false;
        swooper.cooldown = swooper.swoopCooldown;
      }
    }
  });
  return swooper;
}

// --- Armored swooper (Fase 2): a 2-hp diving guardian. Same flight as a swooper — identical
// dive arc, cooldown sneak window and hitbox — so it can be slipped past during the cooldown
// without a fight (no stomp required). The only difference is that it shrugs off the first
// stomp and ENRAGES (quicker dives), a mid-game step up toward the L6 boss fight. Iron tint so
// it reads as armored.
function makeArmoredSwooper(cx, cy) {
  return makeSwooper(cx, cy, { hp: 2, tint: [120, 135, 162] });
}

// --- Final boss "Custode di Pietra" (Livello 6 climax). See config.BOSS for the full design
// note. A bespoke, multi-phase guardian unlike every other enemy:
//   • tagged "boss" (NOT "enemy") so its BODY is HARMLESS to touch — only the shockwave/debris
//     it spawns (tagged "hazard") can hurt the heroine. This is the key softlock-proofing: she
//     can never die just by being near it, only by failing to dodge its telegraphed attacks;
//   • it runs a DETERMINISTIC phase loop (not player-position-driven), so the vulnerable window
//     always comes around no matter where she stands — the fight is guaranteed winnable;
//   • HOVER out of reach → TELEGRAPH → fire an attack (alternating ground SHOCKWAVE / falling
//     DEBRIS) → DESCEND into a fixed-length vulnerable WINDOW → stomp to damage (the game scene's
//     dedicated "boss" handler decrements hp) → ASCEND and repeat, faster (enrage) each hit.
// `floorY` is the arena floor (top of the staircase) the boss positions itself against, so the
// hover/window heights are derived from real geometry and stay tuned to the single-jump apex.
function makeBoss(cx, floorY, theme) {
  const attackY = floorY - BOSS.ATTACK_ABOVE_FLOOR; // hover height — out of stomp/contact reach
  const windowY = floorY - BOSS.WINDOW_ABOVE_FLOOR; // descent height — stompable from the floor
  const stoneArr = theme?.solid || [120, 108, 124]; // castle stone (falls back to grey-violet)
  const gildArr = [196, 162, 96]; // gilded brow trim (castle gold)

  const boss = k.add([
    k.rect(BOSS.W, BOSS.H, { radius: 18 }),
    k.opacity(0), // hitbox only; the visible guardian is the children below
    k.pos(cx, attackY),
    k.anchor("center"),
    k.area({ scale: BOSS.AREA_SCALE }),
    k.z(6),
    "boss",
    {
      hp: BOSS.HP,
      invulnerable: true, // damage is gated to the WINDOW phase (set false there)
      phase: "hover", // hover → telegraph → recover → descend → window → ascend
      t: 0,
      bob: k.rand(0, Math.PI * 2),
      attackKind: 0, // alternates 0 = shockwave, 1 = debris
    },
  ]);

  // --- Primitive art: a hulking stone guardian with a gilded brow and glowing amber eyes ---
  const bodyArt = boss.add([
    k.rect(BOSS.W, BOSS.H, { radius: 18 }),
    k.anchor("center"),
    k.pos(0, 0),
    k.color(...stoneArr),
    k.outline(4, k.rgb(26, 20, 32)),
    k.z(0),
  ]);
  // Two stone horns on the crown.
  boss.add([k.polygon([k.vec2(-46, -36), k.vec2(-26, -36), k.vec2(-40, -62)]), k.anchor("center"), k.pos(0, 0), k.color(...stoneArr), k.outline(3, k.rgb(26, 20, 32)), k.z(0)]);
  boss.add([k.polygon([k.vec2(46, -36), k.vec2(26, -36), k.vec2(40, -62)]), k.anchor("center"), k.pos(0, 0), k.color(...stoneArr), k.outline(3, k.rgb(26, 20, 32)), k.z(0)]);
  // Gilded brow band.
  boss.add([k.rect(BOSS.W * 0.78, 10, { radius: 4 }), k.anchor("center"), k.pos(0, -20), k.color(...gildArr), k.z(1)]);
  // Carved mouth.
  boss.add([k.rect(44, 6, { radius: 3 }), k.anchor("center"), k.pos(0, 28), k.color(26, 20, 32), k.z(1)]);
  // Amber eyes — glow brighter through the telegraph + the vulnerable window (the "tell").
  const eyeL = boss.add([k.circle(9), k.anchor("center"), k.pos(-22, -2), k.color(255, 184, 74), k.z(2)]);
  const eyeR = boss.add([k.circle(9), k.anchor("center"), k.pos(22, -2), k.color(255, 184, 74), k.z(2)]);

  boss.bodyArt = bodyArt;
  boss.baseStone = k.rgb(...stoneArr);
  boss.floorY = floorY; // exposed so the game scene can drop the ballroom key onto the arena floor

  // The game scene calls this on a successful stomp: flash, then retreat. One hit per window
  // (it closes the window and rises to attack again), so felling it always takes BOSS.HP windows.
  boss.onStomped = () => {
    bodyArt.color = k.rgb(255, 120, 120);
    k.wait(0.16, () => { if (boss.exists()) bodyArt.color = boss.baseStone; });
    boss.invulnerable = true;
    boss.phase = "ascend";
    boss.t = 0;
  };

  const enrage = () => 1 + (BOSS.HP - boss.hp) * BOSS.ENRAGE_K; // faster cadence/attacks as hp drops
  const easeInOut = (f) => (f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2);

  boss.onUpdate(() => {
    const dt = k.dt();
    boss.t += dt;
    boss.bob += dt;
    const e = enrage();
    switch (boss.phase) {
      case "hover": {
        boss.pos.y = attackY + Math.sin(boss.bob * 1.6) * 8; // heavy stone hover
        eyeL.opacity = eyeR.opacity = 0.85;
        if (boss.t >= BOSS.HOVER_TIME / e) { boss.phase = "telegraph"; boss.t = 0; }
        break;
      }
      case "telegraph": {
        // Wind-up: the eyes flash and it dips a touch so the attack is always announced.
        const f = Math.min(1, boss.t / BOSS.TELEGRAPH);
        eyeL.opacity = eyeR.opacity = 0.5 + 0.5 * Math.abs(Math.sin(boss.t * 18));
        boss.pos.y = attackY + Math.sin(f * Math.PI) * 12;
        if (boss.t >= BOSS.TELEGRAPH) {
          if (boss.attackKind === 0) spawnShockwave(cx, floorY, e);
          else spawnDebris(cx, floorY, boss.hp);
          boss.attackKind ^= 1; // alternate next attack
          boss.phase = "recover"; boss.t = 0;
        }
        break;
      }
      case "recover": {
        boss.pos.y = attackY + Math.sin(boss.bob * 1.6) * 8;
        eyeL.opacity = eyeR.opacity = 0.85;
        if (boss.t >= BOSS.RECOVER / e) { boss.phase = "descend"; boss.t = 0; }
        break;
      }
      case "descend": {
        const f = Math.min(1, boss.t / BOSS.MOVE_TIME);
        boss.pos.y = attackY + (windowY - attackY) * easeInOut(f);
        if (f >= 1) { boss.pos.y = windowY; boss.phase = "window"; boss.t = 0; boss.invulnerable = false; }
        break;
      }
      case "window": {
        boss.pos.y = windowY + Math.sin(boss.bob * 3) * 4;
        eyeL.opacity = eyeR.opacity = 0.6 + 0.4 * Math.abs(Math.sin(boss.t * 9)); // "stomp me" pulse
        if (boss.t >= BOSS.WINDOW_TIME) { boss.invulnerable = true; boss.phase = "ascend"; boss.t = 0; }
        break;
      }
      case "ascend": {
        const f = Math.min(1, boss.t / BOSS.MOVE_TIME);
        boss.pos.y = windowY + (attackY - windowY) * easeInOut(f);
        if (f >= 1) { boss.pos.y = attackY; boss.phase = "hover"; boss.t = 0; }
        break;
      }
    }
  });
  return boss;
}

// The boss's ground SHOCKWAVE: two dusty bands race outward along the arena floor from under
// the boss — JUMP them. Tagged "hazard" so the scene's existing hazard rule kills on touch
// (unless star-invincible). Speed stays under RUN_SPEED so it's always jumpable, and it
// despawns within its short life so it never lingers as an off-screen (culled) hazard.
function spawnShockwave(cx, floorY, enrage) {
  const speed = Math.min(BOSS.SHOCKWAVE_SPEED * enrage, BOSS.SHOCKWAVE_SPEED_CAP);
  for (const dir of [-1, 1]) {
    const wave = k.add([
      k.rect(36, 30, { radius: 6 }),
      k.pos(cx + dir * 18, floorY), // a small gap directly under the boss centre (fair spawn)
      k.anchor("bot"),
      k.area({ scale: 0.8 }),
      k.color(196, 166, 120),
      k.outline(2, k.rgb(70, 50, 34)),
      k.opacity(0.95),
      k.z(5),
      "hazard",
      "boss-attack", // distinguishes the boss's transient hazards from a level's static spikes
      { dir, age: 0 },
    ]);
    wave.onUpdate(() => {
      wave.age += k.dt();
      wave.pos.x += wave.dir * speed * k.dt();
      wave.opacity = 0.95 * Math.max(0, 1 - wave.age / BOSS.SHOCKWAVE_LIFE);
      if (wave.age >= BOSS.SHOCKWAVE_LIFE) k.destroy(wave);
    });
  }
}

// The boss's falling DEBRIS volley: telegraphed target markers on the floor, then rocks drop on
// them. A guaranteed 3-slot SAFE LANE is always left clear so the volley is dodgeable by moving
// (never a wall of rocks). More rocks as the boss is wounded (hp lower → bigger volley).
function spawnDebris(cx, floorY, hp) {
  const slots = 7;
  const span = 9 * 64; // arena-ish width centred on the boss
  const left = cx - span / 2;
  const safe = Math.floor(k.rand(0, slots)); // a guaranteed-clear lane (±1 slot kept empty too)
  const want = Math.min(BOSS.DEBRIS_BASE + (BOSS.HP - hp), slots - 3);
  let placed = 0;
  for (let s = 0; s < slots && placed < want; s++) {
    if (Math.abs(s - safe) <= 1) continue; // keep a 3-slot safe lane around `safe`
    placed++;
    dropDebris(left + (s + 0.5) * (span / slots), floorY);
  }
}

function dropDebris(x, floorY) {
  // Telegraph: a pulsing marker on the floor where the rock will land (a clear dodge window).
  const marker = k.add([
    k.rect(48, 8, { radius: 4 }),
    k.pos(x, floorY),
    k.anchor("bot"),
    k.color(224, 92, 82),
    k.opacity(0.5),
    k.z(5),
    { age: 0 },
  ]);
  marker.onUpdate(() => {
    marker.age += k.dt();
    marker.opacity = 0.3 + 0.4 * Math.abs(Math.sin(marker.age * 14));
    if (marker.age >= BOSS.DEBRIS_TELEGRAPH) k.destroy(marker);
  });
  k.wait(BOSS.DEBRIS_TELEGRAPH, () => {
    const rock = k.add([
      k.rect(40, 40, { radius: 8 }),
      k.pos(x, floorY - 360), // drops from up near the boss/ceiling
      k.anchor("center"),
      k.area({ scale: 0.8 }),
      k.color(120, 108, 124),
      k.outline(3, k.rgb(26, 20, 32)),
      k.z(5),
      "hazard",
      "boss-attack", // see spawnShockwave: lets a test count the boss's own attacks
      { vy: 0 },
    ]);
    rock.onUpdate(() => {
      rock.vy += BOSS.DEBRIS_GRAVITY * k.dt();
      rock.pos.y += rock.vy * k.dt();
      if (rock.pos.y >= floorY + 8) k.destroy(rock); // shatter on the floor
    });
  });
}

// --- Ballroom KEY (Livello 6): the reward the Custode di Pietra drops when it is felled (spawned
// by the game scene's fatal-stomp handler, not at level build). The key GATES the goal — the
// ballroom doors stay sealed until the heroine walks over it (see the goal handler in game.js),
// so it literally is "la chiave per accedere alla sala da ballo". Drawn from primitives like the
// star/feather (a gilded bow + shaft + teeth with a warm aura), so it needs no art asset. It falls
// from the boss's death spot, settles on the arena floor, then bobs + shimmers where she can reach
// it. Softlock-proof: the arena top is flat and wide and the key drops at the boss's x, so it can
// always be reached. Tag "key".
export function spawnKey(x, y, floorY) {
  const GOLD = [235, 200, 96];
  const EDGE = k.rgb(120, 84, 24); // dark gilt outline
  const restY = floorY - 30; // rests just above the floor surface (like a collectible's centre)
  const key = k.add([
    k.circle(16), // pickup collider (generous — a reward should feel kind)
    k.opacity(0), // collider only; the gilded art is the children below
    k.pos(x, Math.min(y, restY)), // start at the death spot (never below its resting spot)
    k.anchor("center"),
    k.area({ scale: 1.15 }),
    k.z(8), // above the floor/scenery, below the heroine (z10)
    "key",
    { vy: 0, landed: false, baseY: restY, t: k.rand(0, Math.PI * 2) },
  ]);
  // Warm aura so it reads as precious (mirrors the star/heart halos).
  const halo = key.add([k.circle(22), k.color(...GOLD), k.anchor("center"), k.pos(0, 0), k.opacity(0.2), k.z(-1)]);
  // The gilded key: a bow (ring) up top with a dark eye, a shaft, and two teeth at the tip. Held
  // in a rotate() container so the whole key can shimmer-wobble as one piece.
  const art = key.add([k.pos(0, 0), k.rotate(0), k.z(1)]);
  art.add([k.circle(9), k.anchor("center"), k.pos(0, -10), k.color(...GOLD), k.outline(3, EDGE)]); // bow
  art.add([k.circle(4), k.anchor("center"), k.pos(0, -10), k.color(40, 30, 44)]); // bow eye
  art.add([k.rect(5, 22, { radius: 2 }), k.anchor("top"), k.pos(0, -4), k.color(...GOLD), k.outline(2, EDGE)]); // shaft
  art.add([k.rect(9, 4, { radius: 1 }), k.anchor("left"), k.pos(-1, 12), k.color(...GOLD)]); // tooth 1
  art.add([k.rect(6, 4, { radius: 1 }), k.anchor("left"), k.pos(-1, 6), k.color(...GOLD)]); // tooth 2
  key.onUpdate(() => {
    const dt = k.dt();
    key.t += dt * 3;
    if (!key.landed) {
      // Fall from the death spot and settle on the floor.
      key.vy += PHYSICS.GRAVITY * 0.9 * dt;
      key.pos.y += key.vy * dt;
      if (key.pos.y >= restY) {
        key.pos.y = restY;
        key.landed = true;
      }
    } else {
      key.pos.y = key.baseY + Math.sin(key.t) * 4; // gentle bob once settled
    }
    art.angle = Math.sin(key.t * 0.7) * 6; // slow shimmer wobble
    halo.opacity = 0.14 + 0.14 * (0.5 + 0.5 * Math.sin(key.t * 2));
  });
  return key;
}

// --- Roller: a snowball that wakes when the heroine is near and gives chase along the
// ground — slower than her, so running away always works. TERRITORIAL: it never leaves
// ±4 cells of its post (it has no gravity, so an unbounded chase would float it over
// ravines). Tagged "enemy" → stompable.
function makeRoller(cx, cy) {
  const TERRITORY = 256;
  const roller = k.add([
    k.circle(26),
    k.opacity(0),
    k.pos(cx, cy),
    k.anchor("center"),
    k.area({ scale: 0.85 }),
    k.z(4),
    "enemy",
    { homeX: cx, vx: 0, awake: false },
  ]);
  const art = roller.add([k.sprite("roller"), k.anchor("center"), k.pos(0, 0)]);
  roller.onUpdate(() => {
    const dt = k.dt();
    const p = getPlayer();
    if (!roller.awake) {
      if (p && Math.abs(p.pos.x - roller.pos.x) < MECHANICS.ROLLER_RANGE) {
        roller.awake = true;
        art.play("roll");
      }
      return;
    }
    // Chase while she's in range, brake when she leaves (or at the territory borders).
    const chasing = p && Math.abs(p.pos.x - roller.pos.x) < MECHANICS.ROLLER_RANGE;
    if (chasing) roller.vx += Math.sign(p.pos.x - roller.pos.x) * MECHANICS.ROLLER_ACCEL * dt;
    else roller.vx -= Math.sign(roller.vx) * Math.min(Math.abs(roller.vx), MECHANICS.ROLLER_ACCEL * dt);
    roller.vx = Math.max(-MECHANICS.ROLLER_MAX, Math.min(MECHANICS.ROLLER_MAX, roller.vx));
    roller.move(roller.vx, 0);
    if (roller.pos.x < roller.homeX - TERRITORY) {
      roller.pos.x = roller.homeX - TERRITORY;
      roller.vx = 0;
    } else if (roller.pos.x > roller.homeX + TERRITORY) {
      roller.pos.x = roller.homeX + TERRITORY;
      roller.vx = 0;
    }
    art.flipX = roller.vx < 0;
  });
  return roller;
}

// --- Updraft column cell: while inside, the heroine's fall is caught and she is lifted
// gently (the game scene applies the lift via the "updraft" tag). Faint visual column +
// the occasional rising bubble so the air current reads.
function makeUpdraft(x, y, TILE, theme) {
  k.add([
    k.rect(TILE, TILE),
    k.pos(x, y),
    k.area(),
    k.opacity(0.07),
    k.color(...(theme.collectibleGlow || PALETTE.cream)),
    k.z(1),
    "updraft",
  ]);
  k.loop(0.6, () => {
    // Cull off-screen spawning: a level has many updraft/breeze cells, each running this
    // loop, but only the ones near the heroine are ever visible. Skipping the spawn when the
    // cell is well off-camera kills the object churn (and per-frame onUpdate cost) of bubbles
    // nobody can see, with zero change to what's on screen. (See makeBreeze for the same gate.)
    if (Math.abs(x - k.camPos().x) > GAME_W * 0.75) return;
    const b = k.add([
      k.circle(k.rand(2, 4)),
      k.pos(x + k.rand(8, TILE - 8), y + TILE),
      k.anchor("center"),
      k.color(...(theme.collectibleGlow || PALETTE.cream)),
      k.opacity(0.5),
      k.z(2),
      { vy: k.rand(60, 110), age: 0 },
    ]);
    b.onUpdate(() => {
      b.age += k.dt();
      b.pos.y -= b.vy * k.dt();
      b.opacity = Math.max(0, 0.5 - b.age * 0.45);
      if (b.opacity <= 0) k.destroy(b);
    });
  });
}

// --- Breeze column cell (giardino, Livello 5): a horizontal petal current — while inside,
// the heroine is carried forward and her fall softens (the game scene applies the push via
// the "breeze" tag). The horizontal twin of makeUpdraft: faint band + drifting petals.
function makeBreeze(x, y, TILE, theme) {
  const petal = theme.collectibleGlow || PALETTE.cream;
  k.add([
    k.rect(TILE, TILE),
    k.pos(x, y),
    k.area(),
    k.opacity(0.06),
    k.color(...petal),
    k.z(1),
    "breeze",
  ]);
  k.loop(0.5, () => {
    // Off-screen cull (Livello 5 fluidità): L5 has 41 breeze cells, each running this loop —
    // ~80 petal objects created/destroyed per second, mostly far off-camera. Spawning only
    // when the cell is near the view keeps the on-screen look identical while removing the GC
    // + per-frame onUpdate load of petals nobody sees (the cost that made L5 less smooth than
    // L6's pure-math pendulums on the 60fps-capped mobile path). Generous margin → no pop-in.
    if (Math.abs(x - k.camPos().x) > GAME_W * 0.75) return;
    const p = k.add([
      k.rect(6, 4, { radius: 2 }),
      k.pos(x, y + k.rand(8, TILE - 8)),
      k.anchor("center"),
      k.rotate(k.rand(0, 360)),
      k.color(...petal),
      k.opacity(0.55),
      k.z(2),
      { vx: k.rand(140, 220), age: 0, spin: k.rand(-180, 180), baseY: 0 },
    ]);
    p.baseY = p.pos.y;
    p.onUpdate(() => {
      p.age += k.dt();
      p.pos.x += p.vx * k.dt();
      p.pos.y = p.baseY + Math.sin(p.age * 6) * 5; // petals flutter as they ride the current
      p.angle += p.spin * k.dt();
      p.opacity = Math.max(0, 0.55 - p.age * 0.5);
      if (p.opacity <= 0) k.destroy(p);
    });
  });
}

// --- Pendulum chandelier (castello, Livello 6): a lethal golden bob swinging on a chain
// from the anchor cell. Pure math like makeMover (sine swing), lethality like a hazard —
// the timing puzzle is crossing under it on the off-swing.
function makePendulum(cx, cy, theme) {
  const L = MECHANICS.PENDULUM_LENGTH;
  const phase = cx * 0.01; // desync chandeliers along the level deterministically
  const anchor = k.add([k.pos(cx, cy), k.z(3)]);
  anchor.add([k.circle(6), k.anchor("center"), k.pos(0, 0), k.color(120, 100, 70)]); // mount
  const links = [0.3, 0.55, 0.8].map((f) =>
    anchor.add([k.circle(3), k.anchor("center"), k.pos(0, L * f), k.color(150, 130, 90), { f }]),
  );
  const bob = k.add([
    k.circle(17),
    k.pos(cx, cy + L),
    k.anchor("center"),
    k.area({ scale: 0.85 }),
    k.color(...(theme.goal || PALETTE.gold)),
    k.z(4),
    "hazard",
    "pendulum",
  ]);
  bob.add([k.circle(9), k.anchor("center"), k.pos(0, -2), k.color(255, 222, 140)]); // candle glow
  bob.add([k.circle(4), k.anchor("center"), k.pos(0, -8), k.color(255, 250, 220)]); // flame
  bob.onUpdate(() => {
    const a = MECHANICS.PENDULUM_ARC * Math.sin((k.time() / MECHANICS.PENDULUM_PERIOD) * Math.PI * 2 + phase);
    const off = k.vec2(Math.sin(a) * L, Math.cos(a) * L);
    bob.pos = k.vec2(cx + off.x, cy + off.y);
    for (const link of links) link.pos = k.vec2(off.x * link.f, off.y * link.f);
  });
  return bob;
}

// --- Moving platform: a small slab gliding on a sine path; riders are carried natively by
// the physics (the player body sticks to the platform it stands on). Ride it by waiting at a
// gap's edge for it to arrive.
function makeMover(m, TILE, theme) {
  const w = m.w || 2;
  const base = k.vec2(m.x * TILE, m.y * TILE);
  const mover = k.add([
    k.pos(base),
    k.area({ shape: new k.Rect(k.vec2(0, 0), w * TILE, TILE * 0.6) }),
    k.body({ isStatic: true }),
    k.z(2),
    "solid",
    "mover",
    {
      base,
      spanW: w * TILE, // explicit width — the container has no sprite to derive it from
      ampX: (m.dx || 0) * TILE,
      ampY: (m.dy || 0) * TILE,
      period: m.period || 3,
      phase: m.phase || 0,
    },
  ]);
  for (let i = 0; i < w; i++) {
    mover.add([k.sprite("platform"), k.pos(i * TILE, 0), k.color(...theme.solid)]);
  }
  mover.onUpdate(() => {
    const s = Math.sin((k.time() / mover.period) * Math.PI * 2 + mover.phase);
    mover.pos = k.vec2(Math.round(mover.base.x + mover.ampX * s), Math.round(mover.base.y + mover.ampY * s));
  });
  return mover;
}

// --- Static hazard (thorns / sea urchins): a low spiky block, tagged "hazard".
// The collider is the original invisible half-cell rect (identical hitbox + "hazard" tag +
// top-left pos); the spike art is a child sprite,
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
  // state, so the pickup feel is unchanged. The art is a per-theme
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
  // Soft themed aura so the pickup reads as precious (juiciness). Pure decoration.
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
    k.z(3),
  ]);
  // Coin-style spin (replaces the old rotate-sway), started at a random frame so a row of
  // pickups doesn't spin in eerie lockstep.
  sprite.play("spin");
  sprite.frame = Math.floor(k.rand(0, 6));
  item.onUpdate(() => {
    item.t += k.dt() * 3;
    item.pos.y = item.baseY + Math.sin(item.t) * 5; // a touch more bob than before
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

// --- Feather power-up (Fase 2): grabbing it grants a short high-jump window (the game scene
// boosts the player's jump force). Drawn from primitives like the star — an invisible circle
// collider tagged "feather" + a child feather polygon (vane + white spine) and a cool aura —
// so it needs no art asset and reads the same in every theme. Bobs and tilts gently.
function makeFeather(cx, cy) {
  const COL = [200, 224, 248]; // pale sky-blue, distinct from the star's gold
  const item = k.add([
    k.circle(14),
    k.opacity(0),
    k.pos(cx, cy),
    k.anchor("center"),
    k.area({ scale: 1.1 }), // slightly generous pickup (casual)
    k.z(3),
    "feather",
    { baseY: cy, t: k.rand(0, Math.PI * 2) },
  ]);
  // Cool aura behind the feather so it reads as "special" (mirrors the star's warm halo).
  // Visibility (segnalato per il Livello 4 — la neve quasi bianca la ingoiava): the aura is a
  // touch stronger and a hair warmer so a careful eye catches it, WITHOUT making it obvious —
  // it stays a hidden bonus (the player has to be looking). The real readability win is the
  // faint dark outline on the vane below, which lifts the pale silhouette off a white backdrop.
  const halo = item.add([
    k.circle(22),
    k.color(210, 230, 252),
    k.anchor("center"),
    k.pos(0, 0),
    k.opacity(0.3),
    k.z(2),
  ]);
  // The feather vane (a leaf silhouette pointing up) + a bright central spine. A thin dark
  // outline gives the pale vane an edge on light backgrounds (snow) — still understated.
  const vane = item.add([
    k.polygon([
      k.vec2(0, -18), k.vec2(5, -6), k.vec2(7, 4), k.vec2(4, 14),
      k.vec2(0, 17), k.vec2(-4, 14), k.vec2(-7, 4), k.vec2(-5, -6),
    ]),
    k.anchor("center"),
    k.pos(0, 0),
    k.color(...COL),
    k.outline(2, k.rgb(46, 64, 96)),
    k.rotate(0),
    k.z(3),
  ]);
  vane.add([k.rect(2, 28), k.anchor("center"), k.pos(0, -1), k.color(255, 255, 255), k.opacity(0.85)]);
  item.onUpdate(() => {
    item.t += k.dt() * 3;
    item.pos.y = item.baseY + Math.sin(item.t) * 6; // bob
    vane.angle = Math.sin(item.t * 0.7) * 12; // gentle sway (only the art tilts, not the hitbox)
    halo.opacity = 0.22 + 0.14 * (0.5 + 0.5 * Math.sin(item.t * 2)); // pulse
  });
  return item;
}

// --- Heart pickup (Fase Arcade): grabbing it grants +1 life (the game scene caps it). Drawn
// from primitives like the star/feather — an invisible circle collider tagged "heart" + a
// child heart silhouette (two lobes + a rotated square point) and a warm aura — so it needs no
// art asset and reads the same in every theme. Bobs gently. One per level (see level data).
function makeHeart(cx, cy) {
  const COL = [232, 76, 110]; // warm heart red-rose (matches the lives HUD)
  const item = k.add([
    k.circle(14),
    k.opacity(0),
    k.pos(cx, cy),
    k.anchor("center"),
    k.area({ scale: 1.15 }), // generous — a life pickup should feel kind
    k.z(3),
    "heart",
    { baseY: cy, t: k.rand(0, Math.PI * 2) },
  ]);
  const halo = item.add([
    k.circle(20), k.color(...COL), k.anchor("center"), k.pos(0, 0), k.opacity(0.18), k.z(2),
  ]);
  // Pixel-art heart sprite (tools/gen/world.mjs paintHeart) — replaces the old primitive
  // lobes+square so it reads as pixel art like the rest of the world. Aura + bob are kept.
  item.add([k.sprite("heart"), k.anchor("center"), k.pos(0, 0), k.z(3)]);
  item.onUpdate(() => {
    item.t += k.dt() * 3;
    item.pos.y = item.baseY + Math.sin(item.t) * 6; // bob
    halo.opacity = 0.14 + 0.14 * (0.5 + 0.5 * Math.sin(item.t * 2)); // pulse
  });
  return item;
}

// --- Crab enemy: patrols horizontally, tagged "enemy". Primitive art (no asset needed).
function makeCrab(cx, cy, theme) {
  // Collider-only invisible body (same 40×24 hitbox + "enemy" tag + patrol state); the crab
  // art is a child sprite.
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
  art.play("walk");

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
  // art is a child sprite.
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
  const wings = flyer.add([k.sprite("flyer"), k.anchor("center"), k.pos(0, 0)]);
  wings.play("fly");

  flyer.onUpdate(() => {
    flyer.pos.x += flyer.dir * ENEMIES.FLY_SPEED * k.dt();
    if (flyer.pos.x > flyer.baseX + ENEMIES.FLY_RANGE) flyer.dir = -1;
    else if (flyer.pos.x < flyer.baseX - ENEMIES.FLY_RANGE) flyer.dir = 1;
    flyer.t += k.dt() * ENEMIES.FLY_BOB_SPEED;
    flyer.pos.y = flyer.baseY + Math.sin(flyer.t) * ENEMIES.FLY_BOB;
  });
  return flyer;
}

// --- Hopper enemy (Rospo Saltatore, Fase Arcade): a ground toad that rests, then springs in a
// timed arc — opening and closing a passable gap (jump over it, or run under its apex). Tagged
// "enemy" so the scene's standard Mario rules apply (stomp from above defeats it; side/below
// contact is lethal) — zero changes needed in game.js. Motion is a simple hand-integrated arc
// off a fixed baseline (baseY), like the swooper/roller (no physics body): place hoppers on
// FLAT ground so the baseline reads true. Drawn from primitives (no art asset). Units from
// ENEMIES.HOPPER_* (config.js).
function makeHopper(cx, cy, theme) {
  const hopper = k.add([
    k.rect(34, 28, { radius: 11 }),
    k.opacity(0),
    k.pos(cx, cy),
    k.anchor("center"),
    k.area({ scale: 0.9 }),
    k.z(4),
    "enemy",
    // rest counts down on the ground; a random start so a row of hoppers doesn't pulse in sync.
    { baseX: cx, baseY: cy, dir: 1, vy: 0, airborne: false, rest: k.rand(0, ENEMIES.HOPPER_INTERVAL) },
  ]);
  // Toad art as a single pixel-art sprite (tools/gen/world.mjs paintHopper); the container
  // scale set in onUpdate below gives the hop its squash-and-stretch weight.
  const art = hopper.add([k.sprite("hopper"), k.pos(0, 0), k.scale(1), k.anchor("center"), k.z(4)]);

  hopper.onUpdate(() => {
    const dt = k.dt();
    if (!hopper.airborne) {
      // Resting: ease back to the natural shape, then launch when the timer runs out. Decide
      // the leap direction here (flip if we've drifted past a patrol bound) and keep it for the
      // whole arc so the jump reads as one clean hop.
      art.scale = k.vec2(1, 1);
      hopper.rest -= dt;
      if (hopper.rest <= 0) {
        if (hopper.pos.x > hopper.baseX + ENEMIES.HOPPER_RANGE) hopper.dir = -1;
        else if (hopper.pos.x < hopper.baseX - ENEMIES.HOPPER_RANGE) hopper.dir = 1;
        hopper.vy = -ENEMIES.HOPPER_JUMP_VEL;
        hopper.airborne = true;
      }
      return;
    }
    // Airborne: integrate a simple gravity arc; squash/stretch from vertical speed (taller on
    // the way up, flatter on the way down) gives the hop a springy weight.
    hopper.vy += PHYSICS.GRAVITY * dt;
    hopper.pos.y += hopper.vy * dt;
    hopper.pos.x += hopper.dir * ENEMIES.HOPPER_HOP_DX * dt;
    const s = Math.max(-0.22, Math.min(0.22, -hopper.vy / 1800));
    art.scale = k.vec2(1 - s, 1 + s);
    if (hopper.pos.y >= hopper.baseY) {
      // Landed: snap to the baseline and rest before the next hop.
      hopper.pos.y = hopper.baseY;
      hopper.vy = 0;
      hopper.airborne = false;
      hopper.rest = ENEMIES.HOPPER_INTERVAL;
    }
  });
  return hopper;
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
  const portal = k.add([k.sprite("portal"), k.pos(cx, cy + 20), k.anchor("bot"), k.color(...goalCol), k.z(1)]);
  portal.play("shimmer");
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
    // sans-serif: the sparkle emoji isn't in the pixel UI font.
    k.text("✨", { size: 44, font: "sans-serif" }),
    k.pos(cx, cy + 20 - H),
    k.anchor("center"),
    k.z(3),
  ]);
  // Rising motes along the beam — a little magic at the level's end. Scene-scoped
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
