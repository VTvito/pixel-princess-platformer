// index.mjs — asset pipeline orchestrator for "Pixel Princess Platformer".
// Run: `npm run gen` (or `node tools/gen/index.mjs`). Regenerates every game asset
// (16-bit pixel art + synthesized audio) deterministically — same input, same bytes.
//
// Output set and dimensions match what src/config.js ASSETS expects; art is authored at
// quarter resolution in the sibling modules and upscaled ×4 here (see px.mjs).

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { encodeScaled } from "./px.mjs";
import {
  HEROINES, SKIN_LAYERS, paintHeroine, paintSkin, paintLogo, paintAppIcon, buildSheet,
} from "./characters.mjs";
import {
  TILE_FRAMES, buildTileAtlas, buildSpinStrip,
  paintApple, paintPearl, paintLantern, paintCrystal, paintRose, paintGoblet,
  buildCrabStrip, buildFlyerStrip, buildPortalStrip,
  buildSpringStrip, buildFlagStrip, buildSwooperStrip, buildRollerStrip,
  paintHeart, paintHopper,
} from "./world.mjs";
import { DECOR } from "./decor.mjs";
import { BG_THEMES, buildSky, buildMid, buildNear } from "./backgrounds.mjs";
import { buildSfx, SONGS, encodeWav, normalize } from "./audio.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SPRITES_DIR = join(ROOT, "assets", "sprites");
const AUDIO_DIR = join(ROOT, "assets", "audio");
const TILES_DIR = join(ROOT, "assets", "tilesets");
const BG_DIR = join(ROOT, "assets", "backgrounds");
const ICONS_DIR = join(ROOT, "assets", "icons");

for (const d of [SPRITES_DIR, AUDIO_DIR, TILES_DIR, BG_DIR, ICONS_DIR]) mkdirSync(d, { recursive: true });

const writeSprite = (file, img) => {
  writeFileSync(join(SPRITES_DIR, file), encodeScaled(img));
  console.log("sprite ->", join("assets", "sprites", file));
};

// Heroines as 8×2 animation sheets (16×24 native cells → 64×96, layout in src/animspec.js).
for (const { file, look } of HEROINES) writeSprite(file, buildSheet((p) => paintHeroine(look, p)));
writeSprite("logo.png", paintLogo());

// Clothing skins — same sheet layout, same pose records, so the overlay layers stay in
// frame-sync with the body by construction.
for (const { file, kind, color } of SKIN_LAYERS) writeSprite(file, buildSheet((p) => paintSkin(kind, color, p)));

// World sprites as animation strips (frame counts in src/animspec.js WORLD_SHEETS):
// collectibles spin coin-style, the crab scuttles, the flyer beats its wings, the portal
// glow flows. Cell sizes equal the old single-frame sizes.
writeSprite("apple.png", buildSpinStrip(paintApple));
writeSprite("pearl.png", buildSpinStrip(paintPearl));
writeSprite("lantern.png", buildSpinStrip(paintLantern));
writeSprite("crystal.png", buildSpinStrip(paintCrystal));
writeSprite("rose.png", buildSpinStrip(paintRose));
writeSprite("goblet.png", buildSpinStrip(paintGoblet));
writeSprite("crab.png", buildCrabStrip());
writeSprite("flyer.png", buildFlyerStrip());
writeSprite("portal.png", buildPortalStrip());
writeSprite("spring.png", buildSpringStrip());
writeSprite("flag.png", buildFlagStrip());
writeSprite("swooper.png", buildSwooperStrip());
writeSprite("roller.png", buildRollerStrip());
// Single-frame arcade sprites (the runtime bobs the heart / squashes the toad — no strip).
writeSprite("heart.png", paintHeart());
writeSprite("hopper.png", paintHopper());

// Decor props — collider-free scenery, three per theme (placed by src/levels/build.js).
for (const [file, paint] of DECOR) writeSprite(file, paint());

// Tile atlas — one strip, frame offsets defined by TILE_FRAMES order (see config.js).
writeFileSync(join(TILES_DIR, "tileset.png"), encodeScaled(buildTileAtlas()));
console.log("tiles  ->", join("assets", "tilesets", "tileset.png"), `(frames: ${TILE_FRAMES.join(", ")})`);

// Parallax backgrounds: sky 1280×720 + mid 1920×480 + near 1920×360 per theme.
for (const name of Object.keys(BG_THEMES)) {
  writeFileSync(join(BG_DIR, `${name}_sky.png`), encodeScaled(buildSky(name)));
  writeFileSync(join(BG_DIR, `${name}_mid.png`), encodeScaled(buildMid(name)));
  writeFileSync(join(BG_DIR, `${name}_near.png`), encodeScaled(buildNear(name)));
  console.log("bg     ->", join("assets", "backgrounds", `${name}_{sky,mid,near}.png`));
}

// PWA / home-screen icons (manifest.webmanifest + index.html): the pixel princess raising the gold
// crown, on the gift's blue. Authored small and integer-upscaled like everything else, so the
// native size × scale must hit each target EXACTLY — 64×8=512, 64×3=192, 128×4=512.
// The apple-touch icon is emitted at 192 too (its <link> declares no `sizes`, and iOS happily
// scales any square), which is why one 64-native composition covers three of the four files.
// The maskable one is composed on a bigger canvas (128) around a bigger figure (×3) so the same
// art occupies a smaller share of the frame — that's how she lands inside Android's safe zone
// without fractional scaling. See paintAppIcon in characters.mjs.
const ICONS = [
  ["apple-touch-icon.png", paintAppIcon(64, 2), 3], // 192×192 — the icon iOS reads
  ["icon-192.png", paintAppIcon(64, 2), 3],
  ["icon-512.png", paintAppIcon(64, 2), 8],
  ["icon-512-maskable.png", paintAppIcon(128, 3), 4], // safe-zone framing for Android
];
for (const [file, img, scale] of ICONS) {
  writeFileSync(join(ICONS_DIR, file), encodeScaled(img, scale));
  console.log("icon   ->", join("assets", "icons", file));
}

// Audio: six chiptune loops (menu, finale, one per theme) + one-shot SFX (audio.mjs).
for (const [name, build] of Object.entries(SONGS)) {
  writeFileSync(join(AUDIO_DIR, `${name}.wav`), encodeWav(build()));
  console.log("music  ->", join("assets", "audio", `${name}.wav`));
}
for (const [name, samples] of Object.entries(buildSfx())) {
  writeFileSync(join(AUDIO_DIR, `${name}.wav`), encodeWav(normalize(samples)));
  console.log("sfx    ->", join("assets", "audio", `${name}.wav`));
}

console.log("\nDone. Pixel-art assets generated.");
