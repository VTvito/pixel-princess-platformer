// index.mjs — asset pipeline orchestrator for "The Princess Journey".
// Run: `npm run gen` (or `node tools/gen/index.mjs`). Regenerates every game asset
// (16-bit pixel art + synthesized audio) deterministically — same input, same bytes.
//
// Output set and dimensions match what src/config.js ASSETS expects; art is authored at
// quarter resolution in the sibling modules and upscaled ×4 here (see px.mjs).

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { encodeScaled } from "./px.mjs";
import { HEROINES, SKIN_LAYERS, paintHeroine, paintSkin, paintLogo, buildSheet } from "./characters.mjs";
import {
  TILE_FRAMES, buildTileAtlas,
  paintApple, paintPearl, paintLantern, paintCrystal,
  paintCrab, paintFlyer, paintPortal,
} from "./world.mjs";
import { BG_THEMES, buildSky, buildMid, buildNear } from "./backgrounds.mjs";
import { buildSfx, buildMenuMusic, buildGameMusic, encodeWav, normalize } from "./audio.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SPRITES_DIR = join(ROOT, "assets", "sprites");
const AUDIO_DIR = join(ROOT, "assets", "audio");
const TILES_DIR = join(ROOT, "assets", "tilesets");
const BG_DIR = join(ROOT, "assets", "backgrounds");

for (const d of [SPRITES_DIR, AUDIO_DIR, TILES_DIR, BG_DIR]) mkdirSync(d, { recursive: true });

const writeSprite = (file, img) => {
  writeFileSync(join(SPRITES_DIR, file), encodeScaled(img));
  console.log("sprite ->", join("assets", "sprites", file));
};

// Heroines as 8×2 animation sheets (16×24 native cells → 64×96, layout in src/animspec.js).
for (const { file, look } of HEROINES) writeSprite(file, buildSheet((p) => paintHeroine(look, p)));
writeSprite("logo.png", paintLogo());

// Clothing skins — same sheet layout, same pose records, so the overlay layers stay in
// frame-sync with the body by construction (spec §3).
for (const { file, kind, color } of SKIN_LAYERS) writeSprite(file, buildSheet((p) => paintSkin(kind, color, p)));

// World sprites: collectibles, enemies, the goal portal.
writeSprite("apple.png", paintApple());
writeSprite("pearl.png", paintPearl());
writeSprite("lantern.png", paintLantern());
writeSprite("crystal.png", paintCrystal());
writeSprite("crab.png", paintCrab());
writeSprite("flyer.png", paintFlyer());
writeSprite("portal.png", paintPortal());

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

// Audio: looping music + one-shot SFX (unchanged synth, see audio.mjs).
writeFileSync(join(AUDIO_DIR, "menu-bgm.wav"), encodeWav(buildMenuMusic()));
writeFileSync(join(AUDIO_DIR, "game-bgm.wav"), encodeWav(buildGameMusic()));
console.log("audio  ->", join("assets", "audio", "{menu,game}-bgm.wav"));
for (const [name, samples] of Object.entries(buildSfx())) {
  writeFileSync(join(AUDIO_DIR, `${name}.wav`), encodeWav(normalize(samples)));
  console.log("sfx    ->", join("assets", "audio", `${name}.wav`));
}

console.log("\nDone. Pixel-art assets generated.");
