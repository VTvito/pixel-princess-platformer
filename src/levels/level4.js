// level4.js — "Cime Innevate" (spec §4, Livello 4).
// Pure DATA: a tile map + a colour theme; the generic builder (build.js) renders it.
// New tile this level: "s" = a stalactite (stalattite) that hangs from the ceiling and
// periodically drops, then resets — a moving hazard.
//
// Tile legend:  "=" snow/ice   "^" ice spikes (hazard)   "o" cristallo (collectible)
//               "s" stalattite (falling hazard)   "@" spawn   ">" goal   " " air/ravine

export const LEVEL_4 = {
  id: 4,
  name: "Cime Innevate",
  tileSize: 64,

  // Vetta innevata: cielo pallido, picchi e neve che cade (spec §4).
  theme: {
    decor: "snow", // background style (see game.js drawBackground)
    collectibleIcon: "💎", // HUD icon for the crystals (older emoji; renders on Win10)
    hudText: [38, 50, 92], // HUD/banner text (deep blue — readable on the pale sky)
    bg: [182, 206, 230], // pale alpine sky
    bgBand: [226, 238, 250], // bright snow haze near the ground
    decoFar: [150, 178, 210], // distant peaks
    decoNear: [120, 150, 188], // nearer peaks
    solid: [158, 184, 206], // packed snow/ice platform
    solidTop: [240, 248, 255], // bright snow cap
    hazard: [120, 200, 225], // ice (stalactite / spikes)
    hazardTip: [205, 240, 250],
    collectible: [96, 214, 226], // crystal (cyan)
    collectibleAccent: [236, 255, 255],
    goal: [120, 220, 235], // icy light beam
  },

  map: [
    "", // 0
    "", // 1
    "", // 2
    "      s         s       s        s      ", // 3  stalactites hang from the ceiling
    "               o             o          ", // 4  high crystals
    "               ==            ==         ", // 5  upper ice platforms
    "     o              o                   ", // 6  mid crystals
    "    ===  o     ===   o      ===         ", // 7  ice platforms + crystals
    "  @                          ^        > ", // 8  spawn, ice spikes, goal
    "============  ============  ============", // 9  snowy floor (gaps = ravines)
    "============  ============  ============", // 10 snowy floor
  ],
};
