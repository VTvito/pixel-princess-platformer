# CLAUDE.md — Pixel Princess Platformer

Agent/contributor playbook. `README.md` is the user-facing guide.

**How to use this file:** it lists the **invariants** — rules that look arbitrary and get "cleaned
up" into regressions. Each points at the file whose **header comment carries the full story**
(symptom, root cause, why the fix works). Read that header before changing the thing. Don't
re-narrate those stories here; the repo's convention is that the "why" lives next to the code.

## What this is
- **No-build** browser platformer. Kaplay is **vendored** (`vendor/kaplay-3001.0.19.mjs`) — nothing
  to compile or bundle.
- One engine context: `src/kaplayCtx.js` exports `k`; every module imports it. No globals.
- **`src/config.js` is the single source of truth** for tunables (GAME_W/H, PALETTE, CHARACTERS,
  SKINS, PHYSICS, MECHANICS, ENEMIES, POWERUP, PERF, BOSS, LIVES, ASSETS). Don't scatter constants.
- Levels are **data** (`src/levels/level1..6.js` + `build.js` + `mapkit.js`). Six playable levels;
  the finale (`src/scenes/finale.js`) is the non-playable "level 7" (`MAX_LEVEL = 7`).
- DOM/HTML UI is isolated in `index.html`, `style.css`, `src/ui/*` — it must never touch the
  collision/gameplay logic in `src/scenes/game.js`.
- Assets are **generated** (`npm run gen`, deterministic). Never hand-edit `assets/`.

## Commands (start the server first; never `python -m http.server`)
```bash
python tools/serve.py 8137   # or npm run serve  (skill: /serve-game). MIME-correct ES modules.
npm test                     # smoke + features + levels + boss (Playwright-core → installed Edge)
npm run test:mobile          # iPhone-landscape emulation (audio, controls, fit, resume, rotation)
npm run gen                  # regenerate every sprite/tile/bg/sfx
npm run deploy               # prod deploy to Vercel (VERCEL_TOKEN from the gitignored .env)
```

## Testing notes
- **Known flaky, not regressions:** `air anim while jumping` and `spring launches the player`
  sample at frame boundaries and can flip with identical code. Re-run before assuming a break.
- The suite asserts scene/state through `window.__pj`, **never pixels** — a blank canvas passes CI.
  Look at the game after render-path changes.
- `window.__pj` is attached **only on localhost** (`src/main.js`). Never rely on it in shipped code.
- **Emulation ≠ device.** Chromium can't reproduce WebKit's audio quirks, the notch safe-area, the
  stale-canvas latch, or iOS Screen-Time accounting. Anything marked *iPhone* below is asserted
  only at the mechanism level in `tools/test/mobile.mjs` — confirm the real win on a physical phone.

## Invariants

### Viewport / canvas (iOS) — see `src/viewportResync.js`, `src/backgroundFreeze.js`
- **`main#app` must be a real box** (`display: block; width: 100vw; height: 100dvh`), NOT
  `display: contents`. Kaplay sizes the backbuffer from the canvas's **parent**; a box-less wrapper
  gives 0×0 → the whole game renders blank.
- **`100dvh`, not `height: 100%`** on `html, body` (clips under the iOS toolbar); interactive UI
  uses `env(safe-area-inset-*)`.
- **Resync the canvas on resume AND on rotation.** Kaplay's `ResizeObserver` early-returns on an
  unchanged box and defers its recompute to the next input tick, so a stale letterbox has nobody to
  fix it → the game came back as two colour bands, or froze until you rotated twice. `viewportResync`
  pins the canvas to the live viewport and releases it, on a staged schedule, with the frame cap
  temporarily lifted. **Keep every listener it registers** (visibility/pageshow/focus + orientation/
  resize).
- **Background = freeze the tree + suspend the AudioContext** (an installed PWA otherwise racked up
  *hours* of phantom iOS Screen Time and kept the run clock ticking). On return, restore the
  **snapshotted** `paused` — a manually paused game must stay paused. `thaw()` also hangs off
  `pageshow`/`focus`: a `hidden` with no matching `visible` would lock the screen up forever.

### Performance — see `src/kaplayCtx.js`, and the culling block in `src/scenes/game.js`
- **Mobile render path is load-bearing.** `pixelDensity: 1` on touch (desktop keeps `min(dpr, 2)`);
  touch is detected as `(pointer: coarse)` **OR** `navigator.maxTouchPoints > 0` — some iOS configs
  misreport `coarse`, and without this path an iPhone crawls.
- **Never re-add `area()`/`body()` to `=` tiles.** They're visual-only `"scenery"`; solid collision
  comes from `buildSolidColliders` (`src/levels/build.js`), which greedy-meshes them into a few big
  static bodies. Plus off-screen culling toggles `hidden` (draw only — colliders/AI keep running).
  Together: ~10× fewer draws and bodies. This, not the fps cap, was the mobile stutter.
- **The frame cap is per-STATE and mutated live** via `setFrameCap` — which mutates the very options
  object Kaplay reads each frame, so `gameOpts` must stay a **named const**, never an inline literal.
  Active play → `maxFPS`; menu/finale/loading → `PERF.IDLE_FPS`; pause/game-over → `PERF.FROZEN_FPS`.
  It changes the render rate only, never the physics dt. **In-play is deliberately not throttled.**
- **The active cap is refresh-aware** (`measureRefreshAndTuneCap`): ≤70Hz → uncapped (a 60Hz panel
  beats against a 60 cap and judders on jumps); >70Hz ProMotion → ~half the refresh. `maxFPS` is an
  `export let` retuned by the probe. `?maxfps=N` overrides; `?fps=1` shows the on-device overlay.

### Audio — see `src/audioUnlock.js`, `src/ui/audioToggle.js`
- **iOS unlocks the `AudioContext` only on a real DOM gesture** (window capture listener). A Kaplay
  `onClick` runs in the rAF loop and does **not** count. Keep that gesture path.
- **One 🔊/🔇 button** flips both buses together; "on" = either bus live. The muted state changes the
  **glyph and the colour** (crimson) — not just opacity, which read as "off? maybe?". `src/audio.js`
  still keeps the buses (and their two volume sliders) independent; the button never touches
  `pj.musicVol`/`pj.sfxVol`, so unmuting restores her chosen levels.

### UI
- **Pause = global freeze:** Esc / ⏸ sets `k.getTreeRoot().paused` and shows a **DOM** overlay
  (`src/ui/pauseMenu.js`) so its buttons stay clickable. Every exit unfreezes first; the game scene
  resets `paused = false` on entry. Never leak a paused tree into another scene.
- **Touch controls show only with `body.playing`** (set/cleared per scene) or the D-pad reappears
  over the menu.
- **The pixel font has no emoji/★ glyphs:** any `k.text()` containing 👑 🍎 ✨ ★ must pass
  `font: "sans-serif"` per object. **Long-form prose too** (the finale letter, the menu character
  descriptions) — the pixel font is unreadable as running text.
- **HUD counters stay in the left column (x=88).** The top-right corner belongs to the DOM audio
  button, which is `position: fixed` and always paints above the canvas — with letterboxing it
  overhangs the canvas edge and covers anything right-anchored.

### Gameplay — see `src/levels/build.js`
- **Springs must lift onto a semisolid (`#`), never a solid slab** — she'd bonk its underside.
  `bounce()` also disarms the jump-cut, so the arc is always full height (and overshoots): keep the
  landing clear of hazards.
- **Difficulty lives in level data**, not in global `ENEMIES` speeds (which shift every existing
  cluster at once). Gaps on the critical path are **never >2 cells** — a single jump can't clear
  more, and there is no double jump.
- **The boss is deliberately softlock-proof.** It's tagged `"boss"`, NOT `"enemy"`, so its body is
  harmless — only the `"hazard"` it spawns hurts. Stomps register via **`onCollideUpdate`**, not
  `onCollide` (the enter-event fired on the way *up* and never re-fired on the descent, making it
  feel unhittable). Its phase loop is deterministic, and the goal gate is logical (no physical wall
  to wedge behind). Coverage: `tools/test/boss.mjs`.
- **Arcade run:** a death spends a life and banks 500 Coccoline; 0 lives → `resetRun()` + Game Over.
  `resetRun()` deliberately **keeps** the Coccoline tab (only "Nuova partita" wipes it). A grabbed
  `H` heart is remembered per run (`pj.heartsTaken`) — otherwise a heart past a checkpoint is
  re-grabbed on every death: an infinite-life loop. Hearts exist only on levels 3, 5 and 6.

### Leaderboard — see `api/leaderboard.js`, `src/ui/leaderboard.js`
- **It degrades to `null` on every error**, so the game still ships with no `/api` — exactly the
  Playwright setup. Keep that fallback or the suite breaks. `tools/test/features.mjs` ignores console
  errors from `/api/leaderboard` **on purpose** (the 404 IS the offline path under test).
- **The board is a time-attack HISTORY: every finished run is its own row.** The ZSET member is
  `"<id>:<nickname>"` (`INCR pj:lb:seq`), so a plain `ZADD` never collides. It used to key on the
  bare nickname with `ZADD LT`, which silently **overwrote** a player's earlier record — **don't
  restore that.** `cleanNick` strips `:`, which is what makes the separator safe; members without a
  `:` are legacy rows and still parse. Trimmed to 200 (HDEL the hash fields *before*
  `ZREMRANGEBYRANK`), and paged (`?offset=&limit=`, global `rank` per row).
- **The UI highlights by row `id`, never by nickname** — a name would light up every row that player
  ever set — and `lastSentRunKey` stops one run being filed twice.
- **Moderation:** `DELETE /api/leaderboard` with `x-admin-token: $LB_ADMIN_TOKEN` removes a row by
  `{id}` (or `{member}` for a legacy row). It **fails closed** — with no `LB_ADMIN_TOKEN` set it
  answers 404 as if the route didn't exist. Use it for an offensive nickname, a bogus time, or a
  test row; there is no other way to take an entry down.
- **The finale's closing order is CLASSIFICA → SCONTRINO.** The leaderboard invitation is the gate
  (submit or the small "Salta"); its `onDone` then chains the receipt. Reversed, players closed the
  app on the receipt and never saw the board at all. The DOM overlay swallows clicks but **not
  keys**, so `toMenu` early-returns on `isLeaderboardOpen()` — keep that guard.

### PWA — see `sw.js`, `tools/deploy.mjs`, `paintAppIcon` in `tools/gen/characters.mjs`
- **The service worker is prod-only** (never registered on localhost, or it would serve stale files
  between test runs) and **bypasses `/api/*`**. App **code** is network-first, heavy **media** is
  cache-first; `tools/deploy.mjs` stamps a unique `CACHE` id per deploy so an installed PWA always
  picks up the latest. **Don't** make code fetches cache-first again.
- **Icon sizing is rigid:** native × scale must hit the target exactly. `paintAppIcon(64, 2)` feeds
  512/192/apple-touch; the **maskable** is `paintAppIcon(128, 3)` — a bigger canvas around the figure
  is how it's shrunk into Android's safe zone, since the toolkit only does integer upscales.

### Assets
- Reach for **Kaplay primitives** for quick generic shapes (the star `*` and feather `+` still are),
  and the **`npm run gen` pipeline** when you want pixel art that sits beside the tiles/enemies (the
  heart `H` and hopper `h` were converted).

## Secrets / deploy
- `VERCEL_TOKEN` lives in a **gitignored + vercelignored `.env`**; `tools/deploy.mjs` reads it. Never
  commit `.env` or echo the token. After deploy, sanity-check `/.env` → 404 in prod.
- The leaderboard store is **Upstash Redis via the Vercel Marketplace**, injecting
  `UPSTASH_REDIS_REST_URL` / `_TOKEN` (the function also accepts the legacy `KV_REST_API_*` names).
  Unset → 503 → the leaderboard hides and the game still ships. Vercel env vars, never committed.
- **`LB_ADMIN_TOKEN`** (Vercel env var + the local `.env`) is the secret for `DELETE
  /api/leaderboard`. Unset → the route 404s. Never commit or echo it.

## Conventions
- **Detailed top-of-file header comments explaining the "why"**, generous inline comments at decision
  points. This is where the invariants above are argued in full — keep it up, it's what lets this
  file stay short.
- Italian for user-facing strings, English for code.
- Adding a level: add a data file + register it; reuse `build.js`/`mapkit.js`. Don't write new
  rendering/collision code.
