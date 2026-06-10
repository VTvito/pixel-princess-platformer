// level4.js — "Cime Innevate" (spec §4, Livello 4 — the final climb).
// Pure DATA: a tile map + a colour theme; the generic builder (build.js) renders it.
// Level identity: ICY handling (a longer accel ramp via def.feel — she slides into and
// out of her run), territorial snowball ROLLERS, dropping stalactites, and a climactic
// double moving-platform crossing under falling ice. Legend: see build.js.
//
// Arc: intro (sliding basics + a stalactite) → develop (snow terraces + a roller guards
// the long shelf) → twist (stalactite timing on ice) → climax (two off-phase movers
// over the great chasm, stalactites falling between them).
// Secret: an icy SHELF floating over the ridge, where a second roller guards a hoard of
// crystals — reached by a stepping slab from the ridge top.

import { composeMap, arcCollectibles, laneFor, airFor } from "./mapkit.js";

// Taller map (vertical camera follow): 14 rows instead of 11 — extra sky for high routes.
const H = 14;
const LANE = laneFor(H);
const AIR = airFor(H);

export const LEVEL_4 = {
  id: 4,
  name: "Cime Innevate",
  tileSize: 64,

  // Vetta innevata: cielo pallido, picchi e neve che cade (spec §4).
  theme: {
    decor: "snow", // background style (see game.js drawBackground)
    collectibleIcon: "💎", // HUD icon for the crystals (older emoji; renders on Win10)
    collectibleSprite: "crystal", // world sprite for the pickup (src/levels/build.js)
    hudText: [38, 50, 92], // HUD/banner text (deep blue — readable on the pale sky)
    bg: [182, 206, 230], // pale alpine sky
    bgBand: [226, 238, 250], // bright snow haze near the ground
    decoFar: [150, 178, 210], // distant peaks
    decoNear: [120, 150, 188], // nearer peaks
    parallaxFar: [150, 172, 206], // distant ranges (parallax far)
    parallaxNear: [124, 150, 190], // nearer ranges (parallax near)
    solid: [158, 184, 206], // packed snow/ice platform
    solidTop: [240, 248, 255], // bright snow cap
    hazard: [120, 200, 225], // ice (stalactite / spikes)
    hazardTip: [205, 240, 250],
    collectible: [96, 214, 226], // crystal (cyan)
    collectibleAccent: [236, 255, 255],
    collectibleGlow: [200, 245, 255], // pale icy aura behind the crystal (juiciness)
    goal: [120, 220, 235], // icy light beam
    // Decor props menu (collider-free scenery; weights drive the procedural mix — build.js).
    props: [
      { key: "deco_pine", weight: 2 },
      { key: "deco_snowdrift", weight: 3, fg: true },
      { key: "deco_crystal_big", weight: 2 },
    ],
  },

  // Authored decor: pines bracketing the climb, a crystal cluster on the high ridge.
  decor: [
    { x: 5, y: LANE, key: "deco_pine" },
    { x: 69, y: 9, key: "deco_crystal_big" },
    { x: 113, y: LANE, key: "deco_pine" },
  ],

  // Icy handling: a noticeably longer accel ramp — she slides into and out of her run.
  feel: { accelTime: 0.2 },

  // The climax: two ice floes gliding out of phase over the great chasm (cells 104–109).
  // Ranges land flush on both edges; the transfer happens mid-gap where they overlap.
  movers: [
    { x: 103, y: LANE, w: 2, dx: 2, period: 3.8 },
    { x: 108, y: LANE, w: 2, dx: 2, period: 3.8, phase: 3 },
  ],

  map: composeMap({
    width: 120,
    height: H,
    ravines: [
      { x: 16, w: 2 }, // intro: first gap on ice
      { x: 52, w: 2 }, // twist: gap between stalactite columns
      { x: 104, w: 6 }, // climax: the great chasm — movers only
    ],
    // Snow terraces: a shelf to climb, then a two-step ridge before the descent.
    terraces: [
      { x: 30, w: 6, h: 1 },
      { x: 58, w: 4, h: 1 },
      { x: 62, w: 8, h: 2 },
    ],
    // The secret icy shelf over the ridge, served by a stepping slab from the ridge top.
    platforms: [
      { x: 58, y: 8, w: 1 },
      { x: 61, y: 6, w: 8 },
    ],
    items: [
      { x: 2, y: LANE, ch: "@" },
      { x: 116, y: LANE, ch: ">" },
      // Stalactites: spaced for waiting practice, then clustered over the chasm.
      { x: 14, y: 6, ch: "s" },
      { x: 44, y: 6, ch: "s" },
      { x: 74, y: 6, ch: "s" },
      { x: 96, y: 6, ch: "s" },
      // Over the chasm EDGES (not the mid-transfer points): the wait spots stay safe and
      // the drops telegraph the crossing instead of sniping a committed rider.
      { x: 104, y: 6, ch: "s" },
      { x: 109, y: 6, ch: "s" },
      // Rollers: one guards the long shelf before the climax, one prowls the secret
      // shelf's crystal hoard (territorial: ±4 cells).
      { x: 84, y: LANE, ch: "r" },
      { x: 65, y: 5, ch: "r" },
      // Checkpoints: after the intro ice, mid-level, and right before the great chasm.
      { x: 26, y: LANE, ch: "F" },
      { x: 46, y: LANE, ch: "F" },
      { x: 100, y: LANE, ch: "F" },
      // Ice spikes on the lane.
      { x: 22, y: LANE, ch: "^" },
      { x: 35, y: 10, ch: "^" }, // on the first terrace's edge — room to accelerate on ice
      { x: 92, y: LANE, ch: "^" },
      // Star power-up before the ridge — shrug off a stalactite or the roller.
      { x: 54, y: LANE, ch: "*" },
      ...arcCollectibles([6, 12, 20, 42, 50, 56, 78, 88, 102], [AIR, LANE - 1]),
      // The crystal hoard on the secret shelf.
      { x: 62, y: 5, ch: "o" },
      { x: 64, y: 5, ch: "o" },
      { x: 67, y: 5, ch: "o" },
      // Bonus crystals: above the ridge and over the chasm crossing.
      { x: 64, y: 8, ch: "o" },
      { x: 67, y: 8, ch: "o" },
      { x: 106, y: 9, ch: "o" },
      { x: 109, y: 9, ch: "o" },
    ],
  }),
};
