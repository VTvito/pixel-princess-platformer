// level2.js — "Abissi di Corallo" (spec §4, Livello 2).
// Same data-driven shape as level1.js; the generic builder (build.js) renders it.
// New tile this level: "c" = a crab enemy that patrols horizontally.
//
// Tile legend:  "=" coral rock   "^" riccio di mare (urchin, hazard)   "o" perla
//               "c" granchio (crab enemy)   "@" spawn   ">" goal   " " water/ravine

import { composeMap, arcCollectibles, LANE } from "./mapkit.js";

export const LEVEL_2 = {
  id: 2,
  name: "Abissi di Corallo",
  tileSize: 64,

  // Sottomarino: bolle, blu e corallo (spec §4).
  theme: {
    decor: "coral", // background style (see game.js drawBackground)
    collectibleIcon: "🐚", // HUD icon for the pearls (older emoji; 🫧 is tofu on Win10)
    collectibleSprite: "pearl", // world sprite for the pickup (src/levels/build.js)
    bg: [10, 34, 70], // deep water
    bgBand: [20, 52, 96], // lighter water near the seabed
    decoFar: [190, 100, 110], // distant coral silhouettes
    decoNear: [150, 78, 92], // nearer coral silhouettes
    parallaxFar: [78, 70, 120], // distant reef ridge (indigo, parallax far)
    parallaxNear: [42, 86, 118], // nearer reef mound (teal, parallax near)
    solid: [54, 92, 116], // coral rock platform fill
    solidTop: [98, 150, 168], // lighter rocky rim
    hazard: [80, 40, 110], // sea urchin body
    hazardTip: [150, 90, 190], // urchin spikes
    collectible: [235, 240, 250], // pearl
    collectibleAccent: [255, 255, 255], // pearl highlight
    collectibleGlow: [130, 225, 235], // aqua shimmer behind the pearl (juiciness)
    enemy: [206, 70, 60], // crab shell
    enemyAccent: [232, 120, 104], // crab claws
    goal: [120, 220, 230], // aqua light beam
  },

  // ≈120 cells wide. Coral floor broken by jumpable ravines; urchins (^) on the lane and
  // patrolling crabs (c) between them, each well clear of the ravine edges. Pearls float along
  // the arc with a few higher ones for an optional bigger hop. Built via mapkit.composeMap.
  map: composeMap({
    width: 120,
    ravines: [{ x: 22, w: 2 }, { x: 46, w: 2 }, { x: 70, w: 2 }, { x: 94, w: 2 }],
    // Floating bridges over three ravines (row 8 / LANE) so the bonus pearls above are
    // reachable; a robust hop, off the running head's path (see level1.js for the geometry).
    platforms: [
      { x: 46, y: LANE, w: 2 },
      { x: 70, y: LANE, w: 2 },
      { x: 94, y: LANE, w: 2 },
    ],
    items: [
      { x: 2, y: LANE, ch: "@" },
      { x: 116, y: LANE, ch: ">" },
      // Urchins (static spikes) + crabs (patrolling), spaced clear of ravines and each other.
      { x: 12, y: LANE, ch: "^" },
      { x: 34, y: LANE, ch: "c" },
      { x: 58, y: LANE, ch: "^" },
      { x: 82, y: LANE, ch: "c" },
      { x: 106, y: LANE, ch: "^" },
      // Star power-up before the first crab — plough straight through the patrol.
      { x: 28, y: LANE, ch: "*" },
      ...arcCollectibles([8, 16, 24, 30, 40, 48, 54, 64, 72, 78, 88, 96, 102, 112]),
      // Bonus pearls above the ravine bridges (row 5), grabbed with a hop up.
      { x: 46, y: 5, ch: "o" },
      { x: 70, y: 5, ch: "o" },
      { x: 94, y: 5, ch: "o" },
    ],
  }),
};
