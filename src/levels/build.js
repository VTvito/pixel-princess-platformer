// build.js — turns a level definition (see level1.js / level2.js) into game objects.
// Reusable across every themed level: it only knows the tile legend, not the specific
// layout, and reads colours/visuals from the level's `theme`. Returns the bits the scene
// needs to wire gameplay (spawn point, world size, collectible count). Collisions, HUD and
// respawn live in the scene; this file just builds the world.
//
// Tile legend: "=" solid  "^" hazard (thorns/urchins)  "o" collectible  "*" star power-up
//              "c" crab enemy  "f" flyer enemy (air)  "s" stalactite hazard (falls)
//              "#" semisolid one-way platform   "M" spring mushroom   "!" crumble platform
//              "F" checkpoint flag   "g" swooper (diving ghost)   "r" roller (chasing ball)
//              "w" updraft column cell   "B" breeze column cell (horizontal petal current)
//              "P" pendulum chandelier (anchor cell; the lethal bob swings below)
//              "G" Gargoyle Custode (mini-boss: a 2x stone swooper with 3 hp)
//              "@" spawn   ">" goal   " " air (a gap in the ground rows is a ravine)
// Moving platforms are not ASCII: a level may add `movers: [{x,y,w,dx,dy,period,phase}]`
// (cells; dx/dy = travel amplitude in cells) — see makeMover.

import { k } from "../kaplayCtx.js";
import { PALETTE, ENEMIES, HAZARDS, MECHANICS, PHYSICS } from "../config.js";
import { sfx } from "../sfx.js";

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
          k.add([
            k.sprite(frame),
            k.pos(x, y),
            k.area(),
            k.body({ isStatic: true }),
            k.color(...theme.solid),
            "solid",
          ]);
          // Bright grass/snow cap on exposed top surfaces: a transparent pixel overlay with
          // blades, tinted theme.solidTop (keeps the faithful two-tone surface look).
          if (airAbove) {
            k.add([k.sprite(c % 2 ? "grass_cap_2" : "grass_cap"), k.pos(x, y), k.color(...theme.solidTop), k.z(1)]);
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
        case "G":
          makeGargoyle(x + TILE / 2, y + TILE / 2);
          break;
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

  // Moving platforms (data-driven, not ASCII — see the legend note at the top).
  for (const m of def.movers || []) makeMover(m, TILE, theme);

  // Decor props: collider-free scenery. Procedural dressing on the ground tops collected
  // above, plus authored hero placements (def.decor, data-driven like movers) — a tree
  // framing the goal, lanterns flanking a checkpoint. Neither touches gameplay or the bot.
  placeDecorProps(theme, decorSpots, TILE);
  for (const d of def.decor || []) {
    makeDecorProp(d.key, (d.x + 0.5) * TILE, (d.y + 1) * TILE, !!d.fg);
  }

  if (!spawn) spawn = k.vec2(TILE * 1.5, 0); // defensive fallback if a level omits "@"
  return { spawn, worldW, worldH, collectiblesTotal };
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

// --- Spring mushroom: auto-bounce on contact from above — no button needed, so it works
// identically for a casual human and the autoplay bot. Launches higher than a jump.
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
    p.vel.y = -MECHANICS.SPRING_VEL;
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
function makeSwooper(cx, cy) {
  const swooper = k.add([
    k.rect(34, 30, { radius: 10 }),
    k.opacity(0),
    k.pos(cx, cy),
    k.anchor("center"),
    k.area({ scale: 0.85 }),
    k.z(4),
    "enemy",
    { baseY: cy, diving: false, t: 0, cooldown: 0 },
  ]);
  const art = swooper.add([k.sprite("swooper"), k.anchor("center"), k.pos(0, 0)]);
  art.play("float");
  swooper.onUpdate(() => {
    const dt = k.dt();
    const p = k.get("player")[0];
    if (!swooper.diving) {
      swooper.cooldown -= dt;
      swooper.pos.y = swooper.baseY + Math.sin(k.time() * 2.2) * 8; // idle hover
      if (p && swooper.cooldown <= 0 && Math.abs(p.pos.x - swooper.pos.x) < MECHANICS.SWOOP_RANGE) {
        swooper.diving = true;
        swooper.t = 0;
      }
    } else {
      swooper.t += dt;
      const f = Math.min(1, swooper.t / MECHANICS.SWOOP_TIME);
      swooper.pos.y = swooper.baseY + Math.sin(f * Math.PI) * MECHANICS.SWOOP_DROP; // down & back
      if (p) swooper.pos.x += Math.sign(p.pos.x - swooper.pos.x) * 46 * dt; // lean toward her
      if (f >= 1) {
        swooper.diving = false;
        swooper.cooldown = MECHANICS.SWOOP_COOLDOWN;
      }
    }
  });
  return swooper;
}

// --- Gargoyle Custode (Fase 5 mini-boss): a stone swooper at double size with 3 hp.
// Same dive pattern as makeSwooper, but each stomp (handled by the game scene via the
// hp field) makes it dive faster and rest less. Defeating it is satisfying but OPTIONAL:
// the cooldown between dives is the sneak-past window — the same opening the autoplay
// bot uses, so the critical path never requires the fight.
function makeGargoyle(cx, cy) {
  const gargoyle = k.add([
    k.rect(64, 56, { radius: 16 }),
    k.opacity(0),
    k.pos(cx, cy),
    k.anchor("center"),
    k.area({ scale: 0.8 }),
    k.z(4),
    "enemy",
    {
      hp: 3,
      baseY: cy,
      diving: false,
      t: 0,
      // Starts already "resting": a bold straight sprint slips past before the first
      // dive (the sneak window — hesitating or jumping for the goblets gets punished;
      // it also keeps the guardian optional for the autoplay bot).
      cooldown: MECHANICS.SWOOP_COOLDOWN * 1.25,
      // Per-instance dive tunables — the scene shortens them on each stomp (enrage).
      swoopTime: MECHANICS.SWOOP_TIME * 1.15,
      swoopCooldown: MECHANICS.SWOOP_COOLDOWN * 1.25,
    },
  ]);
  // The swooper sprite at 2x, tinted stone-grey: the lantern-ghost reads as a carved
  // guardian. Exposed as .art so the scene can flash it on a successful stomp.
  const art = gargoyle.add([
    k.sprite("swooper"),
    k.anchor("center"),
    k.pos(0, 0),
    k.scale(2),
    k.color(150, 150, 170),
  ]);
  art.play("float");
  gargoyle.art = art;
  gargoyle.onUpdate(() => {
    const dt = k.dt();
    const p = k.get("player")[0];
    if (!gargoyle.diving) {
      gargoyle.pos.y = gargoyle.baseY + Math.sin(k.time() * 1.8) * 10; // heavy stone hover
      const inRange = p && Math.abs(p.pos.x - gargoyle.pos.x) < MECHANICS.SWOOP_RANGE * 1.3;
      // The stare-down: the dive timer only runs while she's in range, so EVERY approach
      // gets the same window — sprint straight through and it never strikes; hesitate
      // (or jump for the goblets) and the stone wakes.
      if (inRange) gargoyle.cooldown -= dt;
      if (inRange && gargoyle.cooldown <= 0) {
        gargoyle.diving = true;
        gargoyle.t = 0;
      }
    } else {
      gargoyle.t += dt;
      const f = Math.min(1, gargoyle.t / gargoyle.swoopTime);
      gargoyle.pos.y = gargoyle.baseY + Math.sin(f * Math.PI) * (MECHANICS.SWOOP_DROP * 1.25);
      if (p) gargoyle.pos.x += Math.sign(p.pos.x - gargoyle.pos.x) * 60 * dt; // lean toward her
      if (f >= 1) {
        gargoyle.diving = false;
        gargoyle.cooldown = gargoyle.swoopCooldown;
      }
    }
  });
  return gargoyle;
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
    const p = k.get("player")[0];
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
// the physics (the player body sticks to the platform it stands on). Tagged "mover" so the
// autoplay bot can wait for it at a gap's edge.
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
    k.z(3),
  ]);
  // Coin-style spin (replaces the old rotate-sway), started at a random frame so a row of
  // pickups doesn't spin in eerie lockstep.
  sprite.play("spin");
  sprite.frame = Math.floor(k.rand(0, 6));
  item.onUpdate(() => {
    item.t += k.dt() * 3;
    item.pos.y = item.baseY + Math.sin(item.t) * 5; // a touch more bob than before (spec §4)
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
