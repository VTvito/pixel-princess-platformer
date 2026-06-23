# CLAUDE.md — The Princess Journey

Quick reference for working in this repo. The user-facing guide is `README.md`; this
file is the agent/contributor playbook.

## What this is
- A **no-build** browser platformer. Kaplay is **vendored** (`vendor/kaplay-3001.0.19.mjs`)
  and imported directly — there is nothing to compile or bundle.
- One engine context only: `src/kaplayCtx.js` exports `k`; every module imports it. No globals.
- **`src/config.js` is the single source of truth** (GAME_W/H, PALETTE, CHARACTERS, SKINS,
  PHYSICS, MECHANICS, ENEMIES, POWERUP, ASSETS incl. the `fonts` manifest). Add tunables here,
  don't scatter constants.
- Levels are **data** (`src/levels/level1..6.js` + `build.js` + `mapkit.js`). Six playable
  levels; the finale (`src/scenes/finale.js`) is the non-playable "level 7" (`MAX_LEVEL = 7`).
- All DOM/HTML UI is isolated in `index.html`, `style.css`, `src/ui/*` — it must never touch
  the collision/gameplay logic in `src/scenes/game.js`.

## Commands (run the server first; never use `python -m http.server`)
```bash
python tools/serve.py 8137   # or npm run serve   (skill: /serve-game). MIME-correct ES modules.
npm test                     # smoke + features + levels (Playwright-core → installed Edge)
npm run test:mobile          # iPhone-landscape emulation (audio unlock, controls, fit, hint)
npm run gen                  # regenerate all assets (deterministic) — don't hand-edit assets/
npm run deploy               # prod deploy to Vercel (reads VERCEL_TOKEN from gitignored .env)
```

## Gotchas
- **Test flakiness (pre-existing, not regressions):** `air anim while jumping` and `spring
  launches the player` in `test:features` sample at frame boundaries and can flip pass/fail with
  identical code. Re-run before assuming a break.
- **iOS audio:** the `AudioContext` unlocks only on a **real DOM gesture**, handled by
  `src/audioUnlock.js` (window capture listener) — a Kaplay `onClick` runs in the rAF loop and
  does NOT count. If you change audio init, keep that gesture path.
- **Touch controls** show only with `body.playing` (toggled per scene). The four scenes set/
  clear it; keep that invariant or the D-pad reappears over the menu.
- **Fit:** `html, body` use `100dvh`; interactive UI uses `env(safe-area-inset-*)`. Don't
  revert to `height: 100%` (it clips under the iOS toolbar).
- **Mobile render density:** touch devices (`pointer: coarse`) use `pixelDensity: 1`
  (`src/kaplayCtx.js`); desktop keeps `min(dpr, 2)`. On a 3× iPhone the old 2× backbuffer was
  ~4× the fill-rate and made the game stutter — density 1 is smooth and, on nearest-neighbour
  pixel art, visually near-identical. Emulation can't measure this; confirm FPS on a real iPhone.
- **Emulation ≠ device:** Edge/Chromium can't reproduce WebKit audio quirks or the notch
  safe-area — real iOS audio/safe-area must be verified on a physical iPhone.
- **Dev handle:** `window.__pj` (engine + live virtual `input`) is attached **only on localhost**
  (`src/main.js`); tests drive the game through it. Never rely on it in shipped code.
- **Pixel UI font:** the Kaplay default font is `"pixel"` (`src/kaplayCtx.js`, loaded in
  `src/assets.js`, mirrored via `@font-face` in `style.css`). It has **no emoji/★ glyphs**, so a
  `k.text()` containing 👑 🍎 ✨ ★ must pass `font: "sans-serif"` per object (DOM falls back
  per-glyph on its own). The HUD name/level sit at x=88 to clear the top-left ⏸ pause button.
- **Pause = global freeze:** Esc / ⏸ sets `k.getTreeRoot().paused` and shows a **DOM** overlay
  (`src/ui/pauseMenu.js`, settings stacks above via `src/ui/settings.js`) so its buttons stay
  clickable while the world is frozen. Every exit (resume/restart/menu) unfreezes first, and the
  game scene resets `paused = false` on entry — never leak a paused tree into another scene.
- **Springs target semisolids, not solids:** a spring (`makeSpring`, `src/levels/build.js`)
  launches the heroine straight up via `player.bounce()`, which also **disarms the variable-
  height jump-cut** so the bounce is always its full height. The platform it lifts onto must be
  a one-way **semisolid** (`#`), never a solid `platforms` slab — a solid slab over a spring
  blocks the bounce from below (she bonks its underside). A reliable, higher arc also overshoots
  farther, so keep the bounce-landing clear of hazards.
- **Difficulty lives in level data, not enemy speed:** prefer tuning difficulty per-level over
  bumping global `ENEMIES` speeds (`CRAB_SPEED`/`FLY_SPEED`), which shifts every existing
  crab+thorn+gap cluster at once and is hard to reason about. Add enemies/hazards on flat
  stretches **clear of jump arcs and patrol ranges**, add 2-cell gaps (never >2 on the critical
  path — a single jump can't clear wider; there is no double jump), thin out checkpoints.
- **Service worker is prod-only:** `sw.js` is registered in `src/main.js` **only off localhost**,
  so it never caches stale files between Playwright runs / dev edits. On a real content change,
  bump `CACHE` in `sw.js` so clients fetch fresh. It now also **bypasses `/api/*`** (never caches
  the live leaderboard).
- **Arcade lives = a "partita":** start `LIVES.START` (3) lives, +1 per `H` heart (one per level,
  capped `LIVES.MAX`). A death spends a life **and** banks 500 Coccoline, respawning from the
  checkpoint; at 0 lives `die()` calls `resetRun()` (level→1, score→0, lives refilled, checkpoint
  cleared) and shows the **Game Over** overlay (`src/ui/gameOver.js`). `resetRun()` deliberately
  **keeps** `coccolineRun` + `totaleCoccoline` so the finale tallies every Coccolina across
  attempts — don't "fix" that; only "Nuova partita" wipes the bill (`resetCoccolineRun`). The
  checkpoint is **persisted** (`pj.checkpoint`) so an interruption resumes mid-level; the pause
  "Ricomincia il livello" sets `forceSpawn` to ignore it for that one entry.
- **Leaderboard degrades offline:** the global classifica goes through `api/leaderboard.js`
  (Vercel serverless → Upstash Redis). `src/leaderboard.js` swallows every error to `null`, so the
  finale/menu still work with **no `/api`** — exactly the Playwright setup (`tools/serve.py` serves
  statics only). Keep that graceful fallback or the test suite breaks.
- **New enemies/pickups can be primitive-drawn:** the hopper (`h`) and heart (`H`) are drawn from
  Kaplay primitives in `build.js` (like the star/feather), so they need **no `npm run gen`** and
  no `ASSETS.sprites` entry. Reach for the asset pipeline only when you actually want pixel art.

## Secrets / deploy
- `VERCEL_TOKEN` lives in a **gitignored + vercelignored `.env`**; `tools/deploy.mjs` reads it.
  Never commit `.env` or echo the token. After deploy, sanity-check `/.env` → 404 in prod.
- The leaderboard store is **Upstash Redis via the Vercel Marketplace** (free on Hobby); linking
  it injects `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (the function also accepts the
  legacy `KV_REST_API_*` names). Unset → endpoint replies 503 → leaderboard hides (game still
  ships). These are Vercel env vars, never committed.

## Conventions
- Match the surrounding style: detailed top-of-file header comments explaining the "why",
  generous inline comments at decision points. Italian for user-facing strings, English for code.
- When adding a level: add a data file + register it; reuse `build.js`/`mapkit.js`, don't write
  new rendering/collision code.
