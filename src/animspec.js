// animspec.js — the SINGLE shared animation contract between the asset generator
// (tools/gen/characters.mjs) and the runtime loader (src/assets.js).
//
// Heroine and skin sheets are 8×3 grids of 64×96 cells (512×288 PNG). The generator
// derives every frame from a pose record per index (see FRAME_POSES in the generator);
// the runtime slices the sheet and registers these anims. Because BOTH sides import this
// file, frame counts/layout can never silently disagree.
//
// Skin overlays (skirt/bodice/necklace/crown) are sheets with the SAME layout, painted
// from the SAME pose records: the runtime keeps them in sync by mirroring the parent's
// frame index every update (layer.frame = player.frame) — layers never play() anything.

export const SHEET = { cols: 8, rows: 3 }; // 24 cells; 19-23 are spare

export const ANIMS = {
  idle: { from: 0, to: 3, speed: 4, loop: true }, // breath + a blink
  run: { from: 4, to: 9, speed: 14, loop: true }, // 6-frame stride
  jump: 10, // rising: tucked legs, hair down
  fall: 11, // descending: legs reaching, hair lifted
  hurt: 12, // the "ops" face behind the Insert Coin overlay
  // Arms up + two hop frames — goal + finale (explicit list: cells aren't contiguous).
  celebrate: { frames: [13, 14, 17, 18], speed: 5, loop: true },
  skid: 15, // braced legs, hair thrown forward (direction reversal at speed)
  land: 16, // brief crouch right after touching down
};

// Sprite keys loaded as animated sheets (everything else stays a single image).
export const ANIMATED_SPRITES = [
  "anna", "sognatrice", "avventuriera",
  "skirt", "bodice", "necklace", "crown",
];

// World sprites with their own little loops (horizontal strips; cell size = the sprite's
// old single-frame size, so colliders and placement math are untouched). The generator
// (tools/gen/world.mjs) emits strips in this exact frame count/order.
export const WORLD_SHEETS = {
  apple: { sliceX: 6, anims: { spin: { from: 0, to: 5, speed: 9, loop: true } } },
  pearl: { sliceX: 6, anims: { spin: { from: 0, to: 5, speed: 9, loop: true } } },
  lantern: { sliceX: 6, anims: { spin: { from: 0, to: 5, speed: 9, loop: true } } },
  crystal: { sliceX: 6, anims: { spin: { from: 0, to: 5, speed: 9, loop: true } } },
  crab: { sliceX: 6, anims: { walk: { from: 0, to: 5, speed: 12, loop: true } } },
  flyer: { sliceX: 6, anims: { fly: { from: 0, to: 5, speed: 15, loop: true } } },
  portal: { sliceX: 4, anims: { shimmer: { from: 0, to: 3, speed: 5, loop: true } } },
  spring: { sliceX: 3, anims: { bounce: { from: 1, to: 2, speed: 14, loop: false } } },
  flag: { sliceX: 4, anims: { wave: { from: 0, to: 3, speed: 6, loop: true } } },
  swooper: { sliceX: 4, anims: { float: { from: 0, to: 3, speed: 7, loop: true } } },
  roller: { sliceX: 6, anims: { roll: { from: 0, to: 5, speed: 18, loop: true } } },
};
