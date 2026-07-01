// level6.js — "Castello Reale" (commercial upgrade, Livello 6 — the final approach).
// Pure DATA: a tile map + a colour theme; the generic builder (build.js) renders it.
// Level identity: PENDULUM chandeliers swinging over the hall (timed crossings), ghost
// SWOOPERS between the columns, a gliding platform over the cellar pit, and the grand
// staircase up to the ballroom doors. The hardest chapter — so it also grants the run's last
// heart (+1 vita) on the approach. Legend: see build.js.
//
// Arc: intro (the entrance hall, a bat overhead) → develop (the first chandelier, then
// the cellar-pit crossing) → twist (the chandelier gauntlet + a crumbling minstrel
// ledge) → climax (the grand staircase and the FINAL BOSS, the "Custode di Pietra" — a
// 2-hp multi-phase stone guardian that GATES the ballroom doors: dodge its shockwaves and
// falling debris, then stomp it during its vulnerable window. See build.js makeBoss).

import { composeMap, arcCollectibles, laneFor, airFor } from "./mapkit.js";

// Taller map (vertical camera follow): 14 rows — headroom for chandeliers + balconies.
const H = 14;
const LANE = laneFor(H);
const AIR = airFor(H);

export const LEVEL_6 = {
  id: 6,
  name: "Castello Reale",
  tileSize: 64,

  // Interno del castello: pietra e bordeaux, ori e candele (la sala prima del ballo).
  theme: {
    decor: "castle", // background style (see game.js drawBackground)
    collectibleIcon: "🏆", // HUD icon for the goblets (older emoji; renders on Win10)
    collectibleSprite: "goblet", // world sprite for the pickup (src/levels/build.js)
    hudText: [255, 240, 220], // HUD/banner text (candle-lit cream)
    bg: [40, 18, 28], // deep bordeaux hall
    bgBand: [90, 50, 40], // candle glow pooling near the floor
    decoFar: [60, 36, 48], // distant colonnade silhouettes
    decoNear: [48, 28, 40],
    parallaxFar: [78, 50, 62], // far columns + banners (parallax far)
    parallaxNear: [104, 66, 70], // near colonnade (parallax near)
    mote: [255, 210, 120], // golden candle-dust (ambient particles)
    solid: [110, 95, 118], // castle stone
    solidTop: [205, 170, 95], // gilded floor trim
    hazard: [150, 150, 170], // steel spike rack
    hazardTip: [220, 224, 240],
    collectible: [218, 178, 70], // golden goblet
    collectibleAccent: [255, 240, 190],
    collectibleGlow: [255, 215, 130], // warm gold aura
    enemy: [44, 40, 60], // bat (flyer build)
    enemyAccent: [22, 20, 34],
    goal: [255, 210, 120], // the ballroom doors' light
    // Decor props menu (collider-free scenery; weights drive the procedural mix — build.js).
    props: [
      { key: "deco_candelabra", weight: 3 },
      { key: "deco_armor", weight: 2 },
      { key: "deco_royalbanner", weight: 2 },
    ],
  },

  // Authored decor: armour flanking the entrance, candelabra along the hall (two by the
  // x66/x90 checkpoints), the royal banner beside the ballroom doors.
  decor: [
    { x: 5, y: LANE, key: "deco_armor" },
    { x: 40, y: LANE, key: "deco_candelabra" },
    { x: 66, y: LANE, key: "deco_candelabra" },
    { x: 90, y: LANE, key: "deco_candelabra" },
    { x: 122, y: 8, key: "deco_royalbanner" },
  ],

  // The cellar-pit crossing: one gliding platform, flush with both edges at its extremes.
  movers: [{ x: 60, y: LANE, w: 2, dx: 2, period: 3.6 }],

  map: composeMap({
    width: 126,
    height: H,
    ravines: [
      { x: 18, w: 2 }, // intro: a plain jumpable gap
      { x: 58, w: 5 }, // develop: the cellar pit — ride the glider
    ],
    // The grand staircase: three rising runs up to the ballroom doors.
    terraces: [
      { x: 104, w: 4, h: 1 },
      { x: 108, w: 4, h: 2 },
      { x: 112, w: 14, h: 3 },
    ],
    // Chandelier mounts (the ceiling slab each chain hangs from). They sit 3+ cells above
    // the walking line — well out of jump reach — and stay solid (no head-room conflict).
    platforms: [
      { x: 32, y: 7, w: 1 }, // mount, chandelier 1
      { x: 80, y: 7, w: 1 }, // mount, chandelier 2
      // (The 3rd chandelier mount is gone: the staircase top is now the BOSS ARENA — the
      // Custode di Pietra owns that airspace, so no swinging chandelier shares it.)
    ],
    // Step up to the minstrel ledge: a one-way ledge (#) at row10, to the RIGHT of the
    // chandelier's swing (the bob sweeps ~x77-83), so it's reachable from the ground in a
    // single 2-cell hop, then a second hop onto the crumble ledge. Semisolid so she passes
    // under it on the lane without being walled in. (The old solid step at x83,y9 sat 3
    // cells up — unreachable without a double jump — and inside the pendulum's arc.)
    semisolids: [{ x: 84, y: 10, w: 1 }],
    items: [
      { x: 2, y: LANE, ch: "@" },
      { x: 124, y: 8, ch: ">" }, // the ballroom doors, atop the staircase
      // Pendulum chandeliers: anchors under their mounts; bobs sweep the walking line.
      { x: 32, y: 8, ch: "P" },
      { x: 80, y: 8, ch: "P" },
      // (The 3rd chandelier is gone — the staircase top is the boss arena now, see "G" below.)
      // The crumbling minstrel ledge over the gauntlet, with its goblet hoard.
      { x: 85, y: 8, ch: "!" },
      { x: 86, y: 8, ch: "!" },
      { x: 87, y: 8, ch: "!" },
      { x: 86, y: 7, ch: "o" },
      { x: 87, y: 7, ch: "o" },
      // Arcade: the final chapter keeps just TWO checkpoints, banking the two hardest stretches
      // tightly — before the chandelier gauntlet (x66) and before the grand-staircase climax
      // (x90). The whole front (intro + chandelier 1 + the cellar-pit glider) is now a single
      // run from spawn: surviving the castle means more on the line. Clean run-up ahead of each.
      { x: 66, y: LANE, ch: "F" },
      { x: 90, y: LANE, ch: "F" },
      // A hopper on the flat approach to the cellar pit (front run, after chandelier 1).
      { x: 52, y: LANE, ch: "h" },
      // Steel spike racks on the flagstones.
      { x: 12, y: LANE, ch: "^" },
      { x: 46, y: LANE, ch: "^" },
      { x: 96, y: LANE, ch: "^" }, // on the flat approach to the grand staircase (banked at x90)
      { x: 101, y: LANE, ch: "^" },
      // A bat over the hall (kept clear of ravine jump-arcs and chandelier hop zones —
      // an air enemy there either kills the arc or blocks a needed hop).
      { x: 50, y: AIR, ch: "f" },
      // The hall ghost between the chandeliers — an ARMORED swooper (2 hp), the last
      // guardian to soften you up before the boss. Same flight as a ghost, so it stays
      // passable between dives. (No ghost over the staircase: an air enemy above a required
      // step-up jump can deadlock the climb — the L3 lesson. Chandelier 3 guards the climb
      // instead.)
      { x: 72, y: 8, ch: "S" },
      // THE FINAL BOSS — "Custode di Pietra". It owns the flat staircase top and GATES the
      // ballroom doors: the goal stays inert until the boss is felled (see game.js). Unlike the
      // old sneak-past Gargoyle, this is a real multi-phase fight — it hovers out of reach
      // raining attacks (a ground SHOCKWAVE to jump, and falling DEBRIS), then DESCENDS into a
      // vulnerable window to be stomped, enraging with each hit. The tile y is only its column
      // (makeBoss derives its hover/window heights from the arena floor it scans below). Centred
      // at x=119 so it has room on both sides over the x112-125 staircase top. See build.js.
      { x: 119, y: 4, ch: "G" },
      // Star power-up before the gauntlet — blow through chandelier 2 invincible. A welcome
      // out for the hardest timing gate (pendulum 2 + the armored ghost), but its window is
      // short (POWERUP.DURATION 5s) so it's a breather, not a "win button".
      { x: 74, y: LANE, ch: "*" },
      // Arcade: the castle's single heart (+1 vita), on the flat lane just after the x90
      // checkpoint and before the grand-staircase boss climax — one extra life to face the
      // Custode with, since this is the hardest chapter and ends in a fight. Clear of the
      // spike racks (x96/x101) and the staircase, grabbed on the run-up. (Livelli 3 e 5
      // grant the other +1s; heartsTaken makes it a once-per-run pickup — see state.js.)
      { x: 92, y: LANE - 1, ch: "H" },
      ...arcCollectibles([6, 15, 26, 38, 44, 54, 68, 76, 86, 94], [AIR, LANE - 1]),
      // Goblets up the staircase.
      { x: 105, y: 9, ch: "o" },
      { x: 109, y: 8, ch: "o" },
      { x: 114, y: 7, ch: "o" },
      { x: 121, y: 7, ch: "o" },
    ],
  }),
};
