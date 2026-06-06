// gen-placeholders.mjs
// Generates swap-ready placeholder assets for "The Princess Journey" using only
// Node built-ins (no npm dependencies). Run once: `node tools/gen-placeholders.mjs`.
//
// Sprites: 64x64 RGBA PNGs (transparent background, solid color disc) — same size and
// transparency the future skin-layering system expects (see spec §3). Replace the files
// in assets/sprites with real art later; keep the same filenames (or update ASSETS in
// src/config.js).
//
// Audio: a short, gentle WAV tone for the menu music placeholder. Replace
// assets/audio/menu-bgm.wav with a real track later (update the extension in
// src/config.js ASSETS if it changes).

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SPRITES_DIR = join(ROOT, "assets", "sprites");
const AUDIO_DIR = join(ROOT, "assets", "audio");

// ---------------------------------------------------------------------------
// PNG encoding (RGBA, 8-bit) — minimal, spec-compliant encoder.
// ---------------------------------------------------------------------------
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

// pixels: Uint8Array of length w*h*4 (RGBA)
function encodePNG(width, height, pixels) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Raw image data with a filter byte (0 = none) prepended to each scanline.
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    pixels.subarray(y * stride, y * stride + stride).forEach((v, i) => {
      raw[y * (stride + 1) + 1 + i] = v;
    });
  }

  const idat = deflateSync(raw);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// Draws a filled circle of `color` ([r,g,b]) on a transparent canvas.
function makeSpritePixels(size, color) {
  const px = new Uint8Array(size * size * 4); // all zero = transparent
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;
  const r = size / 2 - 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r * r) {
        const i = (y * size + x) * 4;
        px[i] = color[0];
        px[i + 1] = color[1];
        px[i + 2] = color[2];
        px[i + 3] = 255;
      }
    }
  }
  return px;
}

function setPx(px, size, x, y, color, alpha = 255) {
  if (x < 0 || x >= size || y < 0 || y >= size) return;
  const i = (y * size + x) * 4;
  px[i] = color[0];
  px[i + 1] = color[1];
  px[i + 2] = color[2];
  px[i + 3] = alpha;
}

// Transparent canvas with one filled rectangular region [x0,x1) x [y0,y1).
function makeRectPixels(size, color, x0, y0, x1, y1, alpha = 255) {
  const px = new Uint8Array(size * size * 4);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) setPx(px, size, x, y, color, alpha);
  return px;
}

// A trapezoid (narrow waist, wide hem) — the "Gonna Reale" layer.
function makeSkirtPixels(size, color) {
  const px = new Uint8Array(size * size * 4);
  const y0 = 36, y1 = 60, topHalf = 8, botHalf = 26;
  const cx = (size - 1) / 2;
  for (let y = y0; y < y1; y++) {
    const f = (y - y0) / (y1 - y0);
    const half = topHalf + (botHalf - topHalf) * f;
    for (let x = 0; x < size; x++) if (Math.abs(x - cx) <= half) setPx(px, size, x, y, color);
  }
  return px;
}

// ---------------------------------------------------------------------------
// WAV encoding (16-bit PCM mono) — a soft fading sine tone as a music placeholder.
// ---------------------------------------------------------------------------
function makeWav({ seconds = 2, sampleRate = 22050, freq = 440 } = {}) {
  const n = Math.floor(seconds * sampleRate);
  const data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const env = 0.25 * Math.sin((Math.PI * i) / n); // fade in/out, gentle volume
    const sample = Math.sin(2 * Math.PI * freq * t) * env;
    data.writeInt16LE(Math.max(-1, Math.min(1, sample)) * 0x7fff, i * 2);
  }

  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write("data", 36, "ascii");
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

// ---------------------------------------------------------------------------
// Generate everything.
// ---------------------------------------------------------------------------
mkdirSync(SPRITES_DIR, { recursive: true });
mkdirSync(AUDIO_DIR, { recursive: true });

const SPRITES = [
  { name: "anna.png", color: [167, 199, 231] },         // azzurro/lilla (piumino)
  { name: "sognatrice.png", color: [240, 198, 116] },   // warm gold (Belle/Ariel)
  { name: "avventuriera.png", color: [196, 122, 88] },  // nomad terracotta
  { name: "logo.png", color: [212, 175, 55] },          // royal gold title mark
];

for (const s of SPRITES) {
  const px = makeSpritePixels(64, s.color);
  writeFileSync(join(SPRITES_DIR, s.name), encodePNG(64, 64, px));
  console.log("sprite ->", join("assets", "sprites", s.name));
}

// Skin layers (spec §3): distinct region/colour per layer, drawn on a transparent canvas.
const SKINS = [
  { name: "skirt.png", kind: "skirt", color: [212, 175, 55] },
  { name: "bodice.png", kind: "rect", color: [231, 150, 173], rect: [18, 24, 46, 38] },
  { name: "necklace.png", kind: "rect", color: [255, 236, 170], rect: [22, 20, 42, 24] },
  { name: "crown.png", kind: "rect", color: [212, 175, 55], rect: [20, 4, 44, 14] },
];

for (const s of SKINS) {
  const px =
    s.kind === "skirt" ? makeSkirtPixels(64, s.color) : makeRectPixels(64, s.color, ...s.rect);
  writeFileSync(join(SPRITES_DIR, s.name), encodePNG(64, 64, px));
  console.log("skin   ->", join("assets", "sprites", s.name));
}

writeFileSync(join(AUDIO_DIR, "menu-bgm.wav"), makeWav({ seconds: 2, freq: 392 }));
console.log("audio  ->", join("assets", "audio", "menu-bgm.wav"));

console.log("\nDone. Placeholder assets generated.");
