// level4.js — "Cime Innevate" (spec §4, Livello 4).
// Pure DATA: a tile map + a colour theme; the generic builder (build.js) renders it.
// New tile this level: "s" = a stalactite (stalattite) that hangs from the ceiling and
// periodically drops, then resets — a moving hazard.
//
// Tile legend:  "=" snow/ice   "^" ice spikes (hazard)   "o" cristallo (collectible)
//               "s" stalattite (falling hazard)   "@" spawn   ">" goal   " " air/ravine

import { composeMap, arcCollectibles, LANE } from "./mapkit.js";

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
  },

  // ≈120 cells wide. Snowy floor with jumpable ravines; the hazard is the dropping stalactites
  // (s) that hang from the ceiling (row 3) over the lane and fall on a timer — the bot waits in
  // the clear, then proceeds. Each sits mid-segment (over solid ground, not a ravine) so the
  // wait happens on firm footing. Crystals float along the arc.
  map: composeMap({
    width: 120,
    ravines: [{ x: 22, w: 2 }, { x: 46, w: 2 }, { x: 70, w: 2 }, { x: 94, w: 2 }],
    // Floating bridges over two ravines (row 8 / LANE) so the bonus crystals above are
    // reachable (see level1.js for the geometry); clear of the stalactite columns.
    platforms: [
      { x: 46, y: LANE, w: 2 },
      { x: 70, y: LANE, w: 2 },
    ],
    items: [
      { x: 2, y: LANE, ch: "@" },
      { x: 116, y: LANE, ch: ">" },
      // Stalactites hang over mid-segment columns (clear of ravines).
      { x: 14, y: 3, ch: "s" },
      { x: 36, y: 3, ch: "s" },
      { x: 60, y: 3, ch: "s" },
      { x: 84, y: 3, ch: "s" },
      { x: 108, y: 3, ch: "s" },
      // Star power-up early on — shrug off a couple of stalactite drops.
      { x: 26, y: LANE, ch: "*" },
      ...arcCollectibles([8, 18, 28, 38, 50, 62, 74, 86, 98, 110]),
      // Bonus crystals above the ravine bridges (row 5).
      { x: 46, y: 5, ch: "o" },
      { x: 70, y: 5, ch: "o" },
    ],
  }),
};
