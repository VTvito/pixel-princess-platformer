// level3.js — "Tetti d'Oriente" (spec §4, Livello 3).
// Pure DATA: a tile map + a colour theme; the generic builder (build.js) renders it.
// Level identity: TERRACED rooftops to climb, lantern-ghost SWOOPERS that dive at her,
// and a climactic CRUMBLING ridge run. Legend: see build.js.
//
// Arc: intro (flat street, one crow overhead) → develop (up and over two roof terraces)
// → twist (swoopers guard the alley between gaps) → climax (a 3-step staircase onto a
// long crumbling ridge — keep running, it falls behind you; falling out is survivable,
// the street below is safe).
// Secret: a one-way RIDGELINE over the swooper alley (reached from the second roof via a
// floating slab), strung with lanterns and guarded by its own swooper.

import { composeMap, arcCollectibles, laneFor, airFor } from "./mapkit.js";

// Taller map (vertical camera follow): 14 rows instead of 11 — extra sky for high routes.
const H = 14;
const LANE = laneFor(H);
const AIR = airFor(H);

export const LEVEL_3 = {
  id: 3,
  name: "Tetti d'Oriente",
  tileSize: 64,

  // Tetti al tramonto: cielo viola/oro, pagode in lontananza (spec §4).
  theme: {
    decor: "rooftops", // background style (see game.js drawBackground)
    collectibleIcon: "🏮", // HUD icon for the lanterns (older emoji; renders on Win10)
    collectibleSprite: "lantern", // world sprite for the pickup (src/levels/build.js)
    hudText: [255, 245, 230], // HUD/banner text (warm cream over the dusk sky)
    bg: [58, 28, 64], // dusk purple sky
    bgBand: [150, 70, 78], // warm horizon glow near the rooftops
    decoFar: [42, 26, 50], // distant pagoda roofs
    decoNear: [28, 18, 36], // nearer roofs
    parallaxFar: [86, 50, 90], // distant dusk mountains (parallax far)
    parallaxNear: [120, 58, 76], // nearer dusk ridge (parallax near)
    mote: [255, 198, 120], // drifting dusk fireflies/embers (ambient particles)
    solid: [92, 42, 48], // terracotta roof tile
    solidTop: [196, 120, 70], // sunlit roof ridge
    hazard: [60, 50, 58], // broken-tile spikes
    hazardTip: [120, 110, 122],
    collectible: [255, 196, 84], // glowing paper lantern
    collectibleAccent: [255, 240, 180],
    collectibleGlow: [255, 180, 90], // warm lantern aura (juiciness)
    enemy: [44, 40, 60], // crow body
    enemyAccent: [22, 20, 34], // crow wings
    goal: [255, 210, 120], // warm lantern-light beam
    // Decor props menu (collider-free scenery; weights drive the procedural mix — build.js).
    props: [
      { key: "deco_chimney", weight: 3 },
      { key: "deco_banner", weight: 2 },
      { key: "deco_lanternpost", weight: 2 },
    ],
  },

  // Authored decor: lantern posts lighting each checkpoint, a festival banner at the goal.
  decor: [
    { x: 44, y: LANE, key: "deco_lanternpost" },
    { x: 76, y: LANE, key: "deco_lanternpost" },
    { x: 113, y: LANE, key: "deco_banner" },
  ],

  map: composeMap({
    width: 120,
    height: H,
    ravines: [
      { x: 34, w: 2 }, // between the two roof terraces
      { x: 62, w: 2 }, // in the swooper alley
    ],
    // Develop: two roofs to climb (1 then 2 cells). Climax: a 3-step staircase up to the
    // high ridge that the crumbling run continues from.
    terraces: [
      { x: 22, w: 8, h: 1 },
      { x: 38, w: 6, h: 2 },
      { x: 80, w: 4, h: 1 },
      { x: 84, w: 4, h: 2 },
      { x: 88, w: 6, h: 3 },
    ],
    // The stepping slab from the second roof up to the secret ridgeline.
    platforms: [{ x: 45, y: 8, w: 1 }],
    // The ridgeline itself: one-way, strung over the swooper alley, exits at x64.
    semisolids: [{ x: 47, y: 6, w: 18 }],
    items: [
      { x: 2, y: LANE, ch: "@" },
      { x: 116, y: LANE, ch: ">" },
      // The crumbling ridge: flush with the high terrace's surface — keep running.
      ...Array.from({ length: 12 }, (_, i) => ({ x: 94 + i, y: 9, ch: "!" })),
      // A classic crow over the flat intro street.
      { x: 18, y: AIR, ch: "f" },
      // Lantern-ghosts guarding the twist alley (they dive when she comes close).
      { x: 54, y: 8, ch: "g" },
      { x: 68, y: 8, ch: "g" },
      // …and one patrolling above the secret ridgeline (high enough to hover clear of a
      // walker's head — it only threatens during its dives). Kept BETWEEN the two alley
      // swoopers' columns: an air enemy overhead vetoes the bot's hop exactly where the
      // alley dives demand one.
      { x: 61, y: 3, ch: "g" },
      // Checkpoints: end of the first roof (past its spike — a respawn right before a
      // hazard leaves no run-up to clear it), before the alley, before the staircase.
      { x: 28, y: 10, ch: "F" },
      { x: 46, y: LANE, ch: "F" },
      { x: 78, y: LANE, ch: "F" },
      // Broken-tile spikes: street, both roofs, and the post-ridge landing zone.
      { x: 12, y: LANE, ch: "^" },
      { x: 26, y: 10, ch: "^" }, // on the first roof's surface
      { x: 43, y: 9, ch: "^" }, // on the second roof's edge — room to accelerate after the climb
      { x: 58, y: LANE, ch: "^" },
      { x: 112, y: LANE, ch: "^" },
      // Star power-up right after the first checkpoint — brave the alley invincible.
      { x: 49, y: LANE, ch: "*" },
      ...arcCollectibles([6, 14, 20, 31, 42, 52, 66, 74, 86, 107, 114], [AIR, LANE - 1]),
      // Lanterns strung along the secret ridgeline.
      { x: 50, y: 5, ch: "o" },
      { x: 54, y: 5, ch: "o" },
      { x: 58, y: 5, ch: "o" },
      { x: 62, y: 5, ch: "o" },
      // Bonus lanterns: the high ridge route pays out for keeping your nerve.
      { x: 90, y: 7, ch: "o" },
      { x: 92, y: 7, ch: "o" },
      { x: 96, y: 8, ch: "o" },
      { x: 100, y: 8, ch: "o" },
      { x: 104, y: 8, ch: "o" },
    ],
  }),
};
