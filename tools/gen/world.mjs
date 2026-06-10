// world.mjs — pixel-art tiles, collectibles, enemies and the goal portal.
//
// Tiles and the portal are drawn in NEUTRAL GREYS (4-tone ramp + dither) and tinted at
// runtime with k.color(theme.x) by src/levels/build.js — the multiplicative tint keeps the
// baked shading, so one atlas serves all four themes (same contract as before).
//
// New in the pixel pass: ground-top/fill VARIANTS (so long runs don't repeat visibly),
// L/R EDGE CAPS (so terrace ends read as carved, not sliced), and a separate GRASS CAP
// frame (transparent overlay with blades, tinted theme.solidTop) that replaces the old
// flat 7px lip rect while keeping the bright two-tone surface look.
//
// Native sizes (×4 at export): tiles 16×16, collectibles 12×12 (→48), crab 16×10 (→64×40),
// flyer 12×8 (→48×32), portal 24×40 (→96×160) — all matching the old runtime dimensions.

import {
  newImg, pset, fillRect, fillDisc, fillTrap, blit,
  darken, lighten, ramp, speckle, ditherRect, outline,
} from "./px.mjs";

const T = 16; // native tile size
const OUT = [38, 30, 42];

// Neutral grey ramp (tinted theme.solid / theme.hazard / theme.goal at runtime).
const G = ramp([196, 196, 196]);
// Grass-cap greys are near-white so the theme.solidTop tint comes through at full strength.
const GRASS_HI = [242, 242, 242];
const GRASS = [212, 212, 212];

// --- ground tiles --------------------------------------------------------------

function dirtBase(seed) {
  const img = newImg(T, T);
  fillRect(img, 0, 0, T, T, G.lo);
  speckle(img, 0, 0, T, T, G.lo2, 0.12, seed);
  speckle(img, 0, 0, T, T, G.base, 0.05, seed * 3 + 1);
  return img;
}

function tileGroundTop(seed, stone = false) {
  const img = dirtBase(seed);
  fillRect(img, 0, 0, T, 1, G.base); // light seam where the grass cap meets the dirt
  if (stone) {
    fillRect(img, 9, 9, 12, 11, G.base); // a small buried stone
    fillRect(img, 9, 11, 12, 12, G.lo2);
  }
  return img;
}

function tileGroundEdge(side, seed) {
  const img = tileGroundTop(seed);
  const x = side === "l" ? 0 : T - 1;
  fillRect(img, x, 0, x + 1, T, G.lo2); // carved dark edge on the exposed side
  return img;
}

function tileGroundFill(seed, stone = false) {
  const img = newImg(T, T);
  fillRect(img, 0, 0, T, T, G.lo);
  speckle(img, 0, 0, T, T, G.lo2, 0.16, seed);
  speckle(img, 0, 0, T, T, G.base, 0.04, seed * 5 + 3);
  fillRect(img, 3, 6, 7, 7, G.lo2); // short strata dashes for a hand-set look
  fillRect(img, 10, 12, 14, 13, G.lo2);
  if (stone) {
    fillRect(img, 5, 9, 9, 12, G.base);
    fillRect(img, 5, 11, 9, 12, G.lo2);
    pset(img, 5, 9, G.hi);
  }
  return img;
}

// Floating slab: top surface at y0 (so the standing line matches the collider top), body
// with a shaded underside, transparent lower half. Spans full width so 2-cell platforms
// join seamlessly; the grass cap overlays y0 like on ground tops.
function tilePlatform() {
  const img = newImg(T, T);
  fillRect(img, 0, 0, T, 1, G.hi);
  fillRect(img, 0, 1, T, 7, G.lo);
  speckle(img, 0, 2, T, 7, G.lo2, 0.1, 5);
  fillRect(img, 0, 7, T, 9, G.lo2); // shaded underside
  pset(img, 0, 8, [0, 0, 0], 0); // nicked bottom corners so the slab reads rounded
  pset(img, T - 1, 8, [0, 0, 0], 0);
  return img;
}

// --- hazards ---------------------------------------------------------------------

// Three chunky spikes on a low base; content sits in the lower 3/4 of the cell so the
// bottom-anchored child sprite in build.js keeps the old visual extent.
function tileHazardSpike() {
  const img = newImg(T, T);
  fillRect(img, 1, 13, T - 1, T, G.lo);
  speckle(img, 1, 13, T - 1, T, G.lo2, 0.2, 9);
  for (const cx of [3, 8, 13]) {
    fillTrap(img, 5, 13, cx, 0.5, 2.5, G.base);
    pset(img, cx, 5, G.hi); // bright tip
    pset(img, cx, 6, G.hi);
  }
  outline(img, G.lo2);
  return img;
}

function tileHazardIcicle() {
  const img = newImg(T, T);
  fillRect(img, 1, 0, T - 1, 2, G.lo); // ceiling attachment
  fillTrap(img, 2, 15, 8, 5.5, 0.5, G.base);
  fillTrap(img, 2, 9, 6, 1.5, 0.5, G.hi); // glossy streak
  outline(img, G.lo2);
  return img;
}

// One-way platform: a thin slab with bracket feet — the heroine passes from below and
// stands on top (platformEffector in build.js). Full width so runs join seamlessly.
function tileSemisolid() {
  const img = newImg(T, T);
  fillRect(img, 0, 0, T, 1, G.hi); // lit walking surface
  fillRect(img, 0, 1, T, 4, G.lo);
  fillRect(img, 0, 4, T, 5, G.lo2); // shaded underside
  fillRect(img, 2, 5, 4, 8, G.lo2); // bracket feet
  fillRect(img, 12, 5, 14, 8, G.lo2);
  return img;
}

// --- grass caps --------------------------------------------------------------------

// Transparent overlay tinted theme.solidTop: blades on the very top, a lit band, then a
// dithered fade into the dirt below. Two variants so long surfaces don't repeat.
function tileGrassCap(bladeXs, phase) {
  const img = newImg(T, T);
  for (const x of bladeXs) pset(img, x, 0, GRASS);
  fillRect(img, 0, 1, T, 2, GRASS_HI);
  fillRect(img, 0, 2, T, 3, GRASS);
  ditherRect(img, 0, 3, T, 4, GRASS, 255, phase);
  return img;
}

// --- tile atlas ---------------------------------------------------------------------

// Order defines the x-offsets in assets/tilesets/tileset.png — keep in sync with
// ASSETS.tiles.frames in src/config.js.
export const TILE_FRAMES = [
  "ground_top", "ground_top_2", "ground_top_l", "ground_top_r",
  "ground_fill", "ground_fill_2", "platform", "semisolid",
  "hazard_spike", "hazard_icicle",
  "grass_cap", "grass_cap_2",
];

export function buildTileAtlas() {
  const frames = {
    ground_top: tileGroundTop(7),
    ground_top_2: tileGroundTop(31, true),
    ground_top_l: tileGroundEdge("l", 13),
    ground_top_r: tileGroundEdge("r", 17),
    ground_fill: tileGroundFill(11),
    ground_fill_2: tileGroundFill(29, true),
    platform: tilePlatform(),
    semisolid: tileSemisolid(),
    hazard_spike: tileHazardSpike(),
    hazard_icicle: tileHazardIcicle(),
    grass_cap: tileGrassCap([1, 4, 7, 10, 13], 0),
    grass_cap_2: tileGrassCap([2, 6, 9, 12, 14], 1),
  };
  const atlas = newImg(T * TILE_FRAMES.length, T);
  TILE_FRAMES.forEach((name, i) => blit(atlas, frames[name], i * T, 0));
  return atlas;
}

// --- collectibles (12×12 native, natural colors + dark contour) ----------------------
//
// Each collectible is emitted as a 6-frame coin-spin strip: the painted sprite is
// horizontally squashed through [1, .8, .45, .2, .45, .8] around its centre, the classic
// 16-bit "spinning pickup". The squash happens AFTER the outline bake so the contour
// stays crisp on every frame.

const C = 12;
const SPIN_WIDTHS = [1, 0.8, 0.45, 0.2, 0.45, 0.8];

// Nearest-neighbour horizontal squash around the image centre.
function squashX(img, f) {
  if (f >= 1) return img;
  const out = newImg(img.w, img.h);
  const cx = (img.w - 1) / 2;
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++) {
      const sx = Math.round(cx + (x - cx) / f);
      if (sx < 0 || sx >= img.w) continue;
      const si = (y * img.w + sx) * 4;
      if (img.buf[si + 3] === 0) continue;
      pset(out, x, y, [img.buf[si], img.buf[si + 1], img.buf[si + 2]], img.buf[si + 3]);
    }
  return out;
}

// Lay n frames out as a horizontal strip of equal cells.
function strip(frames, cw, ch) {
  const img = newImg(cw * frames.length, ch);
  frames.forEach((f, i) => blit(img, f, i * cw, 0));
  return img;
}

export const buildSpinStrip = (paint) => {
  const base = paint();
  return strip(SPIN_WIDTHS.map((f) => squashX(base, f)), base.w, base.h);
};

export function paintApple() {
  const img = newImg(C, C);
  const red = [210, 64, 60];
  fillDisc(img, 5.5, 7, 3.4, red);
  fillDisc(img, 7.5, 7, 3, darken(red, 0.84)); // second lobe, shaded
  pset(img, 4, 5, lighten(red, 1.45)); // sheen
  pset(img, 5, 5, lighten(red, 1.45));
  fillRect(img, 6, 2, 7, 4, [96, 64, 42]); // stem
  fillRect(img, 7, 2, 9, 3, [120, 178, 96]); // leaf
  outline(img, OUT);
  return img;
}

export function paintPearl() {
  const img = newImg(C, C);
  const cream = [236, 240, 250];
  fillDisc(img, 6, 6, 3.6, cream);
  fillDisc(img, 7, 7, 2.6, [202, 206, 228]); // cool shadow
  fillDisc(img, 6, 6, 2.4, cream);
  pset(img, 4, 4, [255, 255, 255]); // bright highlight
  pset(img, 5, 4, [255, 255, 255]);
  outline(img, OUT);
  return img;
}

export function paintLantern() {
  const img = newImg(C, C);
  const warm = [255, 196, 84];
  const frame = [120, 40, 40];
  pset(img, 5, 0, frame); // hook
  pset(img, 6, 0, frame);
  fillRect(img, 4, 1, 8, 2, frame); // top cap
  fillTrap(img, 2, 9, 5.5, 2, 3, warm); // glowing body
  fillRect(img, 5, 4, 7, 6, lighten(warm, 1.3)); // inner glow
  fillRect(img, 3, 9, 9, 10, frame); // bottom cap
  outline(img, OUT);
  return img;
}

export function paintCrystal() {
  const img = newImg(C, C);
  const cyan = [96, 214, 226];
  fillTrap(img, 1, 5, 5.5, 1, 3.5, cyan);
  fillTrap(img, 5, 11, 5.5, 3.5, 0.5, darken(cyan, 0.82));
  fillTrap(img, 2, 5, 4, 0.5, 1.5, lighten(cyan, 1.35)); // lit facet
  pset(img, 5, 6, lighten(cyan, 1.2)); // center sparkle
  outline(img, OUT);
  return img;
}

// --- enemies (natural colors + contour; 6-frame walk/fly strips) ------------------------

function paintCrab(phase = 0) {
  const img = newImg(16, 10);
  const body = [206, 70, 60];
  const claw = [232, 120, 104];
  const clawBob = [0, -1, -1, 0, 1, 1][phase]; // claws wave as it scuttles
  fillDisc(img, 8, 5, 4.4, body); // shell
  fillRect(img, 4, 4, 12, 8, body);
  fillRect(img, 4, 7, 12, 8, darken(body, 0.78)); // shaded underside
  fillRect(img, 1, 3 + clawBob, 3, 5 + clawBob, claw); // claws
  fillRect(img, 13, 3 - clawBob, 15, 5 - clawBob, claw);
  // Legs cycle through three stances for a busier scuttle.
  const legs = [[4, 6, 9, 11], [5, 7, 10, 12], [4, 7, 9, 12]][phase % 3];
  for (const lx of legs) pset(img, lx, 8, darken(body, 0.7));
  pset(img, 6, 2, [255, 255, 255]); // eyes
  pset(img, 10, 2, [255, 255, 255]);
  pset(img, 6, 3, [20, 20, 20]);
  pset(img, 10, 3, [20, 20, 20]);
  outline(img, OUT);
  return img;
}

function paintFlyer(phase = 0) {
  const img = newImg(12, 8);
  const body = [44, 40, 60];
  const wing = [26, 24, 40];
  const flap = [-1, 0, 1, 1, 0, -1][phase]; // wings beat up → mid → down and back
  fillDisc(img, 6, 4, 2.4, body);
  fillRect(img, 0, 2 + flap, 4, 4 + flap, wing);
  fillRect(img, 8, 2 + flap, 12, 4 + flap, wing);
  pset(img, 1, 1 + flap * 2, wing); // wing tips lead the beat
  pset(img, 10, 1 + flap * 2, wing);
  pset(img, 7, 3, [255, 255, 255]); // eye
  outline(img, [120, 116, 140]); // light contour — the body is already near-black
  return img;
}

export const buildCrabStrip = () => strip([0, 1, 2, 3, 4, 5].map(paintCrab), 16, 10);
export const buildFlyerStrip = () => strip([0, 1, 2, 3, 4, 5].map(paintFlyer), 12, 8);

// --- goal portal (24×40 native, neutral grey, tinted theme.goal; 4-frame shimmer) ---------

function paintPortal(phase = 0) {
  const img = newImg(24, 40);
  // Pillars with brick seams + a lit inner edge.
  for (const [x0, x1] of [[1, 6], [18, 23]]) {
    fillRect(img, x0, 6, x1, 40, G.lo);
    for (let y = 10; y < 40; y += 5) fillRect(img, x0, y, x1, y + 1, G.lo2);
    fillRect(img, x0 === 1 ? 5 : 18, 6, x0 === 1 ? 6 : 19, 40, G.base);
  }
  // Arched crown.
  fillTrap(img, 0, 6, 11.5, 4.5, 11, G.lo);
  fillTrap(img, 0, 2, 11.5, 4.5, 6.5, G.hi);
  // Inner gateway glow: dithered bands flowing downward with the phase (tinted at runtime,
  // it shimmers in theme.goal). The band seams shift by phase so the light visibly travels.
  const shift = phase % 2;
  ditherRect(img, 6, 6, 18, 16 + shift, G.hi, 255, phase);
  ditherRect(img, 6, 16 + shift, 18, 28 + shift, G.base, 255, phase + 1);
  ditherRect(img, 7, 28 + shift, 17, 38, G.lo, 255, phase);
  outline(img, G.lo2);
  return img;
}

export const buildPortalStrip = () => strip([0, 1, 2, 3].map(paintPortal), 24, 40);

// --- spring mushroom (16×16, 3 frames: rest / squashed / extended) -----------------------

function paintSpring(phase = 0) {
  const img = newImg(16, 16);
  const cap = [231, 150, 173]; // rose cap — reads "bouncy", fits every theme
  const capDark = darken(cap, 0.8);
  const stem = [236, 228, 208];
  // Cap height by phase: rest, squashed flat, stretched tall.
  const capTop = [6, 9, 2][phase];
  const stemTop = [10, 12, 8][phase];
  fillRect(img, 6, stemTop, 10, 15, stem); // stem
  fillRect(img, 6, 14, 10, 15, darken(stem, 0.8));
  fillTrap(img, capTop, stemTop + 1, 7.5, 3.5, 6.5, cap); // cap
  fillRect(img, 1, stemTop - 1, 15, stemTop + 1, capDark); // cap rim
  pset(img, 5, capTop + 1, [255, 230, 238]); // sheen
  pset(img, 6, capTop + 1, [255, 230, 238]);
  pset(img, 10, capTop + 2, [255, 255, 255]); // dot
  outline(img, OUT);
  return img;
}

export const buildSpringStrip = () => strip([0, 1, 2].map(paintSpring), 16, 16);

// --- checkpoint flag (16×24, 4 frames waving) ---------------------------------------------

function paintFlag(phase = 0) {
  const img = newImg(16, 24);
  const pole = [120, 100, 80];
  const cloth = [212, 175, 55]; // gold pennant
  fillRect(img, 3, 1, 5, 23, pole);
  pset(img, 3, 0, [235, 220, 150]); // finial
  pset(img, 4, 0, [235, 220, 150]);
  // Waving pennant: tip rises and falls with the phase.
  const tipY = [4, 5, 6, 5][phase];
  const sag = [0, 1, 1, 0][phase];
  fillTrap(img, 2, 9 + sag, 5, 0.5, 0.5, cloth); // hoist edge (vertical band by the pole)
  for (let x = 5; x <= 13; x++) {
    const f = (x - 5) / 8;
    const top = Math.round(2 + (tipY - 2) * f + sag * Math.sin(f * Math.PI));
    fillRect(img, x, top, x + 1, top + Math.round(6 * (1 - f) + 1), cloth);
  }
  fillRect(img, 5, 8 + sag, 9, 9 + sag, darken(cloth, 0.8)); // shaded hem near the pole
  outline(img, OUT);
  return img;
}

export const buildFlagStrip = () => strip([0, 1, 2, 3].map(paintFlag), 16, 24);

// --- swooper: a lantern-ghost that dives (12×12, 4 frames, tail sway) -----------------------

function paintSwooper(phase = 0) {
  const img = newImg(12, 12);
  const body = [240, 214, 150]; // warm paper-lantern glow
  const trim = [150, 60, 60];
  const sway = [-1, 0, 1, 0][phase];
  fillDisc(img, 6, 5, 3.6, body);
  fillRect(img, 4, 1, 9, 2, trim); // little cap
  // Wisp tail trailing under it.
  pset(img, 6 + sway, 9, body);
  pset(img, 6 - sway, 10, body);
  pset(img, 6 + sway, 11, darken(body, 0.85));
  pset(img, 4, 5, [60, 40, 40]); // sleepy eyes
  pset(img, 8, 5, [60, 40, 40]);
  fillRect(img, 5, 7, 8, 8, darken(body, 0.8)); // mouth shadow
  outline(img, OUT);
  return img;
}

export const buildSwooperStrip = () => strip([0, 1, 2, 3].map(paintSwooper), 12, 12);

// --- roller: a chasing snowball (14×14, 6 rotation frames) ----------------------------------

function paintRoller(phase = 0) {
  const img = newImg(14, 14);
  const snow = [238, 244, 252];
  const shade = [196, 210, 230];
  fillDisc(img, 7, 7, 5.6, snow);
  fillDisc(img, 8.5, 8.5, 4, shade); // bottom-right shading
  fillDisc(img, 6, 6, 3.6, snow);
  // Rotating speckles show the spin (positions advance with the phase).
  const a = (phase / 6) * Math.PI * 2;
  for (const off of [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3]) {
    pset(img, Math.round(7 + Math.cos(a + off) * 3.4), Math.round(7 + Math.sin(a + off) * 3.4), shade);
  }
  pset(img, 5, 5, [255, 255, 255]); // glint
  outline(img, [150, 165, 190]); // soft outline — a black ring would read "bomb"
  return img;
}

export const buildRollerStrip = () => strip([0, 1, 2, 3, 4, 5].map(paintRoller), 14, 14);
