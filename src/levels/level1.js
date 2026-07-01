// level1.js — "Foresta Incantata" (Livello 1 — the tutorial).
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
//     trail of apples pays out the detour (off the critical path).
// Arcade: a single checkpoint at x49 banks the riskiest stretch (the airborne twist); a death
// costs a life + 500 Coccoline, and the level hands out one heart (+1 vita) on the develop run.

import { composeMap, arcCollectibles, laneFor, airFor } from "./mapkit.js";

// Taller map (vertical camera follow): 14 rows instead of 11 — extra sky for high routes.
const H = 14;
const LANE = laneFor(H);
const AIR = airFor(H);

export const LEVEL_1 = {
  id: 1,
  name: "Foresta Incantata",
  tileSize: 64,

  // Bosco magico: verde scuro, alberi alti.
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
      { x: 16, w: 2 }, // intro: an early warm-up gap (a second hop before the bigger one)
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
    // (The old stepping-bridge over the x46 ravine is gone: the develop gap is now a real
    // 2-cell jump — landing practice graduates to an actual leap, raising the floor.)
    // One-way high routes: the bonus perch (the spring at x29 launches her UP THROUGH it and
    // she lands on top — a solid slab here would block the bounce from below), the twist route
    // (launched onto by the spring at x52, carries her over both ravines), then the secret
    // CANOPY (spring at x72) with its apple trail.
    semisolids: [
      { x: 27, y: 7, w: 3 }, // bonus perch above the first spring (one-way, so the bounce lands)
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
      // Arcade: a SINGLE checkpoint, banked right before the airborne twist (the riskiest
      // stretch). The terraced climax that follows has no ravines, so a slip there is
      // survivable — it doesn't need its own flag anymore.
      { x: 49, y: LANE, ch: "F" },
      // Forest critters: a couple of ground crabs and a circling crow — the enchanted wood
      // isn't empty anymore. Placed on flat stretches, clear of jump arcs and the canopy drop.
      { x: 7, y: LANE, ch: "c" }, // greets her just past the spawn
      { x: 36, y: LANE, ch: "c" }, // patrols the develop flat (clear of the x29 spring + x42 thorn)
      { x: 64, y: LANE, ch: "c" }, // patrols before the canopy
      { x: 88, y: LANE, ch: "c" }, // guards the flat run-up before the terraced climax (clear of the canopy drop)
      { x: 110, y: 9, ch: "c" }, // a final guard on the flat summit, just before the goal
      { x: 32, y: AIR, ch: "f" }, // a crow over the develop stretch
      // Thorns: one per stretch, clear of ravine edges, spring landings and the canopy drop.
      { x: 12, y: LANE, ch: "^" },
      { x: 42, y: LANE, ch: "^" }, // moved off the x29 spring's (now higher) bounce landing
      { x: 76, y: LANE, ch: "^" },
      { x: 98, y: 10, ch: "^" }, // on the first terrace's surface
      // (No invincibility stars in the tutorial anymore — arcade difficulty: the develop
      // crabs/thorns and the airborne twist must be read and timed, not bulldozed.)
      // (No heart here anymore — only Livelli 3, 5 e 6 grant a +1 vita now, so lives are scarcer
      // across a run; the early levels lean on careful play instead of a banked extra life.)
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
      // The canopy's payout: an apple trail up in the leaves (the bonus high route).
      { x: 71, y: 6, ch: "o" },
      { x: 74, y: 6, ch: "o" },
      { x: 77, y: 6, ch: "o" },
      { x: 80, y: 6, ch: "o" },
    ],
  }),
};
