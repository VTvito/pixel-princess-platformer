// level1.js — "Foresta Incantata" (spec §4, Livello 1 — the tutorial).
// Pure DATA: a tile map + a colour theme. The generic builder in build.js turns this
// into game objects. Legend: see build.js.
//
// Arc (intro → develop → twist → climax):
//   • intro (x0–25): flat run, first thorn, first ravine — the basics;
//   • develop (x26–50): the SPRING is introduced under a visible bonus perch, then a
//     bridged ravine and the star; a checkpoint banks the progress;
//   • twist (x51–63): a spring launches the heroine onto a one-way high route that
//     carries her over a double ravine (the critical path itself goes airborne);
//   • climax (x86–119): a terraced climb (1 then 2 cells) to a goal with a view.
//   • secret (x68–81): a spring lifts her onto a CANOPY semisolid above the lane — a
//     trail of apples and a second star pay out the detour (off the bot's critical path).
// Checkpoints at x49, x68 and x88 keep retries kind — deaths still cost 500 Coccoline.

import { composeMap, arcCollectibles, laneFor, airFor } from "./mapkit.js";

// Taller map (vertical camera follow): 14 rows instead of 11 — extra sky for high routes.
const H = 14;
const LANE = laneFor(H);
const AIR = airFor(H);

export const LEVEL_1 = {
  id: 1,
  name: "Foresta Incantata",
  tileSize: 64,

  // Bosco magico: verde scuro, alberi alti (spec §4).
  theme: {
    decor: "forest", // background style (see game.js drawBackground)
    collectibleIcon: "🍎", // HUD icon for the golden apples
    collectibleSprite: "apple", // world sprite for the pickup (src/levels/build.js)
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
    // Decor props menu (collider-free scenery; weights drive the procedural mix — build.js).
    props: [
      { key: "deco_tree", weight: 2 },
      { key: "deco_fern", weight: 3, fg: true },
      { key: "deco_mushroom", weight: 3, fg: true },
    ],
  },

  // Authored decor: trees framing the journey's start and the summit goal.
  decor: [
    { x: 5, y: LANE, key: "deco_tree" },
    { x: 113, y: 9, key: "deco_tree" },
    { x: 119, y: 9, key: "deco_tree" },
  ],

  map: composeMap({
    width: 120,
    height: H,
    ravines: [
      { x: 22, w: 2 }, // intro: one clean, jumpable gap
      { x: 46, w: 2 }, // develop: bridged at the lane (landing practice)
      { x: 58, w: 2 }, // twist: double gap crossed on the high route
      { x: 62, w: 2 },
    ],
    // Climax: the ground itself rises — a one-cell step, then a two-cell summit.
    terraces: [
      { x: 94, w: 8, h: 1 },
      { x: 102, w: 18, h: 2 },
    ],
    platforms: [
      { x: 46, y: LANE, w: 2 }, // stepping-bridge over the develop ravine
      { x: 27, y: 7, w: 3 }, // bonus perch above the first spring
    ],
    // One-way high routes: the twist route (launched onto by the spring at x52, carries
    // her over both ravines), then the secret CANOPY (spring at x72) with its apple trail.
    semisolids: [
      { x: 52, y: 7, w: 10 },
      { x: 70, y: 7, w: 12 }, // the canopy — drops back to the lane at x82
    ],
    items: [
      { x: 2, y: LANE, ch: "@" }, // spawn
      { x: 117, y: 9, ch: ">" }, // goal on the summit terrace (walk row 9)
      // Springs: the bonus one (perch above), the critical-path launcher, the canopy lift.
      { x: 29, y: LANE, ch: "M" },
      { x: 52, y: LANE, ch: "M" },
      { x: 72, y: LANE, ch: "M" },
      // Checkpoints: before the twist, before the canopy, before the climb.
      { x: 49, y: LANE, ch: "F" },
      { x: 68, y: LANE, ch: "F" },
      { x: 88, y: LANE, ch: "F" },
      // Thorns: one per stretch, clear of ravine edges, spring landings and the canopy drop.
      { x: 12, y: LANE, ch: "^" },
      { x: 36, y: LANE, ch: "^" },
      { x: 76, y: LANE, ch: "^" },
      { x: 98, y: 10, ch: "^" }, // on the first terrace's surface
      // Star power-up on the lane: a taste of invincibility before the twist.
      { x: 40, y: LANE, ch: "*" },
      // Apples along the run (rows 9–10, grabbed mid-jump).
      ...arcCollectibles([8, 16, 23, 32, 44, 64, 86], [AIR, LANE - 1]),
      // Bonus apples: the spring perch, the high route, and the climb.
      { x: 27, y: 6, ch: "o" },
      { x: 28, y: 6, ch: "o" },
      { x: 29, y: 6, ch: "o" },
      { x: 55, y: 6, ch: "o" },
      { x: 57, y: 6, ch: "o" },
      { x: 59, y: 6, ch: "o" },
      { x: 97, y: 9, ch: "o" },
      { x: 100, y: 9, ch: "o" },
      { x: 106, y: 8, ch: "o" },
      { x: 110, y: 8, ch: "o" },
      { x: 114, y: 8, ch: "o" },
      // The canopy's payout: an apple trail and a second star up in the leaves.
      { x: 71, y: 6, ch: "o" },
      { x: 74, y: 6, ch: "o" },
      { x: 77, y: 6, ch: "o" },
      { x: 80, y: 6, ch: "o" },
      { x: 75, y: 5, ch: "*" },
    ],
  }),
};
