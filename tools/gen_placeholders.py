#!/usr/bin/env python3
"""Generate swap-ready placeholder assets for "The Princess Journey".

Uses only the Python standard library (no pip installs). Run once:

    python tools/gen_placeholders.py

Sprites: 64x64 RGBA PNGs (transparent background, solid color disc) -- the same
size and transparency the future skin-layering system expects (spec section 3).
Replace the files in assets/sprites with real art later, keeping the same
filenames (or update ASSETS in src/config.js).

Audio: a short, gentle WAV tone as the menu-music placeholder. Replace
assets/audio/menu-bgm.wav with a real track later (update the extension in
src/config.js ASSETS if it changes).
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
    print("\nDone. Placeholder assets generated.")


if __name__ == "__main__":
    main()
