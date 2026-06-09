// level3.js — "Tetti d'Oriente" (spec §4, Livello 3).
// Pure DATA: a tile map + a colour theme; the generic builder (build.js) renders it.
// New tile this level: "f" = a flying obstacle (ostacolo volante) that patrols the air.
//
// Tile legend:  "=" roof tile   "^" broken-tile spikes (hazard)   "o" lampada (collectible)
//               "f" ostacolo volante (flyer enemy)   "@" spawn   ">" goal   " " air/ravine

import { composeMap, arcCollectibles, LANE, AIR } from "./mapkit.js";

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
  },

  // ≈120 cells wide. Rooftop floor with jumpable ravines and broken-tile spikes (^). Flyers
  // (f) patrol the open mid-air (row AIR) over FLAT stretches — never above a ravine or spike,
  // so the bot runs underneath without being forced to jump into one. Lanterns float along.
  map: composeMap({
    width: 120,
    ravines: [{ x: 22, w: 2 }, { x: 46, w: 2 }, { x: 70, w: 2 }, { x: 94, w: 2 }],
    // Floating bridges over three ravines (row 8 / LANE) so the bonus lanterns above are
    // reachable (see level1.js for the geometry); clear of the flyers' flat patrol stretches.
    platforms: [
      { x: 46, y: LANE, w: 2 },
      { x: 70, y: LANE, w: 2 },
      { x: 94, y: LANE, w: 2 },
    ],
    items: [
      { x: 2, y: LANE, ch: "@" },
      { x: 116, y: LANE, ch: ">" },
      // Lane spikes, well clear of ravine edges.
      { x: 12, y: LANE, ch: "^" },
      { x: 58, y: LANE, ch: "^" },
      { x: 106, y: LANE, ch: "^" },
      // Flyers over flat ground (no spike/ravine beneath) so running under them is safe.
      { x: 34, y: AIR, ch: "f" },
      { x: 82, y: AIR, ch: "f" },
      // Star power-up before the first flyer.
      { x: 28, y: LANE, ch: "*" },
      ...arcCollectibles([8, 16, 24, 30, 40, 48, 54, 64, 72, 78, 88, 96, 102, 112]),
      // Bonus lanterns above the ravine bridges (row 5).
      { x: 46, y: 5, ch: "o" },
      { x: 70, y: 5, ch: "o" },
      { x: 94, y: 5, ch: "o" },
    ],
  }),
};
