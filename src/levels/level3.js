// level3.js — "Tetti d'Oriente" (spec §4, Livello 3).
// Pure DATA: a tile map + a colour theme; the generic builder (build.js) renders it.
// New tile this level: "f" = a flying obstacle (ostacolo volante) that patrols the air.
//
// Tile legend:  "=" roof tile   "^" broken-tile spikes (hazard)   "o" lampada (collectible)
//               "f" ostacolo volante (flyer enemy)   "@" spawn   ">" goal   " " air/ravine

export const LEVEL_3 = {
  id: 3,
  name: "Tetti d'Oriente",
  tileSize: 64,

  // Tetti al tramonto: cielo viola/oro, pagode in lontananza (spec §4).
  theme: {
    decor: "rooftops", // background style (see game.js drawBackground)
    collectibleIcon: "🏮", // HUD icon for the lanterns (older emoji; renders on Win10)
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

  map: [
    "", // 0
    "", // 1
    "", // 2
    "", // 3
    "               o             o          ", // 4  high lanterns
    "               ==            ==         ", // 5  upper roof platforms
    "     f        o     f      o      f     ", // 6  flyers (air) + mid lanterns
    "    ===  o     ===   o      ===         ", // 7  roof platforms + lanterns
    "  @        ^                 ^        > ", // 8  spawn, broken-tile spikes, goal
    "============  ============  ============", // 9  rooftop floor (gaps = ravines)
    "============  ============  ============", // 10 rooftop floor
  ],
};
