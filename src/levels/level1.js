// level1.js — "Foresta Incantata" (spec §4, Livello 1).
// Pure DATA: a tile map + a colour theme. The generic builder in build.js turns this
// into game objects, so adding levels 2–4 later means adding sibling files like this one
// — no new rendering/collision code.
//
// Tile legend (one char per 64px cell):
//   "="  solid platform / ground (static collider)
//   "^"  rovi spinosi (thorns) — hazard; touching it respawns the player
//   "o"  Mela d'oro (golden apple) — collectible
//   "@"  player spawn point
//   ">"  level goal (end-of-level marker)
//   " "  empty air  (a "burrone"/ravine is just a gap in the ground rows)
//
// The map is 40 cells wide (≈2 screens) and 11 tall (≈one screen high). Layout is tuned
// for the casual jump arc in config.PHYSICS: 2-cell ravines and one-tile climbs are all
// comfortably reachable; the two highest apples need a short stair-step via a platform.

export const LEVEL_1 = {
  id: 1,
  name: "Foresta Incantata",
  tileSize: 64,

  // Bosco magico: verde scuro, alberi alti (spec §4).
  theme: {
    decor: "forest", // background style (see game.js drawBackground)
    collectibleIcon: "🍎", // HUD icon for the golden apples
    bg: [20, 44, 38], // deep forest backdrop
    bgBand: [30, 62, 52], // lighter haze near the ground
    decoFar: [27, 56, 47], // distant tree silhouettes
    decoNear: [22, 49, 41], // nearer tree silhouettes
    parallaxFar: [34, 66, 54], // distant misty hills (parallax far layer)
    parallaxNear: [50, 90, 66], // nearer rolling hills (parallax near layer)
    mote: [206, 230, 150], // floating fireflies / pollen (enchanted-forest ambience)
    solid: [74, 104, 60], // mossy earth/platform fill
    solidTop: [122, 178, 94], // bright grassy top accent
    hazard: [122, 38, 58], // bramble body
    hazardTip: [170, 62, 84], // bramble spikes
    collectible: [212, 175, 55], // golden apple
    collectibleAccent: [255, 240, 200], // apple highlight
    collectibleGlow: [255, 236, 170], // warm aura behind the apple (juiciness)
    leaf: [126, 178, 96], // apple leaf (forest only)
  },

  map: [
    "", // 0
    "", // 1
    "", // 2
    "", // 3
    "               o              o         ", // 4  high apples
    "               ==             ==        ", // 5  upper platforms (stair step)
    "     o               o                  ", // 6  mid apples
    "    ===  o     ===      o     ===       ", // 7  reachable platforms + apples
    "  @    ^          ^^             ^    > ", // 8  spawn, thorns, goal
    "============  ============  ============", // 9  ground (gaps = ravines)
    "============  ============  ============", // 10 ground
  ],
};
