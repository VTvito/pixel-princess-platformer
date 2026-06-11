// level6.js — "Castello Reale" (commercial upgrade, Livello 6 — the final approach).
// Pure DATA: a tile map + a colour theme; the generic builder (build.js) renders it.
// Level identity: PENDULUM chandeliers swinging over the hall (timed crossings), ghost
// SWOOPERS between the columns, a gliding platform over the cellar pit, and the grand
// staircase up to the ballroom doors. The hardest chapter. Legend: see build.js.
//
// Arc: intro (the entrance hall, a bat overhead) → develop (the first chandelier, then
// the cellar-pit crossing) → twist (the chandelier gauntlet + a crumbling minstrel
// ledge) → climax (the grand staircase, one last chandelier, and the GARGOYLE CUSTODE
// — a 3-hp stone guardian over the ballroom doors; fell it with three stomps, or slip
// past between its dives).

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

  // Authored decor: armour flanking the entrance, candelabra at the checkpoints, the
  // royal banner beside the ballroom doors.
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
    // Chandelier mounts (the ceiling slab each chain hangs from) + the minstrel step.
    // Steps/mounts sit 3+ cells above the walkers — outside the bot's step probe.
    platforms: [
      { x: 32, y: 7, w: 1 }, // mount, chandelier 1
      { x: 80, y: 7, w: 1 }, // mount, chandelier 2
      { x: 118, y: 3, w: 1 }, // mount, chandelier 3 (over the staircase top)
      { x: 83, y: 9, w: 1 }, // step up to the minstrel ledge
    ],
    items: [
      { x: 2, y: LANE, ch: "@" },
      { x: 124, y: 8, ch: ">" }, // the ballroom doors, atop the staircase
      // Pendulum chandeliers: anchors under their mounts; bobs sweep the walking line.
      { x: 32, y: 8, ch: "P" },
      { x: 80, y: 8, ch: "P" },
      // The last chandelier hangs higher: it grazes the staircase top only at dead
      // centre — it punishes jumping for the goblets, not the walk to the doors.
      { x: 118, y: 4, ch: "P" },
      // The crumbling minstrel ledge over the gauntlet, with its goblet hoard.
      { x: 85, y: 8, ch: "!" },
      { x: 86, y: 8, ch: "!" },
      { x: 87, y: 8, ch: "!" },
      { x: 86, y: 7, ch: "o" },
      { x: 87, y: 7, ch: "o" },
      // Checkpoints: clean run-up ahead of each (the pendulum lessons of L1-4).
      { x: 22, y: LANE, ch: "F" },
      { x: 40, y: LANE, ch: "F" },
      { x: 66, y: LANE, ch: "F" },
      { x: 90, y: LANE, ch: "F" },
      { x: 96, y: LANE, ch: "F" },
      // Steel spike racks on the flagstones.
      { x: 12, y: LANE, ch: "^" },
      { x: 46, y: LANE, ch: "^" },
      { x: 101, y: LANE, ch: "^" },
      // A bat over the hall (kept clear of ravine jump-arcs and chandelier hop zones —
      // an air enemy there either kills the arc or vetoes the bot's needed hop).
      { x: 50, y: AIR, ch: "f" },
      // The hall ghost between the chandeliers. (No ghost over the staircase: an air
      // enemy above a required step-up jump deadlocks the bot's hop — the L3 lesson.
      // Chandelier 3 guards the climb instead.)
      { x: 72, y: 8, ch: "g" },
      // The Gargoyle Custode, hovering over the last stretch before the doors (the
      // staircase top is flat — no required jump under it, so the bot can sneak past
      // between dives).
      { x: 122, y: 4, ch: "G" },
      // Star power-up before the gauntlet — blow through chandelier 2 invincible.
      { x: 74, y: LANE, ch: "*" },
      ...arcCollectibles([6, 15, 26, 38, 44, 54, 68, 76, 86, 94], [AIR, LANE - 1]),
      // Goblets up the staircase.
      { x: 105, y: 9, ch: "o" },
      { x: 109, y: 8, ch: "o" },
      { x: 114, y: 7, ch: "o" },
      { x: 121, y: 7, ch: "o" },
    ],
  }),
};
