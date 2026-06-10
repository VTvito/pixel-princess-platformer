// level2.js — "Abissi di Corallo" (spec §4, Livello 2).
// Pure DATA: a tile map + a colour theme; the generic builder (build.js) renders it.
// Level identity: MOVING jellyfish platforms over wide gaps + an UPDRAFT shaft, with
// patrolling crabs between them. Legend: see build.js.
//
// Arc: intro (basics + a spring-served bonus reef) → develop (the first moving platform
// — wait for it, ride it) → twist (a second, faster mover + crab pressure) → climax
// (a current of rising water carries her up and over the last chasm).
// Secrets: a crumble ledge with pearls over the twist stretch, and a narrow updraft
// CHIMNEY continuing above the climax shaft up to a pearl ring on a one-way perch.

import { composeMap, arcCollectibles, laneFor, airFor } from "./mapkit.js";

// Taller map (vertical camera follow): 14 rows instead of 11 — extra sky for high routes.
const H = 14;
const LANE = laneFor(H);
const AIR = airFor(H);

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
    // Decor props menu (collider-free scenery; weights drive the procedural mix — build.js).
    props: [
      { key: "deco_coralfan", weight: 3 },
      { key: "deco_kelp", weight: 3 },
      { key: "deco_shell", weight: 2, fg: true },
    ],
  },

  // Authored decor: a reef garden at the spawn, kelp swaying around the goal.
  decor: [
    { x: 5, y: LANE, key: "deco_coralfan" },
    { x: 113, y: LANE, key: "deco_kelp" },
    { x: 118, y: LANE, key: "deco_kelp" },
  ],

  // Jellyfish platforms gliding over the two wide chasms. Ranges are tuned so the right
  // extreme lands flush on the far edge (ride on, walk off — no leap of faith).
  movers: [
    { x: 39, y: LANE, w: 2, dx: 2, period: 4 },
    { x: 71, y: LANE, w: 2, dx: 2, period: 3.6, phase: 2 },
  ],

  map: composeMap({
    width: 120,
    height: H,
    ravines: [
      { x: 20, w: 2 }, // intro: a plain jumpable gap
      { x: 40, w: 3 }, // develop: too wide to jump — ride the jellyfish
      { x: 72, w: 3 }, // twist: the second, off-phase jellyfish
      { x: 88, w: 3 }, // climax: the updraft shaft (the current carries her over)
    ],
    // Spring-served bonus reef (x24), plus the secret perch above the updraft chimney —
    // one-way, so the rising current carries her through it and she lands on top.
    semisolids: [
      { x: 24, y: 8, w: 5 },
      { x: 86, y: 3, w: 8 }, // the chimney perch, ringed with pearls
    ],
    items: [
      { x: 2, y: LANE, ch: "@" },
      { x: 116, y: LANE, ch: ">" },
      // The updraft: a column of rising water filling the climax shaft…
      ...[88, 89, 90].flatMap((x) => [8, 9, 10, 11, 12].map((y) => ({ x, y, ch: "w" }))),
      // …continuing up as a narrow secret chimney to the perch above.
      ...[4, 5, 6, 7].map((y) => ({ x: 89, y, ch: "w" })),
      { x: 26, y: LANE, ch: "M" }, // spring up to the bonus reef
      // Checkpoints: after the first ride, before the second ride, before the shaft.
      // (Placed with clean run-up ahead — a respawn right before a hazard or onto the
      // spring's forced bounce turns one unlucky death into a loop.)
      { x: 46, y: LANE, ch: "F" },
      { x: 68, y: LANE, ch: "F" },
      { x: 84, y: LANE, ch: "F" },
      // Urchins on the lane, clear of gap edges and crab patrols.
      { x: 14, y: LANE, ch: "^" },
      { x: 34, y: LANE, ch: "^" },
      { x: 60, y: LANE, ch: "^" },
      { x: 104, y: LANE, ch: "^" },
      // Crabs patrolling the stretches between set-pieces.
      { x: 30, y: LANE, ch: "c" },
      { x: 52, y: LANE, ch: "c" },
      { x: 76, y: LANE, ch: "c" },
      { x: 100, y: LANE, ch: "c" },
      // Star power-up mid-level — plough through the twist's crab pressure.
      { x: 64, y: LANE, ch: "*" },
      ...arcCollectibles([8, 16, 21, 32, 44, 50, 58, 66, 78, 86, 96, 102, 110], [AIR, LANE - 1]),
      // Crumble ledge: a quick risky hop over the twist stretch pays out two pearls.
      { x: 62, y: 9, ch: "!" },
      { x: 63, y: 9, ch: "!" },
      { x: 64, y: 9, ch: "!" },
      { x: 65, y: 9, ch: "!" },
      { x: 63, y: 8, ch: "o" },
      { x: 65, y: 8, ch: "o" },
      // Bonus pearls: the spring reef, over each jellyfish ride, inside the updraft.
      { x: 25, y: 7, ch: "o" },
      { x: 26, y: 7, ch: "o" },
      { x: 27, y: 7, ch: "o" },
      { x: 41, y: 8, ch: "o" },
      { x: 73, y: 8, ch: "o" },
      { x: 89, y: 9, ch: "o" },
      { x: 89, y: 7, ch: "o" },
      // The pearl ring crowning the secret chimney perch.
      { x: 87, y: 2, ch: "o" },
      { x: 89, y: 1, ch: "o" },
      { x: 91, y: 2, ch: "o" },
      { x: 93, y: 2, ch: "o" },
    ],
  }),
};
