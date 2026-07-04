---
name: regen-assets
description: Regenerate all sprites, tiles, backgrounds and audio for Pixel Princess Platformer from the pixel-art pipeline. Use when asked to regenerate, rebuild, or refresh the game's generated assets.
---

# Regenerate assets

Everything under `assets/` is generated **deterministically** by `tools/gen/` (Node built-ins
only — no install needed).

## Run
`npm run gen`   (= `node tools/gen/index.mjs`)

## Rules
- **Deterministic:** same input → same bytes. A clean re-run should leave `git status`
  unchanged unless a generator actually changed.
- **Don't hand-edit files in `assets/`** — they are outputs. Edit the generators instead:
  `tools/gen/{px,characters,world,backgrounds,audio,index}.mjs`.
- To swap in **real** art/audio, drop files into `assets/` keeping the same filenames; if an
  extension changes, update the path in the `ASSETS` map in `src/config.js` (single source of
  truth).
- After regenerating, sanity-check with `npm run test:levels` (boots each level + screenshots
  the themed art).
