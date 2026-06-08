// gen-placeholders.mjs
// Generates swap-ready placeholder assets for "The Princess Journey" using only
// Node built-ins (no npm dependencies). Run once: `node tools/gen-placeholders.mjs`.
//
// Sprites: 64x64 RGBA PNGs (transparent background, solid color disc) — same size and
// transparency the future skin-layering system expects (see spec §3). Replace the files
// in assets/sprites with real art later; keep the same filenames (or update ASSETS in
// src/config.js).
//
// Audio: a short, gentle WAV tone for the menu music placeholder, plus tiny synthesized
// gameplay SFX (jump / collect / coin / oops / goal / win / select). Replace the files in
// assets/audio later with real sound, keeping the filenames (or update ASSETS.sounds in
// src/config.js if an extension changes).

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
// Sound effects — tiny synthesized WAVs (mirrors tools/gen_placeholders.py). Simple
// oscillators with a short anti-click fade in/out and an optional exponential decay.
// ---------------------------------------------------------------------------
const SFX_RATE = 22050;

function osc(phase, wave) {
  if (wave === "tri") return (2 / Math.PI) * Math.asin(Math.sin(phase));
  if (wave === "square") return Math.sin(phase) >= 0 ? 1 : -1;
  if (wave === "saw") {
    const x = phase / (2 * Math.PI);
    return 2 * (x - Math.floor(x + 0.5));
  }
  return Math.sin(phase);
}

function tone(freq, dur, { vol = 0.5, wave = "sine", decay = 0, fEnd = null, sr = SFX_RATE } = {}) {
  const n = Math.max(1, Math.floor(dur * sr));
  const atk = Math.max(1, Math.floor(0.004 * sr));
  const rel = Math.max(1, Math.floor(0.006 * sr));
  const out = new Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const f = fEnd === null ? freq : freq + (fEnd - freq) * (i / Math.max(1, n - 1));
    phase += (2 * Math.PI * f) / sr;
    let s = osc(phase, wave) * vol;
    if (decay > 0) s *= Math.exp(-decay * (i / sr));
    s *= Math.min(1, i / atk); // fade in
    s *= Math.min(1, (n - i) / rel); // fade out
    out[i] = s;
  }
  return out;
}

const seq = (...parts) => parts.flat();

function mix(...parts) {
  const n = Math.max(...parts.map((p) => p.length));
  const out = new Array(n).fill(0);
  for (const p of parts) for (let i = 0; i < p.length; i++) out[i] += p[i];
  return out;
}

function normalize(samples, peak = 0.85) {
  let m = 0;
  for (const s of samples) m = Math.max(m, Math.abs(s));
  if (m <= 1e-9) return samples;
  const g = peak / m;
  return samples.map((s) => s * g);
}

function buildSfx() {
  return {
    jump: tone(420, 0.13, { vol: 0.5, wave: "tri", fEnd: 780, decay: 6 }),
    collect: seq(tone(1175, 0.05, { vol: 0.45 }), tone(1568, 0.11, { vol: 0.5, decay: 8 })),
    coin: seq(
      tone(988, 0.07, { vol: 0.45, wave: "tri" }),
      tone(1319, 0.42, { vol: 0.45, wave: "tri", decay: 6 }),
    ),
    oops: tone(659, 0.32, { vol: 0.5, fEnd: 415, decay: 3 }),
    goal: seq(
      tone(523, 0.08, { vol: 0.4, wave: "tri" }),
      tone(659, 0.08, { vol: 0.4, wave: "tri" }),
      tone(784, 0.08, { vol: 0.4, wave: "tri" }),
      tone(1047, 0.3, { vol: 0.5, wave: "tri", decay: 4 }),
    ),
    win: seq(
      tone(523, 0.1, { vol: 0.4, wave: "tri" }),
      tone(659, 0.1, { vol: 0.4, wave: "tri" }),
      tone(784, 0.1, { vol: 0.4, wave: "tri" }),
      mix(
        tone(523, 0.7, { vol: 0.22, decay: 2.2 }),
        tone(659, 0.7, { vol: 0.22, decay: 2.2 }),
        tone(784, 0.7, { vol: 0.22, decay: 2.2 }),
        tone(1047, 0.7, { vol: 0.22, decay: 2.2 }),
      ),
    ),
    select: seq(tone(784, 0.04, { vol: 0.32 }), tone(1175, 0.07, { vol: 0.32, decay: 12 })),
  };
}

function encodeWav(samples, sampleRate = SFX_RATE) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    data.writeInt16LE(Math.max(-1, Math.min(1, samples[i])) * 0x7fff, i * 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
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

for (const [name, samples] of Object.entries(buildSfx())) {
  writeFileSync(join(AUDIO_DIR, `${name}.wav`), encodeWav(normalize(samples)));
  console.log("sfx    ->", join("assets", "audio", `${name}.wav`));
}

console.log("\nDone. Placeholder assets generated.");
