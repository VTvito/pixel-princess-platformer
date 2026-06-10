// animspec.js — the SINGLE shared animation contract between the asset generator
// (tools/gen/characters.mjs) and the runtime loader (src/assets.js).
//
// Heroine and skin sheets are 8×2 grids of 64×96 cells (512×192 PNG). The generator
// derives every frame from a pose record per index (see FRAME_POSES in the generator);
// the runtime slices the sheet and registers these anims. Because BOTH sides import this
// file, frame counts/layout can never silently disagree.
//
// Skin overlays (skirt/bodice/necklace/crown) are sheets with the SAME layout, painted
// from the SAME pose records: the runtime keeps them in sync by mirroring the parent's
// frame index every update (layer.frame = player.frame) — layers never play() anything.

export const SHEET = { cols: 8, rows: 2 }; // 16 cells; 15 is spare

export const ANIMS = {
  idle: { from: 0, to: 3, speed: 4, loop: true }, // breath + a blink
  run: { from: 4, to: 9, speed: 14, loop: true }, // 6-frame stride
  jump: 10, // rising: tucked legs, hair down
  fall: 11, // descending: legs reaching, hair lifted
  hurt: 12, // the "ops" face behind the Insert Coin overlay
  celebrate: { from: 13, to: 14, speed: 5, loop: true }, // arms up — goal + finale
};

// Sprite keys loaded as animated sheets (everything else stays a single image).
export const ANIMATED_SPRITES = [
  "anna", "sognatrice", "avventuriera",
  "skirt", "bodice", "necklace", "crown",
];
