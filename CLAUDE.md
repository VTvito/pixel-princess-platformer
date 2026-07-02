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
- **Canvas wrapper must be a real box, NOT `display: contents`:** the `<main#app>` landmark that
  wraps `#game` must keep a real viewport-sized box (`display: block; width: 100vw; height: 100dvh`).
  Kaplay derives the canvas backbuffer from the canvas's **parent** element's dimensions — a
  `display: contents` wrapper generates **no box (0×0)**, so Kaplay set a **0×0 backbuffer and the
  whole game rendered blank on desktop** (menu never drew; iOS happened to dodge it). `#game`'s
  `height: 100%` then resolves against that real box. Caught only by eye / a real render — the
  Playwright suite asserts scene/state via `__pj`, never pixels, so a blank canvas passes CI.
- **PWA resume = re-letterbox the canvas:** Kaplay recomputes its letterbox from
  `canvas.offsetWidth/Height` via a `ResizeObserver` on the canvas. On iOS, sending the installed
  PWA to Home and reopening it **in landscape** left a stale canvas size — only **two colour bands**
  showed (the `body` `#26325c` under a too-short `#game`) and the menu never loaded; rotating the
  phone was the only recovery (a real orientation change re-fires the observer). `src/viewportResync.js`
  (installed in `src/main.js`) fixes it: on every foreground signal (`visibilitychange`→visible,
  `pageshow`, `focus`) it pins the canvas to `window.innerWidth/Height` for one frame, then hands
  sizing back to the stylesheet — forcing the same recompute the rotation did, plus a delayed second
  pass (~300ms) for iOS's settling. **Keep this on resume** or the bands-on-reopen bug returns.
  Emulation can't reproduce the WebKit latch (`tools/test/mobile.mjs` only guards that the resync
  runs clean + leaves the canvas full-viewport) — confirm the real fix on a physical iPhone.
- **Mobile render density:** touch devices use `pixelDensity: 1` (`src/kaplayCtx.js`); desktop
  keeps `min(dpr, 2)`. On a 3× iPhone the old 2× backbuffer was ~4× the fill-rate and made the
  game stutter — density 1 is smooth and, on nearest-neighbour pixel art, visually near-identical.
  Touch is detected as `(pointer: coarse)` **OR** `navigator.maxTouchPoints > 0` (`coarsePointer`,
  exported) — the `maxTouchPoints` fallback is load-bearing: some iOS configs misreport `coarse`,
  and without the mobile path (density 1 + the two perf wins below) an iPhone crawls. Confirm on a
  real device with `?fps=1` (overlay shows fps / worst-frame / drawn-vs-total / maxFPS / dpr; the
  cap is URL-overridable via `?maxfps=N`, `0`=uncapped, for on-device A/B).
- **Mobile fluidity = draws AND colliders, not the fps cap:** on iOS WebKit the per-frame CPU
  cost of hundreds of objects (transform + collision) tanked a wide level to ~11fps while desktop
  was fine; the 60-cap was NOT the cause (capped vs uncapped measured identical). Two fixes, both
  load-bearing — don't undo them: (1) **off-screen culling** (`src/scenes/game.js`) toggles
  `hidden` on scenery/pickups/enemies > ¾-screen from the heroine — `hidden` skips DRAW only, so
  colliders/AI keep working; (2) **merged solid colliders** — `=` tiles render as visual-only
  `"scenery"` sprites (no per-tile body) and `buildSolidColliders` (`src/levels/build.js`) greedy-
  meshes them into a few big static bodies (culling alone didn't help here: it skips drawing, not
  collision). Net: same look + hitboxes, ~10× fewer draws and bodies. **Never re-add a per-tile
  `area()`/`body()` to `=` tiles** — it reintroduces the collision-cost regression.
- **Frame-cap is per-STATE, mutated at runtime (thermal, not fluidity):** even at a steady
  60fps the game kept **redrawing 60×/s while nothing moved** — sitting on the menu, paused
  behind a DOM overlay, on the reward/finale screens — which cooked the iPhone GPU for no
  gameplay. Fix: `setFrameCap(cap)` (`src/kaplayCtx.js`) re-caps the loop **live** by mutating
  the very options object Kaplay reads each frame (the loop does `gopt.maxFPS ? 1/gopt.maxFPS
  : 0` — it never clones it, so the options MUST stay a named `gameOpts` const, NOT an inline
  literal). Each scene/state re-asserts its cap on entry, so no global state to leak: **active
  play → `maxFPS`** (60 mobile / uncapped desktop — the feel is untouched), **menu / finale /
  loading / reward overlay → `PERF.IDLE_FPS` (30)**, **pause + Insert-Coin/Game-Over (world
  frozen) → `PERF.FROZEN_FPS` (10)**. It changes only the render rate, never the fixed physics
  dt, so throttling an idle scene can't alter behaviour. `PERF` lives in `src/config.js`; the
  `?maxfps=N` override still wins for active play (idle/frozen stay fixed). **This is deliberately
  NOT a 60→30 cut during real play** — a platformer at 30 feels worse, so in-play stays full;
  the win is purely the standing-still states. Confirm on a real iPhone with `?fps=1` (menu ~30,
  in-level 60, paused ~10). Also **mobile trims momentary overdraw**: confetti bursts 8 (vs 14)
  and slightly fewer ambient particles under `coarsePointer` — invisible, shaves peak fill.
- **Active-play cap is REFRESH-AWARE (fixes jump judder on 60Hz):** the old fixed 60 cap on every
  touch device was the wrong call on a **60Hz** panel (many non-Pro iPhones, touch laptops). The
  loop renders only when `accumulated > 1/maxFPS`; when the cap ≈ the refresh, timing jitter
  periodically fails that check and **skips a frame** → micro-stutter, worst during a jump's smooth
  arc (the exact "salti meno fluidi" report). A 60Hz panel is already smooth **uncapped** (and can't
  exceed 60), so the cap there was pure downside. `measureRefreshAndTuneCap` (`src/kaplayCtx.js`)
  samples the real refresh at boot (during loading/menu, both throttled to `IDLE_FPS`, so it lands
  before the first level) and sets the active cap: **≤70Hz → uncapped**, **>70Hz (ProMotion) → cap
  ≈ half the refresh, nudged up a hair** so the accumulator reliably renders every 2nd frame (the
  even, tamed 60 that ProMotion needs — the case this note used to defend, preserved). `maxFPS` is
  now an **`export let`** (live binding) retuned by the probe; scenes read it on entry via
  `setFrameCap`. `?maxfps=N` still wins outright (no auto-tune). This resolves the old "open
  question" about the 60-cap on ProMotion: cap only when the refresh actually warrants it.
- **Emulation ≠ device:** Edge/Chromium can't reproduce WebKit audio quirks or the notch
  safe-area — real iOS audio/safe-area must be verified on a physical iPhone.
- **Dev handle:** `window.__pj` (engine + live virtual `input`) is attached **only on localhost**
  (`src/main.js`); tests drive the game through it. Never rely on it in shipped code.
- **Pixel UI font:** the Kaplay default font is `"pixel"` (`src/kaplayCtx.js`, loaded in
  `src/assets.js`, mirrored via `@font-face` in `style.css`). It has **no emoji/★ glyphs**, so a
  `k.text()` containing 👑 🍎 ✨ ★ must pass `font: "sans-serif"` per object (DOM falls back
  per-glyph on its own). The HUD name/level **and the 🍎/★/♥ counters below them** sit at x=88,
  a single left column that clears the top-left ⏸ pause button. **Keep the counters on the left:**
  they used to be top-right anchored, but the right corner holds the DOM audio toggles (🎵/🔊,
  `position:fixed`, always painted **above** the canvas regardless of `z`), and with letterboxing
  the music button overhangs the canvas edge and covers a right-anchored counter — moving them into
  the proven left column (same trick as the name) sidesteps the canvas↔DOM coordinate mismatch.
  **Long-form prose also overrides to `font: "sans-serif"`** — the pixel font is hard to read for
  running text at small sizes, so the finale letter (`src/scenes/finale.js`) and the menu character
  descriptions (`src/scenes/menu.js`) use sans-serif; short labels (name/tagline/buttons) stay pixel.
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
- **Final boss "Custode di Pietra" (`makeBoss`, `build.js`; tile `G`, `level6.js` climax):** a
  bespoke multi-phase guardian, deliberately **softlock-proof** — keep it that way. It is tagged
  **`"boss"`, NOT `"enemy"`**, so its body is **harmless to touch**: only the transient `"hazard"`
  it spawns (a ground **shockwave** to jump + telegraphed falling **debris**, both also tagged
  `"boss-attack"`) can hurt her. A dedicated **`player.onCollideUpdate("boss")`** in `game.js`
  damages it **only on a stomp during its vulnerable window** (`boss.invulnerable === false`);
  **`BOSS.HP` is 3** so felling it takes 3 stomps; each hit enrages it (`hp`-derived, but the window
  length is **fixed** so it stays beatable). **Why `onCollideUpdate`, not `onCollide`:** the boss's
  tall hitbox during the window sits just below the single-jump apex, so a jump from the floor
  **enters the hitbox while still rising** — the one-shot `onCollide`-*enter* event fired on the way
  up (not a stomp), and since her apex never cleared the top to re-separate, no fresh enter fired on
  the way down, so the stomp was **never registered** (the boss felt impossible to hit). Checking
  every overlapping frame catches the descent; after a hit the retreat + bounce make the next frame
  a non-stomp, so it's still **one hit per window**. Its phase loop is **deterministic** (not
  player-position-driven) so the window always recurs. **Felled, it drops the ballroom KEY**
  (`spawnKey`, `build.js`) on the flat arena floor; the heroine must grab it. It **gates the goal**:
  `onCollide("goal")` early-returns while `k.get("boss").length > 0` **or the key isn't taken yet**
  — no physical wall (nothing to wedge behind), and both the boss and the key are guaranteed
  reachable, so the gate can't deadlock. `makeBoss` derives its hover/window heights from the arena
  **floor it scans below** (`case "G"`), tuned to the single-jump apex (~148px), and exposes
  `boss.floorY` so the scene can rest the key on the floor. Tunables live in `config.BOSS`; coverage
  in `tools/test/boss.mjs`. (The old optional sneak-past Gargoyle is gone — this replaces it.)
- **Service worker is prod-only + auto-fresh:** `sw.js` is registered in `src/main.js` **only off
  localhost**, so it never caches stale files between Playwright runs / dev edits. It **bypasses
  `/api/*`** (never caches the live leaderboard). Freshness model so an **installed PWA always runs
  the latest deploy** (no more hand-bumping `CACHE`): the app **code** (navigations + `.js`/`.mjs`/
  `.css`) is **network-first** (newest when online, cache only offline); heavy **media** (assets/
  fonts/vendor) is **cache-first**. `tools/deploy.mjs` **auto-stamps a unique id into `CACHE`** right
  before each deploy (then restores the template) so every deploy ships a byte-different `sw.js` →
  browser installs the new worker → `skipWaiting`+`clients.claim` activate it → `activate` purges the
  old cache. `vercel.json` sets `Cache-Control: no-cache` on `/sw.js`, `/`, `/index.html`,
  `/manifest.webmanifest`, `/src/*` so the HTTP layer revalidates the code. `main.js` calls
  `reg.update()` on load + on foreground and does a **guarded one-time `location.reload()` on
  `controllerchange`** (only if a controller already existed at load) so an open session switches to
  the fresh code near startup. **Don't** revert code fetches to cache-first — installed apps would go
  stale again.
- **Arcade lives = a "partita":** start `LIVES.START` (3) lives, +1 per `H` heart (on
  **Livelli 3, 5 & 6** — the other levels' hearts were removed so lives stay scarce across a
  run; don't re-add them without a reason. L6's heart is the exception's exception: the castle is
  the hardest chapter and ends in the boss fight, so it grants one extra life on the run-up), capped `LIVES.MAX`. A death spends a life **and** banks 500 Coccoline, respawning from the
  checkpoint; at 0 lives `die()` calls `resetRun()` (level→1, score→0, lives refilled, checkpoint
  cleared) and shows the **Game Over** overlay (`src/ui/gameOver.js`). `resetRun()` deliberately
  **keeps** `coccolineRun` + `totaleCoccoline` so the finale tallies every Coccolina across
  attempts — don't "fix" that; only "Nuova partita" wipes the bill (`resetCoccolineRun`). The
  checkpoint is **persisted** (`pj.checkpoint`) so an interruption resumes mid-level; the pause
  "Ricomincia il livello" sets `forceSpawn` to ignore it for that one entry. A grabbed `H` heart
  is **remembered per run** (`pj.heartsTaken`, `state.js`) and `buildLevel` skips respawning it —
  otherwise a heart sitting past a checkpoint is re-grabbed on every death (+1) for every death
  (-1), an infinite-life loop. Cleared by `resetRun`/`resetProgress` so a fresh run hands it out.
- **Leaderboard degrades offline:** the global classifica goes through `api/leaderboard.js`
  (Vercel serverless → Upstash Redis). `src/leaderboard.js` swallows every error to `null`, so the
  finale/menu still work with **no `/api`** — exactly the Playwright setup (`tools/serve.py` serves
  statics only). Keep that graceful fallback or the test suite breaks.
- **Primitive vs pixel-art world objects:** the **star** (`*`) and **feather** (`+`) are still
  drawn from Kaplay primitives in `build.js` (a polygon + halo) — no `npm run gen`, no
  `ASSETS.sprites` entry. The **heart** (`H`) and **hopper/Rospo** (`h`) USED to be primitives too
  but now use real pixel-art sprites (`tools/gen/world.mjs` `paintHeart`/`paintHopper`, single
  frame; `ASSETS.sprites.heart`/`.hopper`) so they match the rest of the world — `build.js` draws
  them with `k.sprite(...)` while keeping the same collider/tags and the runtime bob/squash. So:
  reach for primitives for quick generic shapes, the asset pipeline (`npm run gen`) when you want
  pixel art that sits beside the tiles/enemies.

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
