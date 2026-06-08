// config.js — single source of truth for tunables, palette, characters, and assets.
// Later prompts (levels, skins, controls) extend this file rather than scattering
// constants across the codebase.

// Virtual resolution. The canvas always renders at this fixed 16:9 landscape size and
// is scaled/letterboxed to fit the real viewport (see kaplayCtx.js + style.css).
export const GAME_W = 1280;
export const GAME_H = 720;

// Fairy-tale palette (RGB). Anna's piumino "carta da zucchero" drives the menu mood.
export const PALETTE = {
  sky: [167, 199, 231],        // azzurro/lilla — Anna's puffer jacket
  lilac: [199, 186, 232],
  cream: [255, 248, 240],
  gold: [212, 175, 55],        // royal gold accents
  deepBlue: [38, 50, 92],      // text / contrast
  rose: [231, 150, 173],
  shadow: [0, 0, 0],
};

// Start Screen character roster (spec §3). `sprite` is the asset key loaded in assets.js.
// Skins layer on top of these base looks as levels are cleared (future prompts).
export const CHARACTERS = [
  {
    id: "anna",
    name: "Anna",
    tagline: "La Protagonista",
    description: "Capelli castani mossi, piumino carta da zucchero, jeans e sneakers.",
    sprite: "anna",
    color: PALETTE.sky,
  },
  {
    id: "sognatrice",
    name: "La Sognatrice",
    tagline: "Stile paesana",
    description: "Romantica e gentile, ispirata a Belle e Ariel.",
    sprite: "sognatrice",
    color: [240, 198, 116],
  },
  {
    id: "avventuriera",
    name: "L'Avventuriera",
    tagline: "Stile nomade",
    description: "Coraggiosa viaggiatrice, ispirata a Jasmine e Mulan.",
    sprite: "avventuriera",
    color: [196, 122, 88],
  },
];

// Total playable levels before the finale (spec §4). Used for clamping currentLevel.
export const MAX_LEVEL = 5;

// Skin progression (spec §3) — clothing layers added on top of the base body as levels
// are cleared. `afterLevel` is the level whose completion unlocks the layer; the keys are
// sprite asset keys (see ASSETS.sprites). Order = paint order (skirt under … under crown).
export const SKINS = [
  { key: "skirt", name: "Gonna Reale", afterLevel: 1 },
  { key: "bodice", name: "Corpetto Elegante", afterLevel: 2 },
  { key: "necklace", name: "Collana di Gioielli", afterLevel: 3 },
  { key: "crown", name: "Corona Reale", afterLevel: 4 },
];

// Which skins are worn while playing a given level (derived from progress, not stored):
// on level N you've cleared 1..N-1, so you wear every skin whose afterLevel < N.
export const unlockedSkinKeys = (level) =>
  SKINS.filter((s) => s.afterLevel < level).map((s) => s.key);

// The skin a level's completion grants (for the reward screen). May be undefined.
export const skinUnlockedBy = (level) => SKINS.find((s) => s.afterLevel === level);

// Enemy tunables (spec §4). Crabs patrol horizontally on the ground; flyers (ostacoli
// volanti, Livello 3) patrol horizontally in the air with a gentle vertical bob. RANGE is
// the half-width of the ping-pong path around the spawn. Units: px and px/s.
export const ENEMIES = {
  CRAB_SPEED: 70,
  CRAB_RANGE: 120,
  FLY_SPEED: 95,
  FLY_RANGE: 150,
  FLY_BOB: 18,        // vertical bob amplitude (px)
  FLY_BOB_SPEED: 2.4, // bob cycles ~ rad/s
};

// Hazard tunables. Stalactites (stalattiti, Livello 4) hang from the ceiling and drop on a
// timer, then reset to the top — a moving hazard. Units: px, px/s², s.
export const HAZARDS = {
  STALACTITE_GRAVITY: 1500,
  STALACTITE_INTERVAL: 2.8, // max wait between drops (each gets a random phase up to this)
};

// Finale "Sala da Ballo" (spec §5) — the cinematic that closes the journey. This is the
// gift's emotional centerpiece: edit `message` freely (keep it bracket-free and stick to
// widely-shipped emoji like 👑 ✨ 💎 — newer ones render as tofu boxes on Win10).
export const FINALE = {
  heroineTitle: "Principessa Perfetta", // caption above the avatar
  title: "Per Anna", // message-box heading
  message:
    "Hai attraversato foreste incantate, abissi di corallo,\n" +
    "tetti d'oriente e cime innevate...\n" +
    "e a ogni passo sei diventata piu te stessa.\n\n" +
    "Buon viaggio, principessa.",
};

// Platformer tunables (spec §2). Centralised so entity/level code stays free of magic
// numbers and difficulty is easy to tweak. Units: px and px/s.
export const PHYSICS = {
  GRAVITY: 1800,    // base downward acceleration (px/s²)
  // Horizontal feel: instead of an instant on/off velocity, the player ramps a private vx
  // toward a target at ACCEL (turning/starting) or DECEL (releasing), with reduced control
  // in the air (AIR_ACCEL). This gives inertia/slide without changing the top speed.
  RUN_SPEED: 320,   // target horizontal run speed (px/s) — preserves the old MOVE_SPEED reach
  ACCEL: 2600,      // ground ramp toward the target (px/s²)
  DECEL: 3200,      // ground friction when no direction is held (px/s²)
  AIR_ACCEL: 1600,  // reduced air control (px/s²)
  // Vertical feel: a snappy hop with variable height (release early = lower) and a faster
  // fall than rise (asymmetric arc, Mario-style), plus small forgiveness windows.
  JUMP_FORCE: 730,  // initial upward velocity on jump (px/s); clears thorns + 2-cell ravines
  JUMP_CUT: 0.45,   // vel.y multiplier applied once if jump is released while still rising
  FALL_MULT: 1.6,   // extra gravity factor while descending (asymmetric arc)
  COYOTE_TIME: 0.1, // grace window (s) to still jump just after leaving a ledge
  JUMP_BUFFER: 0.1, // window (s) a jump press is remembered before landing
};

// Asset manifest — the swap point. Replace files in /assets and, if an extension
// changes, update the path here. Keys are stable so game code never hard-codes paths.
export const ASSETS = {
  sprites: {
    anna: "assets/sprites/anna.png",
    sognatrice: "assets/sprites/sognatrice.png",
    avventuriera: "assets/sprites/avventuriera.png",
    logo: "assets/sprites/logo.png",
    // Skin layers (spec §3) — same 64×96 transparent canvas, overlaid on the base body.
    skirt: "assets/sprites/skirt.png",
    bodice: "assets/sprites/bodice.png",
    necklace: "assets/sprites/necklace.png",
    crown: "assets/sprites/crown.png",
  },
  sounds: {
    // Background music, played on the Music bus (src/audio.js). Menu = gentle waltz,
    // gameplay = a softer, airier loop. The 🎵 toggle mutes these independently of SFX.
    "menu-bgm": "assets/audio/menu-bgm.wav",
    "game-bgm": "assets/audio/game-bgm.wav",
    // Gameplay SFX (spec §3/§4) — synthesized, played via src/sfx.js on the SFX bus so the
    // 🔊 toggle mutes them independently of the music. Swap the files keeping these keys.
    jump: "assets/audio/jump.wav",
    collect: "assets/audio/collect.wav",
    coin: "assets/audio/coin.wav",
    oops: "assets/audio/oops.wav",
    goal: "assets/audio/goal.wav",
    win: "assets/audio/win.wav",
    select: "assets/audio/select.wav",
  },
};
