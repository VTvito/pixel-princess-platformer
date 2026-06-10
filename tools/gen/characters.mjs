// characters.mjs — pixel-art heroines + clothing skins, authored at 16×24 native
// (×4 → the 64×96 cells the runtime expects, see src/entities/player.js).
//
// ANIMATION BY SHARED POSE RECORDS: every drawing decision that animation moves (head
// bob, leg stride, arm swing, hair sway/lift, skirt flare, blink, …) reads from a pose
// record, and FRAME_POSES defines one record per sheet cell (16 cells, layout + anim
// ranges in src/animspec.js). The body painter AND every skin painter consume the same
// record for the same frame index, so the runtime overlay layers (which mirror the
// parent's frame each update) are in sync by construction — drift is impossible.

import { newImg, pset, fillRect, fillTrap, blit, outline } from "./px.mjs";
import { SHEET } from "../../src/animspec.js";

export const BODY_W = 16;
export const BODY_H = 24;
const CX = 8; // body is symmetric around columns 7-8

const SKIN = [243, 207, 178];
const SKIN_SHADE = [216, 176, 148];
const EYE = [44, 36, 50];
const LASH = [150, 110, 90]; // closed-eye line (blink / hurt)
const BLUSH = [233, 150, 160];
const MOUTH = [176, 88, 92];
const OUT = [38, 30, 42]; // shared dark contour so layered art reads as one figure

// One record per animation-relevant dimension. All fields are native-pixel offsets.
const POSE = {
  headBob: 0, // +down: breathing / run bounce (head, necklace, crown follow)
  lean: 0, // torso lean, +forward (torso, arms, bodice follow)
  legLx: 0, // left-leg x offset (+forward when facing right)
  legRx: 0, // right-leg x offset
  legLy: 0, // left-foot lift (+up)
  legRy: 0, // right-foot lift
  tuck: 0, // shorten legs by this much (jump tuck)
  armSwing: 0, // opposite arm swing (run) / spread (air)
  armsUp: false, // both arms raised (celebrate)
  hairSway: 0, // lock sway, +trailing
  hairLift: 0, // locks ride up (falling)
  skirtFlare: 0, // extra skirt hem half-width (skirt skin reads this)
  blink: false,
  hurt: false, // closed eyes + open mouth
};

const pose = (p) => ({ ...POSE, ...p });

// Sheet cells, indexed to match ANIMS in src/animspec.js.
export const FRAME_POSES = [
  // 0-3 idle: gentle breath, one blink
  pose({}),
  pose({ headBob: 1 }),
  pose({ headBob: 1, blink: true }),
  pose({ headBob: 0 }),
  // 4-9 run: 6-frame stride (contact → pass → cross, both sides)
  pose({ legLx: 2, legRx: -2, legRy: 1, armSwing: 1, hairSway: -1, skirtFlare: 1 }),
  pose({ legLx: 1, legRx: -1, headBob: 1, armSwing: 1, hairSway: -1 }),
  pose({ headBob: 1, hairSway: -1 }),
  pose({ legLx: -2, legRx: 2, legLy: 1, armSwing: -1, hairSway: -1, skirtFlare: 1 }),
  pose({ legLx: -1, legRx: 1, headBob: 1, armSwing: -1, hairSway: -1 }),
  pose({ headBob: 1, hairSway: -1 }),
  // 10 jump (rising): tucked legs, slight spread of the arms
  pose({ tuck: 2, legLx: -1, legRx: 1, armSwing: 2, skirtFlare: 1 }),
  // 11 fall: legs reaching down, hair + skirt riding up
  pose({ legRy: 1, armSwing: 2, hairLift: 2, hairSway: -1, skirtFlare: 2 }),
  // 12 hurt: the "ops" pose behind the Insert Coin overlay
  pose({ headBob: 1, hurt: true, hairSway: 1 }),
  // 13-14 celebrate: arms up, little hop
  pose({ armsUp: true, skirtFlare: 1 }),
  pose({ armsUp: true, headBob: -1, skirtFlare: 1, hairSway: 1 }),
  // 15 spare (blank cell)
  null,
];

/**
 * Paint one heroine body on a transparent 16×24 canvas, in the given pose.
 * @param {{hair:number[], top:number[], legs:number[], shoes:number[], hairLen:number,
 *          quilt?:boolean}} look  per-character colors; quilt = puffer-jacket seams (Anna)
 */
export function paintHeroine(look, p = POSE) {
  const img = newImg(BODY_W, BODY_H);
  const hb = p.headBob;
  const lean = p.lean;
  const hairDark = look.hair.map((v) => Math.round(v * 0.74));
  const topDark = look.top.map((v) => Math.round(v * 0.78));

  // Back hair: side locks falling from the head down to hairLen, swaying/lifting with the
  // pose (style cue per character).
  const lockBot = Math.min(22, look.hairLen) - p.hairLift;
  const sway = p.hairSway;
  fillRect(img, 3 + sway, 6 + hb - p.hairLift, 5 + sway, lockBot, look.hair);
  fillRect(img, 11 + sway, 6 + hb - p.hairLift, 13 + sway, lockBot, look.hair);
  // Shade the inner edge of the locks so they read as behind the body.
  fillRect(img, 4 + sway, 10 + hb, 5 + sway, lockBot, hairDark);
  fillRect(img, 11 + sway, 10 + hb, 12 + sway, lockBot, hairDark);

  // Torso (jacket / dress top), y10-15, leaning with the pose.
  fillRect(img, 5 + lean, 10, 11 + lean, 16, look.top);
  if (look.quilt) {
    // Puffer-jacket quilting: darker seam rows — Anna's "piumino carta da zucchero".
    fillRect(img, 5 + lean, 11, 11 + lean, 12, topDark);
    fillRect(img, 5 + lean, 13, 11 + lean, 14, topDark);
  } else {
    fillRect(img, 5 + lean, 14, 11 + lean, 16, topDark); // simple waist shading
  }
  // Arms: raised in celebration, otherwise sleeves at the torso sides swinging opposite.
  if (p.armsUp) {
    fillRect(img, 3 + lean, 6 + hb, 4 + lean, 11, look.top);
    fillRect(img, 12 + lean, 6 + hb, 13 + lean, 11, look.top);
    pset(img, 3 + lean, 5 + hb, SKIN);
    pset(img, 12 + lean, 5 + hb, SKIN);
  } else {
    const swing = p.armSwing;
    fillRect(img, 4 + lean + swing, 10, 5 + lean + swing, 14, look.top);
    fillRect(img, 11 + lean - swing, 10, 12 + lean - swing, 14, look.top);
    pset(img, 4 + lean + swing, 14, SKIN);
    pset(img, 11 + lean - swing, 14, SKIN);
  }

  // Legs y16-20 (strided / lifted / tucked by the pose), shoes under them.
  const legTop = 16 + p.tuck;
  fillRect(img, 5 + p.legLx, legTop, 7 + p.legLx, 21 - p.legLy, look.legs);
  fillRect(img, 9 + p.legRx, legTop, 11 + p.legRx, 21 - p.legRy, look.legs);
  fillRect(img, 4 + p.legLx, 21 - p.legLy, 7 + p.legLx, 23 - p.legLy, look.shoes);
  fillRect(img, 9 + p.legRx, 21 - p.legRy, 12 + p.legRx, 23 - p.legRy, look.shoes);

  // Neck + head (skin), then the hair cap + fringe over it.
  fillRect(img, 7, 9 + hb, 9, 10 + hb, SKIN_SHADE); // neck, slightly shaded
  fillRect(img, 5, 4 + hb, 11, 9 + hb, SKIN); // face block
  fillRect(img, 6, 2 + hb, 10, 4 + hb, look.hair); // hair top
  fillRect(img, 4, 3 + hb, 6, 9 + hb, look.hair); // left frame
  fillRect(img, 10, 3 + hb, 12, 9 + hb, look.hair); // right frame
  fillRect(img, 6, 4 + hb, 10, 5 + hb, look.hair); // fringe over the forehead

  // Face: eyes (open / blink / hurt), blush, mouth.
  if (p.blink || p.hurt) {
    pset(img, 6, 6 + hb, LASH);
    pset(img, 9, 6 + hb, LASH);
  } else {
    pset(img, 6, 6 + hb, EYE);
    pset(img, 9, 6 + hb, EYE);
  }
  pset(img, 5, 7 + hb, BLUSH);
  pset(img, 10, 7 + hb, BLUSH);
  if (p.hurt) {
    fillRect(img, 7, 7 + hb, 9, 9 + hb, MOUTH); // little open "o"
  } else {
    pset(img, 7, 8 + hb, MOUTH);
    pset(img, 8, 8 + hb, MOUTH);
  }

  outline(img, OUT);
  return img;
}

/**
 * Paint one clothing skin on the same 16×24 canvas, against the same pose, so the child
 * sprite overlays the body exactly (anatomy contract above).
 */
export function paintSkin(kind, color, p = POSE) {
  const img = newImg(BODY_W, BODY_H);
  const dark = color.map((v) => Math.round(v * 0.78));
  const hb = p.headBob;
  const lean = p.lean;
  if (kind === "skirt") {
    // Royal skirt: hips → flared hem with a darker band and simple pleats.
    const flare = 5 + p.skirtFlare;
    fillTrap(img, 15, 20, CX + lean, 2.5, flare, color);
    fillRect(img, CX - flare + lean, 18, CX + flare + 1 + lean, 20, dark); // hem band
    for (let x = CX - flare + 2; x <= CX + flare - 1; x += 3) pset(img, x + lean, 19, color); // pleats
    outline(img, OUT);
  } else if (kind === "bodice") {
    // Elegant bodice over the chest, with a darker waist + lacing hints.
    fillRect(img, 5 + lean, 10, 11 + lean, 14, color);
    fillRect(img, 5 + lean, 13, 11 + lean, 14, dark);
    pset(img, 7 + lean, 11, dark);
    pset(img, 8 + lean, 12, dark);
    outline(img, OUT);
  } else if (kind === "necklace") {
    // Jewel necklace: a thin band at the neck + a pendant. No outline — at 1px tall a
    // contour would swallow it; the darker pendant pixel gives it depth instead.
    fillRect(img, 6, 9 + hb, 10, 10 + hb, color);
    pset(img, 7, 10 + hb, dark);
    pset(img, 8, 10 + hb, color);
  } else if (kind === "crown") {
    // Royal crown in the reserved y0-2 zone, riding the head bob.
    fillRect(img, 5, 1 + hb, 11, 3 + hb, color);
    pset(img, 5, 0 + hb, color); // three points
    pset(img, 8, 0 + hb, color);
    pset(img, 10, 0 + hb, color);
    pset(img, 7, 1 + hb, [235, 220, 150]); // gem
    outline(img, OUT);
  }
  return img;
}

// Compose a full 8×2 sheet (one cell per FRAME_POSES entry) from a painter(pose) fn.
export function buildSheet(paintFrame) {
  const sheet = newImg(BODY_W * SHEET.cols, BODY_H * SHEET.rows);
  FRAME_POSES.forEach((p, i) => {
    if (!p) return; // spare cell stays transparent
    const cell = paintFrame(p);
    blit(sheet, cell, (i % SHEET.cols) * BODY_W, Math.floor(i / SHEET.cols) * BODY_H);
  });
  return sheet;
}

// Title mark: a bigger gold crown emblem on the same 16×24 canvas (ASSETS.sprites.logo).
export function paintLogo() {
  const img = newImg(BODY_W, BODY_H);
  const gold = [212, 175, 55];
  const goldDark = [168, 134, 36];
  const gem = [235, 220, 150];
  fillRect(img, 3, 14, 13, 18, gold); // band
  fillRect(img, 3, 17, 13, 18, goldDark);
  for (const cx of [4, 8, 12]) fillTrap(img, 9, 14, cx, 0.5, 1.5, gold); // points
  pset(img, 4, 9, gem);
  pset(img, 8, 8, gem);
  pset(img, 12, 9, gem);
  pset(img, 6, 15, gem); // band jewels
  pset(img, 10, 15, gem);
  outline(img, OUT);
  return img;
}

// Per-character looks (mirrors CHARACTERS in src/config.js — Anna keeps the brown wavy
// hair + sky-blue puffer; the others keep their signature palettes and hair lengths).
export const HEROINES = [
  {
    file: "anna.png",
    look: { hair: [92, 60, 40], top: [167, 199, 231], legs: [52, 62, 92], shoes: [235, 238, 242], hairLen: 13, quilt: true },
  },
  {
    file: "sognatrice.png",
    look: { hair: [168, 96, 52], top: [240, 198, 116], legs: [196, 162, 96], shoes: [150, 96, 60], hairLen: 17 },
  },
  {
    file: "avventuriera.png",
    look: { hair: [46, 36, 38], top: [196, 122, 88], legs: [94, 74, 58], shoes: [120, 82, 60], hairLen: 11 },
  },
];

// Skin layer colors (mirrors SKINS order in src/config.js: skirt → bodice → necklace → crown).
export const SKIN_LAYERS = [
  { file: "skirt.png", kind: "skirt", color: [212, 175, 55] },
  { file: "bodice.png", kind: "bodice", color: [231, 150, 173] },
  { file: "necklace.png", kind: "necklace", color: [255, 236, 170] },
  { file: "crown.png", kind: "crown", color: [212, 175, 55] },
];
