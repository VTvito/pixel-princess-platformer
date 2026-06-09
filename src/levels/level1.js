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
// The map is ≈120 cells wide (≈6 screens) and 11 tall. The heroine's running lane (row 8)
// stays clear of overhead solids; the only floor is the bottom two rows, broken by jumpable
// 2-cell ravines. Collectibles float at rows 6–7 and are grabbed mid-jump; a few floating
// platforms hold bonus pickups above the lane (optional verticality — never on the critical
// left→right path). Hazards sit one-per-segment, well clear of ravine edges so a hazard-hop
// never overshoots into a gap (tuned for the snappy arc in config.PHYSICS). The map is built
// declaratively via mapkit.composeMap so the long layout stays correct-by-construction.

import { composeMap, arcCollectibles, LANE } from "./mapkit.js";

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
  },

  map: composeMap({
    width: 120,
    ravines: [{ x: 22, w: 2 }, { x: 46, w: 2 }, { x: 70, w: 2 }, { x: 94, w: 2 }],
    // Floating platforms that bridge three of the ravines at row 8 / LANE (top ≈ y512). They
    // sit one tile above the (missing) ground, where the lane has no floor — so they don't
    // block the heroine's head while running (she's ~92px tall). The ravine hop lands ON the
    // bridge with a generous margin (jump apex ≈ y428, well above the y512 top), then a bonus
    // apple waits just above. A raised, robust stepping-bridge — friendly for both human + bot.
    platforms: [
      { x: 46, y: LANE, w: 2 },
      { x: 70, y: LANE, w: 2 },
      { x: 94, y: LANE, w: 2 },
    ],
    items: [
      { x: 2, y: LANE, ch: "@" }, // spawn
      { x: 116, y: LANE, ch: ">" }, // goal
      // Thorns: one per ground segment, well clear of the ravine edges.
      { x: 12, y: LANE, ch: "^" },
      { x: 34, y: LANE, ch: "^" },
      { x: 58, y: LANE, ch: "^" },
      { x: 82, y: LANE, ch: "^" },
      { x: 106, y: LANE, ch: "^" },
      // Star power-up on the lane (grabbed while running): a taste of invincibility.
      { x: 40, y: LANE, ch: "*" },
      // Apples along the run + over the ravines (grabbed mid-jump). Rows 6–7 are above the
      // row-8 bridges, so nothing overwrites a platform cell.
      ...arcCollectibles([8, 16, 22, 30, 40, 46, 54, 62, 70, 78, 88, 94, 102, 110]),
      // Bonus apples just above the ravine bridges (row 5 ≈ y352): an easy grab once you've
      // hopped up onto the bridge — an optional reward, off the critical ground path.
      { x: 46, y: 5, ch: "o" },
      { x: 70, y: 5, ch: "o" },
      { x: 94, y: 5, ch: "o" },
    ],
  }),
};
