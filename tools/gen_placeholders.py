#!/usr/bin/env python3
"""Generate swap-ready placeholder assets for "The Princess Journey".

Uses only the Python standard library (no pip installs). Run once:

    python tools/gen_placeholders.py

Sprites: 64x64 RGBA PNGs (transparent background, solid color disc) -- the same
size and transparency the future skin-layering system expects (spec section 3).
Replace the files in assets/sprites with real art later, keeping the same
filenames (or update ASSETS in src/config.js).

Audio: a short, gentle WAV tone as the menu-music placeholder, plus a set of tiny
synthesized gameplay SFX (jump / collect / coin / oops / goal / win / select).
Replace the files in assets/audio later with real sound, keeping the filenames
(or update ASSETS.sounds in src/config.js if any extension changes).
"""

import math
import os
import struct
import wave
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPRITES_DIR = os.path.join(ROOT, "assets", "sprites")
AUDIO_DIR = os.path.join(ROOT, "assets", "audio")


def _png_chunk(tag: bytes, data: bytes) -> bytes:
    return (
        struct.pack(">I", len(data))
        + tag
        + data
        + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    )


def encode_png(width: int, height: int, pixels: bytearray) -> bytes:
    """pixels: RGBA bytes, length width*height*4."""
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)  # 8-bit RGBA
    stride = width * 4
    raw = bytearray()
    for y in range(height):
        raw.append(0)  # filter type 0 (none)
        raw.extend(pixels[y * stride : y * stride + stride])
    idat = zlib.compress(bytes(raw), 9)
    return sig + _png_chunk(b"IHDR", ihdr) + _png_chunk(b"IDAT", idat) + _png_chunk(b"IEND", b"")


def make_sprite_pixels(size: int, color) -> bytearray:
    """Transparent canvas with a filled disc of `color` (r, g, b)."""
    px = bytearray(size * size * 4)  # zero-filled => fully transparent
    cx = cy = (size - 1) / 2
    r = size / 2 - 2
    r2 = r * r
    for y in range(size):
        for x in range(size):
            dx, dy = x - cx, y - cy
            if dx * dx + dy * dy <= r2:
                i = (y * size + x) * 4
                px[i], px[i + 1], px[i + 2], px[i + 3] = color[0], color[1], color[2], 255
    return px


def _set(px: bytearray, size: int, x: int, y: int, color, alpha: int = 255) -> None:
    if 0 <= x < size and 0 <= y < size:
        i = (y * size + x) * 4
        px[i], px[i + 1], px[i + 2], px[i + 3] = color[0], color[1], color[2], alpha


def make_rect_pixels(size: int, color, x0: int, y0: int, x1: int, y1: int, alpha: int = 255) -> bytearray:
    """Transparent canvas with one filled rectangular region [x0,x1) x [y0,y1)."""
    px = bytearray(size * size * 4)
    for y in range(y0, y1):
        for x in range(x0, x1):
            _set(px, size, x, y, color, alpha)
    return px


def make_skirt_pixels(size: int, color) -> bytearray:
    """A trapezoid (narrow at the waist, wide at the hem) — the 'Gonna Reale' layer."""
    px = bytearray(size * size * 4)
    y0, y1, top_half, bot_half = 36, 60, 8, 26
    cx = (size - 1) / 2
    for y in range(y0, y1):
        f = (y - y0) / (y1 - y0)
        half = top_half + (bot_half - top_half) * f
        for x in range(size):
            if abs(x - cx) <= half:
                _set(px, size, x, y, color)
    return px


# Skin layers (spec §3): each on its own 64x64 transparent canvas, drawn in a distinct
# region/colour so the layering is visibly different stacked on the base body disc.
SKINS = [
    ("skirt.png", "skirt", (212, 175, 55)),       # royal gold trapezoid (lower body)
    ("bodice.png", "rect", (231, 150, 173), (18, 24, 46, 38)),   # rose torso block
    ("necklace.png", "rect", (255, 236, 170), (22, 20, 42, 24)), # light band at the neck
    ("crown.png", "rect", (212, 175, 55), (20, 4, 44, 14)),      # gold block at the top
]


def make_wav(path: str, seconds: float = 2.0, sample_rate: int = 22050, freq: float = 392.0) -> None:
    n = int(seconds * sample_rate)
    frames = bytearray()
    for i in range(n):
        t = i / sample_rate
        env = 0.25 * math.sin(math.pi * i / n)  # gentle fade in/out
        sample = math.sin(2 * math.pi * freq * t) * env
        frames.extend(struct.pack("<h", int(max(-1.0, min(1.0, sample)) * 0x7FFF)))
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        w.writeframes(bytes(frames))


# --- Sound effects (gameplay juiciness) -------------------------------------------
# Tiny synthesized WAVs (same stdlib-only approach as the bgm). Each is built from simple
# oscillators with a short anti-click attack/release and an optional exponential decay.

SFX_RATE = 22050


def _osc(phase: float, wave: str) -> float:
    if wave == "tri":
        return (2.0 / math.pi) * math.asin(math.sin(phase))
    if wave == "square":
        return 1.0 if math.sin(phase) >= 0 else -1.0
    if wave == "saw":
        x = phase / (2 * math.pi)
        return 2.0 * (x - math.floor(x + 0.5))
    return math.sin(phase)


def tone(freq, dur, vol=0.5, wave="sine", decay=0.0, f_end=None, sr=SFX_RATE):
    """One oscillator note. Accumulates phase (so f_end gives a clean pitch glide), with a
    short anti-click fade in/out and an optional exponential amplitude decay."""
    n = max(1, int(dur * sr))
    atk = max(1, int(0.004 * sr))
    rel = max(1, int(0.006 * sr))
    out = []
    phase = 0.0
    for i in range(n):
        f = freq if f_end is None else freq + (f_end - freq) * (i / max(1, n - 1))
        phase += 2 * math.pi * f / sr
        s = _osc(phase, wave) * vol
        if decay > 0:
            s *= math.exp(-decay * (i / sr))
        s *= min(1.0, i / atk)        # fade in
        s *= min(1.0, (n - i) / rel)  # fade out
        out.append(s)
    return out


def seq(*parts):
    out = []
    for p in parts:
        out.extend(p)
    return out


def mix(*parts):
    n = max(len(p) for p in parts)
    out = [0.0] * n
    for p in parts:
        for i, v in enumerate(p):
            out[i] += v
    return out


def normalize(samples, peak=0.85):
    m = max((abs(s) for s in samples), default=0.0)
    if m <= 1e-9:
        return samples
    g = peak / m
    return [s * g for s in samples]


def build_sfx():
    """{name: samples} for every gameplay sound. Frequencies are musical so the cues feel
    pleasant rather than beepy; the 'oops' is a soft downward glide (it's a gentle gift, not
    a harsh death sound), and 'coin' is a two-note arcade chime that fits the Insert-Coin gag."""
    return {
        "jump": tone(420, 0.13, vol=0.5, wave="tri", f_end=780, decay=6),
        "collect": seq(
            tone(1175, 0.05, vol=0.45, wave="sine"),
            tone(1568, 0.11, vol=0.5, wave="sine", decay=8),
        ),
        "coin": seq(
            tone(988, 0.07, vol=0.45, wave="tri"),
            tone(1319, 0.42, vol=0.45, wave="tri", decay=6),
        ),
        "oops": tone(659, 0.32, vol=0.5, wave="sine", f_end=415, decay=3),
        "goal": seq(
            tone(523, 0.08, vol=0.4, wave="tri"),
            tone(659, 0.08, vol=0.4, wave="tri"),
            tone(784, 0.08, vol=0.4, wave="tri"),
            tone(1047, 0.30, vol=0.5, wave="tri", decay=4),
        ),
        "win": seq(
            tone(523, 0.10, vol=0.4, wave="tri"),
            tone(659, 0.10, vol=0.4, wave="tri"),
            tone(784, 0.10, vol=0.4, wave="tri"),
            mix(
                tone(523, 0.70, vol=0.22, wave="sine", decay=2.2),
                tone(659, 0.70, vol=0.22, wave="sine", decay=2.2),
                tone(784, 0.70, vol=0.22, wave="sine", decay=2.2),
                tone(1047, 0.70, vol=0.22, wave="sine", decay=2.2),
            ),
        ),
        "select": seq(
            tone(784, 0.04, vol=0.32, wave="sine"),
            tone(1175, 0.07, vol=0.32, wave="sine", decay=12),
        ),
    }


def make_sfx(path: str, samples, sr: int = SFX_RATE) -> None:
    frames = bytearray()
    for s in samples:
        frames.extend(struct.pack("<h", int(max(-1.0, min(1.0, s)) * 0x7FFF)))
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(bytes(frames))


SPRITES = [
    ("anna.png", (167, 199, 231)),        # azzurro/lilla (piumino)
    ("sognatrice.png", (240, 198, 116)),  # warm gold (Belle/Ariel)
    ("avventuriera.png", (196, 122, 88)), # nomad terracotta
    ("logo.png", (212, 175, 55)),         # royal gold title mark
]


def main() -> None:
    os.makedirs(SPRITES_DIR, exist_ok=True)
    os.makedirs(AUDIO_DIR, exist_ok=True)

    for name, color in SPRITES:
        px = make_sprite_pixels(64, color)
        with open(os.path.join(SPRITES_DIR, name), "wb") as f:
            f.write(encode_png(64, 64, px))
        print("sprite ->", os.path.join("assets", "sprites", name))

    for entry in SKINS:
        name, kind, color = entry[0], entry[1], entry[2]
        if kind == "skirt":
            px = make_skirt_pixels(64, color)
        else:
            x0, y0, x1, y1 = entry[3]
            px = make_rect_pixels(64, color, x0, y0, x1, y1)
        with open(os.path.join(SPRITES_DIR, name), "wb") as f:
            f.write(encode_png(64, 64, px))
        print("skin   ->", os.path.join("assets", "sprites", name))

    make_wav(os.path.join(AUDIO_DIR, "menu-bgm.wav"))
    print("audio  ->", os.path.join("assets", "audio", "menu-bgm.wav"))

    for name, samples in build_sfx().items():
        path = os.path.join(AUDIO_DIR, f"{name}.wav")
        make_sfx(path, normalize(samples))
        print("sfx    ->", os.path.join("assets", "audio", f"{name}.wav"))

    print("\nDone. Placeholder assets generated.")


if __name__ == "__main__":
    main()
