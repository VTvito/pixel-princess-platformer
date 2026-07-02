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

// Start Screen character roster. `sprite` is the asset key loaded in assets.js.
// Skins layer on top of these base looks as levels are cleared (future prompts).
export const CHARACTERS = [
  {
    id: "anna",
    name: "Anna",
    tagline: "La Protagonista",
    // Romantic one-liner shown on the selection card (keep it short + bracket-free — k.text
    // crashes on tokens like [x]). Edit freely.
    description: "Dolce e coraggiosa, conquista ogni cuore al primo sguardo.",
    sprite: "anna",
    color: PALETTE.sky,
  },
  {
    // Nome-concetto ORIGINALE (non un personaggio Disney): evita problemi di marchio essendo il
    // gioco pubblico. id + sprite restano "sognatrice" (compatibilità localStorage + asset).
    id: "sognatrice",
    name: "Sognatrice",
    tagline: "Anima Gentile",
    description: "Sogna l'amore vero tra le rose del castello incantato.",
    sprite: "sognatrice",
    color: [240, 198, 116],
  },
  {
    // Nome-concetto ORIGINALE (non un personaggio Disney). id + sprite restano "avventuriera";
    // palette terracotta del deserto, spirito libero.
    id: "avventuriera",
    name: "Avventuriera",
    tagline: "Spirito Libero",
    description: "Il suo cuore libero corre dove la porta il vento del deserto.",
    sprite: "avventuriera",
    color: [196, 122, 88],
  },
];

// Total playable levels before the finale. Used for clamping currentLevel.
export const MAX_LEVEL = 7;

// Arcade lives (Fase Arcade). The journey is now a "partita": you start with START lives,
// every level hands you one heart (+1 life, capped at MAX), and a death costs a life (plus the
// 500-Coccoline bill — the gag is sacred). Run out of lives → Game Over → restart from level 1
// with the score wiped, but the Coccoline tab keeps growing across attempts (see src/state.js).
export const LIVES = {
  START: 3, // lives at the start of a fresh run
  MAX: 9,   // ceiling so a hoard of hearts can't trivialise the run
};

// Skin progression — clothing layers added on top of the base body as levels
// are cleared. `afterLevel` is the level whose completion unlocks the layer; the keys are
// sprite asset keys (see ASSETS.sprites). Order = paint order (skirt under … under crown).
export const SKINS = [
  { key: "skirt", name: "Gonna Reale", afterLevel: 1 },
  { key: "bodice", name: "Corpetto Elegante", afterLevel: 2 },
  { key: "necklace", name: "Collana di Gioielli", afterLevel: 3 },
  { key: "crown", name: "Corona Reale", afterLevel: 4 },
  { key: "gloves", name: "Guanti di Seta", afterLevel: 5 },
  { key: "cape", name: "Mantello Reale", afterLevel: 6 },
];

// Which skins are worn while playing a given level (derived from progress, not stored):
// on level N you've cleared 1..N-1, so you wear every skin whose afterLevel < N.
export const unlockedSkinKeys = (level) =>
  SKINS.filter((s) => s.afterLevel < level).map((s) => s.key);

// The skin a level's completion grants (for the reward screen). May be undefined.
export const skinUnlockedBy = (level) => SKINS.find((s) => s.afterLevel === level);

// Enemy tunables. Crabs patrol horizontally on the ground; flyers (ostacoli
// volanti, Livello 3) patrol horizontally in the air with a gentle vertical bob. RANGE is
// the half-width of the ping-pong path around the spawn. Units: px and px/s.
export const ENEMIES = {
  CRAB_SPEED: 70,
  CRAB_RANGE: 120,
  FLY_SPEED: 95,
  FLY_RANGE: 150,
  FLY_BOB: 18,        // vertical bob amplitude (px)
  FLY_BOB_SPEED: 2.4, // bob cycles ~ rad/s
  // Hopper (Rospo Saltatore): a ground enemy that hops in timed arcs, opening and closing a
  // gap to pass under/over it. Stompable like every other "enemy". It carries its own gravity
  // and gets an upward+forward impulse every HOP_INTERVAL seconds, ping-ponging within RANGE
  // of its spawn. Units: px, px/s, s.
  HOPPER_JUMP_VEL: 720,  // upward velocity per hop (arc height)
  HOPPER_HOP_DX: 70,     // horizontal speed while airborne (px/s) — slow, readable arcs
  HOPPER_INTERVAL: 1.4,  // seconds resting on the ground between hops
  HOPPER_RANGE: 110,     // half-width of the patrol band around the spawn
};

// Hazard tunables. Stalactites (stalattiti, Livello 4) hang from the ceiling and drop on a
// timer, then reset to the top — a moving hazard. Units: px, px/s², s.
export const HAZARDS = {
  STALACTITE_GRAVITY: 1500,
  STALACTITE_INTERVAL: 2.8, // max wait between drops (each gets a random phase up to this)
};

// Finale "Sala da Ballo" — the cinematic that closes the journey. This is the
// gift's emotional centerpiece: edit `message` freely (keep it bracket-free and stick to
// widely-shipped emoji like 👑 ✨ 💎 — newer ones render as tofu boxes on Win10).
export const FINALE = {
  heroineTitle: "Principessa Perfetta", // caption above the avatar
  title: "Per Anna", // message-box heading
  message:
    "Hai attraversato foreste incantate, abissi di corallo,\n" +
    "tetti d'oriente e cime innevate...\n" +
    "hai danzato tra i petali del giardino al crepuscolo\n" +
    "e superato il custode del castello.\n" +
    "A ogni passo sei diventata piu te stessa.\n\n" +
    "Le porte della sala da ballo sono aperte.\n" +
    "Buon viaggio, principessa.",
};

// Platformer tunables. Centralised so entity/level code stays free of magic
// numbers and difficulty is easy to tweak. Units: px and px/s.
export const PHYSICS = {
  GRAVITY: 1800,    // base downward acceleration (px/s²)
  // Horizontal feel: near-instant velocity with a micro acceleration ramp. ACCEL_TIME is
  // imperceptible to the hand (the old instant feel survives) but gives the run animation
  // a lean-in, makes skids detectable, and lets ice levels use a longer ramp. Set to 0 to
  // restore the exact old instant behavior.
  RUN_SPEED: 320,   // horizontal run speed (px/s)
  ACCEL_TIME: 0.06, // seconds from standstill to full speed (and back)
  SKID_MIN: 200,    // |vx| above this when reversing direction → skid dust puff
  // Vertical feel: a snappy hop with variable height (release early = lower) and a faster
  // fall than rise (asymmetric arc, Mario-style), plus small forgiveness windows.
  JUMP_FORCE: 730,  // initial upward velocity on jump (px/s); clears thorns + 2-cell ravines
  JUMP_CUT: 0.45,   // vel.y multiplier applied once if jump is released while still rising
  FALL_MULT: 1.6,   // extra gravity factor while descending (asymmetric arc)
  COYOTE_TIME: 0.1, // grace window (s) to still jump just after leaving a ledge
  JUMP_BUFFER: 0.1, // window (s) a jump press is remembered before landing
  STOMP_BOUNCE: 520, // upward velocity after stomping an enemy (Mario-style hop, < JUMP_FORCE)
};

// Level-mechanic tunables (Phase 4): per-level identity pieces built by src/levels/build.js.
// Units: px, px/s, s.
export const MECHANICS = {
  SPRING_VEL: 1100,        // upward velocity from a spring mushroom (auto-bounce, no button)
  CRUMBLE_SHAKE: 0.5,      // s of trembling before a crumble platform falls
  CRUMBLE_RESPAWN: 3,      // s before a fallen crumble platform reforms
  UPDRAFT_LIFT: -300,      // vel.y is eased toward this while inside an updraft column
  SWOOP_RANGE: 240,        // px: a swooper notices the heroine and dives
  SWOOP_DROP: 190,         // px: how far it dives toward the lane
  SWOOP_TIME: 1.3,         // s: full dive-and-return arc
  SWOOP_COOLDOWN: 1.6,     // s between dives
  ROLLER_RANGE: 340,       // px: a roller wakes and gives chase
  ROLLER_ACCEL: 420,       // px/s² chase acceleration
  ROLLER_MAX: 230,         // px/s top speed (slower than the heroine — outrunnable)
  // Breeze column (giardino, Livello 5): a horizontal current of petals — while inside,
  // the heroine is carried forward and her fall is softened (long assisted jumps).
  BREEZE_PUSH: 230,        // extra px/s of forward drift while inside a breeze column
  BREEZE_FALL: 0,          // vel.y is eased toward this while falling inside — the petals
  //                          hold her height, so a glide entered above the gap's lip can
  //                          never sink into a wall-slide against the far edge
  // Pendulum chandelier (castello, Livello 6): a lethal bob swinging on a chain.
  PENDULUM_LENGTH: 170,    // px: chain length from the anchor to the bob's centre
  PENDULUM_ARC: 1.15,      // rad: max swing angle from vertical (~66°)
  PENDULUM_PERIOD: 3.2,    // s per full left-right-left swing (slow = readable safe windows)
};

// Camera feel: the camera leads the heroine in her facing direction so she sees
// where she's going (Mario-style), easing toward the target instead of snapping.
export const CAMERA = {
  LOOKAHEAD: 90, // px ahead of the heroine in the facing direction
  EASE: 4,       // easing rate (1 - exp(-dt * EASE) per frame)
};

// Frame-cap per game state (thermal, not fluidity). ACTIVE play keeps its full rate
// (`maxFPS`: 60 mobile / uncapped desktop — untouched, the feel is sacred). But when the game
// is just STANDING there — menu, finale, loading, the end-of-level reward — 30fps is plenty
// for a drifting backdrop, and behind a FROZEN world (pause / Insert-Coin / Game Over overlays)
// even ~10fps looks identical since nothing moves. Dropping the render rate in those states
// stops an iPhone's GPU from redrawing a static scene 60×/s and cooking the phone for no
// reason. Wired via setFrameCap (src/kaplayCtx.js) at each scene/state entry. See CLAUDE.md.
export const PERF = {
  IDLE_FPS: 30,   // animated-but-not-played states (menu / finale / loading / reward overlay)
  FROZEN_FPS: 10, // world frozen behind a DOM overlay (pause / death) — nothing is moving
};

// Points (spec: Mario-style scoring). A collected pickup and a stomped enemy each add to the
// running journey score (src/state.js), shown in the HUD and the end-of-level reward.
export const SCORE = {
  PICKUP: 100,   // golden apple / pearl / lantern / crystal
  STOMP: 200,    // defeating an enemy by jumping on it
  POWERUP: 300,  // grabbing a star
};

// Power-up: a star grants a short window of invincibility — hazards and enemies can't hurt
// the heroine, and simply touching an enemy defeats it (Mario "star" power). A fall into a
// ravine still ends the run.
export const POWERUP = {
  DURATION: 5, // seconds of invincibility per star (shortened from 7 — less of a "win button")
  // Feather (Fase 2): a short high-jump window — the player's jump force is multiplied while
  // it lasts, so she can reach the high bonus routes. Placed off the critical path (bonus
  // perches), so grabbing it is always optional and never required to complete a level.
  FEATHER_DURATION: 8,
  FEATHER_JUMP_MUL: 1.4,
};

// Final boss — "Custode di Pietra" (Livello 6 climax). A bespoke, multi-phase guardian,
// unlike every other enemy: it HOVERS out of jump reach raining attacks (a ground SHOCKWAVE
// to jump over, and falling DEBRIS), then DESCENDS into a vulnerable window to be stomped,
// ENRAGING with each hit. Defeating it unlocks the ballroom doors (the goal is gated until
// then — see game.js). Designed to be strictly beatable with jump+stomp and impossible to
// softlock: the boss BODY is harmless to touch (only its shockwave/debris hazards hurt her),
// the vulnerable window is fixed (never shrinks), and it recurs forever. Heights are offsets
// above the arena floor (px) so makeBoss positions itself relative to the staircase top it
// scans below — tuned against the single-jump apex (≈148px). Units: px, px/s, s.
export const BOSS = {
  HP: 3,                  // stomps to fell it (one hit per vulnerable window). Back to 3 now that
                          // the stomp registers reliably: the hit is detected via onCollideUpdate
                          // in game.js (a jump from BELOW entered the tall hitbox while still
                          // rising, so the single onCollide-ENTER event was wasted and the descent
                          // never re-fired — she could never land a hit). With that fixed, 3 hits
                          // is fair. Felling it drops the ballroom KEY (see spawnKey / the goal gate).
  W: 104,                 // visual/hitbox width (a hulking stone guardian)
  H: 96,                  // visual/hitbox height
  AREA_SCALE: 0.92,       // stomp hitbox a touch forgiving
  ATTACK_ABOVE_FLOOR: 290, // hover height while attacking — out of stomp/contact reach at apex
  WINDOW_ABOVE_FLOOR: 110, // descent height for the vulnerable window — well below the ~148px
                           // single-jump apex so the stomp lands with margin (was 150 = at apex,
                           // frame-perfect on touch controls)
  HOVER_TIME: 1.7,        // s hovering before an attack (shortened by enrage) — extra breathing room
  TELEGRAPH: 0.55,        // s of flash/dip warning before an attack fires
  RECOVER: 0.7,           // s the attack plays out before the boss descends
  WINDOW_TIME: 2.6,       // s the vulnerable window stays open (FIXED — never shrinks) — long
                          // enough to line up and land a jump on iPhone (was 1.7)
  MOVE_TIME: 0.42,        // s to descend into / rise out of the window
  SHOCKWAVE_SPEED: 280,   // px/s ground wave (< RUN_SPEED 320 so it's always jumpable)
  SHOCKWAVE_SPEED_CAP: 305, // even fully enraged the wave stays jumpable
  SHOCKWAVE_LIFE: 2.4,    // s before a wave despawns (keeps it on-screen, never a hidden hazard)
  DEBRIS_BASE: 2,         // falling rocks per volley at full hp (+1 per hp lost)
  DEBRIS_TELEGRAPH: 0.7,  // s a target marker shows before a rock drops (dodge window)
  DEBRIS_GRAVITY: 1500,   // px/s² fall accel (matches stalactites)
  ENRAGE_K: 0.06,         // cadence/shockwave speedup per hp lost: factor = 1 + (HP-hp)*K
                          // (softened from 0.18 so the second phase barely accelerates)
};

// Asset manifest — the swap point. Replace files in /assets and, if an extension
// changes, update the path here. Keys are stable so game code never hard-codes paths.
export const ASSETS = {
  // UI font (loaded in src/assets.js, set as the Kaplay default in src/kaplayCtx.js and
  // mirrored via @font-face in style.css). A pixel font so the HUD/menus match the crisp
  // pixel-art world instead of the old anti-aliased system "sans-serif". Pixelify Sans
  // (OFL) covers Latin-1 incl. Italian accents (à è é ì ò ù); it has NO emoji/symbol glyphs
  // (▶ ↻ ★ ✨ 👑), so those few labels keep `font: "sans-serif"` per object in canvas code,
  // while DOM falls back per-glyph automatically.
  fonts: {
    pixel: "assets/fonts/PixelifySans.woff2",
  },
  sprites: {
    anna: "assets/sprites/anna.png",
    sognatrice: "assets/sprites/sognatrice.png",
    avventuriera: "assets/sprites/avventuriera.png",
    logo: "assets/sprites/logo.png",
    // Skin layers — same 64×96 transparent canvas, overlaid on the base body.
    skirt: "assets/sprites/skirt.png",
    bodice: "assets/sprites/bodice.png",
    necklace: "assets/sprites/necklace.png",
    crown: "assets/sprites/crown.png",
    gloves: "assets/sprites/gloves.png",
    cape: "assets/sprites/cape.png",
    // World sprites — per-level collectibles, enemies, and the goal portal.
    // Collectibles/enemies are drawn in natural colour; the portal is neutral grey and
    // tinted with theme.goal at build time (see src/levels/build.js).
    apple: "assets/sprites/apple.png",
    pearl: "assets/sprites/pearl.png",
    lantern: "assets/sprites/lantern.png",
    crystal: "assets/sprites/crystal.png",
    rose: "assets/sprites/rose.png",
    goblet: "assets/sprites/goblet.png",
    crab: "assets/sprites/crab.png",
    flyer: "assets/sprites/flyer.png",
    portal: "assets/sprites/portal.png",
    // Phase-4 mechanics (see src/levels/build.js legend).
    spring: "assets/sprites/spring.png",
    flag: "assets/sprites/flag.png",
    swooper: "assets/sprites/swooper.png",
    roller: "assets/sprites/roller.png",
    // Arcade pickups/enemies — single-frame pixel art (runtime adds the bob/squash). Drawn in
    // natural colour like the crab/flyer (no theme tint).
    heart: "assets/sprites/heart.png",
    hopper: "assets/sprites/hopper.png",
    // Decor props — collider-free scenery, three per theme. Placed procedurally on
    // exposed ground tops + via authored def.decor lists (src/levels/build.js); each
    // level's theme.props names its menu.
    deco_tree: "assets/sprites/deco_tree.png",
    deco_mushroom: "assets/sprites/deco_mushroom.png",
    deco_fern: "assets/sprites/deco_fern.png",
    deco_coralfan: "assets/sprites/deco_coralfan.png",
    deco_kelp: "assets/sprites/deco_kelp.png",
    deco_shell: "assets/sprites/deco_shell.png",
    deco_lanternpost: "assets/sprites/deco_lanternpost.png",
    deco_banner: "assets/sprites/deco_banner.png",
    deco_chimney: "assets/sprites/deco_chimney.png",
    deco_pine: "assets/sprites/deco_pine.png",
    deco_snowdrift: "assets/sprites/deco_snowdrift.png",
    deco_crystal_big: "assets/sprites/deco_crystal_big.png",
    deco_rosebush: "assets/sprites/deco_rosebush.png",
    deco_ivyarch: "assets/sprites/deco_ivyarch.png",
    deco_fountain: "assets/sprites/deco_fountain.png",
    deco_candelabra: "assets/sprites/deco_candelabra.png",
    deco_armor: "assets/sprites/deco_armor.png",
    deco_royalbanner: "assets/sprites/deco_royalbanner.png",
  },

  // Tile atlas — one 64px strip tinted per theme at runtime. Frames map names to
  // sub-rects so src/levels/build.js can do k.sprite("ground_top") etc. Offsets follow the
  // TILE_FRAMES order in tools/gen/world.mjs: _2 are look-alike variants (so long runs don't
  // visibly repeat), _l/_r are carved edge caps, grass_cap* are the transparent surface
  // overlays tinted theme.solidTop (they replace the old flat lip rect).
  tiles: {
    atlas: "assets/tilesets/tileset.png",
    frames: {
      ground_top: { x: 0, y: 0, width: 64, height: 64 },
      ground_top_2: { x: 64, y: 0, width: 64, height: 64 },
      ground_top_l: { x: 128, y: 0, width: 64, height: 64 },
      ground_top_r: { x: 192, y: 0, width: 64, height: 64 },
      ground_fill: { x: 256, y: 0, width: 64, height: 64 },
      ground_fill_2: { x: 320, y: 0, width: 64, height: 64 },
      platform: { x: 384, y: 0, width: 64, height: 64 },
      semisolid: { x: 448, y: 0, width: 64, height: 64 },
      hazard_spike: { x: 512, y: 0, width: 64, height: 64 },
      hazard_icicle: { x: 576, y: 0, width: 64, height: 64 },
      grass_cap: { x: 640, y: 0, width: 64, height: 64 },
      grass_cap_2: { x: 704, y: 0, width: 64, height: 64 },
    },
  },

  // Parallax backgrounds — 3 layers × 4 themes, scrolled in src/scenes/game.js.
  backgrounds: {
    forest_sky: "assets/backgrounds/forest_sky.png",
    forest_mid: "assets/backgrounds/forest_mid.png",
    forest_near: "assets/backgrounds/forest_near.png",
    coral_sky: "assets/backgrounds/coral_sky.png",
    coral_mid: "assets/backgrounds/coral_mid.png",
    coral_near: "assets/backgrounds/coral_near.png",
    rooftops_sky: "assets/backgrounds/rooftops_sky.png",
    rooftops_mid: "assets/backgrounds/rooftops_mid.png",
    rooftops_near: "assets/backgrounds/rooftops_near.png",
    snow_sky: "assets/backgrounds/snow_sky.png",
    snow_mid: "assets/backgrounds/snow_mid.png",
    snow_near: "assets/backgrounds/snow_near.png",
    garden_sky: "assets/backgrounds/garden_sky.png",
    garden_mid: "assets/backgrounds/garden_mid.png",
    garden_near: "assets/backgrounds/garden_near.png",
    castle_sky: "assets/backgrounds/castle_sky.png",
    castle_mid: "assets/backgrounds/castle_mid.png",
    castle_near: "assets/backgrounds/castle_near.png",
  },
  sounds: {
    // Background music, played on the Music bus (src/audio.js): the menu waltz, one
    // chiptune track per level theme (game.js plays `bgm-${theme.decor}`), and the grand
    // finale waltz. The 🎵 toggle mutes these independently of SFX.
    "menu-bgm": "assets/audio/menu-bgm.wav",
    "finale-bgm": "assets/audio/finale-bgm.wav",
    "bgm-forest": "assets/audio/bgm-forest.wav",
    "bgm-coral": "assets/audio/bgm-coral.wav",
    "bgm-rooftops": "assets/audio/bgm-rooftops.wav",
    "bgm-snow": "assets/audio/bgm-snow.wav",
    "bgm-garden": "assets/audio/bgm-garden.wav",
    "bgm-castle": "assets/audio/bgm-castle.wav",
    // Gameplay SFX — synthesized, played via src/sfx.js on the SFX bus so the
    // 🔊 toggle mutes them independently of the music. Swap the files keeping these keys.
    jump: "assets/audio/jump.wav",
    collect: "assets/audio/collect.wav",
    coin: "assets/audio/coin.wav",
    oops: "assets/audio/oops.wav",
    goal: "assets/audio/goal.wav",
    win: "assets/audio/win.wav",
    select: "assets/audio/select.wav",
    stomp: "assets/audio/stomp.wav",
    spring: "assets/audio/spring.wav",
    checkpoint: "assets/audio/checkpoint.wav",
    crumble: "assets/audio/crumble.wav",
    skid: "assets/audio/skid.wav",
  },
};
