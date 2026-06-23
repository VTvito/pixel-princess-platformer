# 👑 The Princess Journey

A personalized 2D platformer gift, built with [Kaplay](https://kaplayjs.com/)
(`3001.0.19`, **vendored** at `vendor/kaplay-3001.0.19.mjs` and imported directly — no build
step, no CDN at runtime).

The full journey is playable: a responsive landscape canvas, a main menu with character
selection (Anna / Belle / Jasmine), **six** themed platformer levels with a
clothing-skin progression, and the **Sala da Ballo** finale — all with `localStorage`
progress.

## Run it locally

ES modules require an HTTP server — opening `index.html` by double-click (`file://`)
will **not** work. Use the bundled dev server:

```bash
python tools/serve.py 8137      # or: npm run serve   (skill: /serve-game)
```

Then open <http://localhost:8137> and play. On mobile, hold the device in **landscape**.

> **Why not `python -m http.server`?** On Windows, the built-in server reads MIME types
> from the registry, which often serves `.js` as `text/plain`. Browsers enforce strict
> MIME checking for ES modules and silently refuse to run them, so the game won't load.
> `tools/serve.py` forces the correct `text/javascript` type. (`npx http-server` or the
> VS Code **Live Server** extension also work.)

## Deploy (Vercel)

The game is a **static site** — no build step (Kaplay is vendored), so Vercel just serves the
files. The repo ships the config Vercel needs:

- [`vercel.json`](vercel.json) — long-lived `Cache-Control` headers for `/assets/*` and
  `/vendor/*`.
- [`.vercelignore`](.vercelignore) — keeps dev tooling (and **`.env`**) out of the deploy;
  only `index.html`, `style.css`, the manifest, `src/`, `assets/` and `vendor/` are uploaded.

**Live (production):** <https://gameforprincess.vercel.app>
(team `lion-vi`, project `game_for_princess`).

The project is already linked (a `.vercel/` folder exists locally). Deploy with **one command**:

```bash
npm run deploy            # production deploy (alias the live URL)
npm run deploy -- --preview   # a throwaway preview deployment instead
```

`npm run deploy` ([`tools/deploy.mjs`](tools/deploy.mjs)) reads `VERCEL_TOKEN` from a
**gitignored `.env`** so the token never has to be pasted again:

```bash
# .env  (LOCAL ONLY — gitignored AND vercelignored; never committed or uploaded)
VERCEL_TOKEN=...            # from https://vercel.com/account/tokens
```

The `--scope lion-vi` is required (the token belongs to a team); `tools/deploy.mjs` applies it
for you. The equivalent raw CLI fallback is
`npx vercel deploy --prod --scope lion-vi --token "$VERCEL_TOKEN"`.

## Testing

Browser-level checks run in the installed **Edge** via `playwright-core` (a dev-only
dependency — the game itself still has no build step). Start the server, then run a test:

```bash
npm install             # once: fetches playwright-core (skips the browser download)
npm run serve           # terminal 1 — serves http://localhost:8137
npm test                # terminal 2 — smoke + features + levels
npm run test:features   # audio buses, SFX load, movement/jump, Insert Coin, finale receipt
npm run test:levels     # boots each of levels 1–6, asserts no errors + screenshots the art
npm run test:mobile     # iPhone-landscape emulation: audio unlock, touch controls, fit, hint
```

`test:mobile` emulates a recent iPhone in landscape and asserts the mobile fixes (see
**Mobile / iOS** below).

> **Flaky checks (known, pre-existing):** a few timing-sampled assertions in `test:features`
> (`air anim while jumping`, `spring launches the player`) can intermittently fail at frame
> boundaries — they flip pass/fail with identical code, so re-run before treating one as a
> regression. **CI** ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) parses every module
> and runs the smoke + per-level boot gates; the feature suite runs non-blocking for this reason.

Each test writes a screenshot to `tools/test/`. The tests read a localhost-only dev handle
(`window.__pj.k`, set in `src/main.js`) to introspect/drive the engine; it's never attached on
a real deployment.

## Controls

- **Desktop:** ◀ ▶ arrows to move, **Space** or **↑** to jump, **Esc** to pause.
- **Mobile:** a slim **D-pad pill** (bottom-left) + a larger **jump button** (bottom-right),
  plus a **⏸ pause button** (top-left). They are translucent at rest, gold while pressed,
  respect the iOS safe area, and appear **only during gameplay** (`body.playing`) — never over
  the menu or finale.
- **Pause** (Esc / ⏸) freezes the world and opens an overlay: **Riprendi · Impostazioni ·
  Ricomincia · Torna al menu**. **Impostazioni** (also on the main menu) has **Musica / Effetti**
  volume sliders and a two-tap **Cancella i progressi** (wipes the save; the lifetime debt, the
  joke, survives).

## Mobile / iOS

Landscape, mobile-first. The pieces that make it feel right on a phone:

- **Audio unlock** ([`src/audioUnlock.js`](src/audioUnlock.js)) — iOS Safari starts the
  `AudioContext` *suspended* and only resumes it inside a **real DOM gesture**. A Kaplay
  `onClick` runs in the rAF loop (not the gesture), so a window-level capture listener resumes
  `k.audioCtx` on the first `pointerdown/touchend/…` and then (re)starts the current track via
  `resumeCurrentBgm()` in [`src/audio.js`](src/audio.js).
- **Landscape fit** — `html, body` use **`100dvh`** so the canvas tracks the *actually visible*
  viewport (no clip under the Safari toolbar/status bar); interactive UI uses
  `env(safe-area-inset-*)` for the notch / home indicator.
- **Smooth on mobile** — touch devices (`pointer: coarse`) render at **`pixelDensity: 1`**
  ([`src/kaplayCtx.js`](src/kaplayCtx.js)) instead of 2×: on a 3× iPhone that is ~4× less
  fill-rate, so the pixel-art world stays fluid on a mobile GPU. Desktop keeps `min(dpr, 2)`.
- **Install hint** ([`src/ui/installHint.js`](src/ui/installHint.js)) — iPhone Safari tabs
  can't go true fullscreen, so a small dismissible "Aggiungi a Home" banner (iOS-only, not in
  standalone, persisted) nudges PWA install.

> **Test honesty:** Edge/Chromium (`npm run test:mobile`) does **not** emulate WebKit's audio
> quirks nor the `env(safe-area)` notch insets — confirm the real audio + safe-area on a
> physical iPhone after deploy.

## Generated assets

All art and audio are generated by the pixel-art pipeline in `tools/gen/` (Node built-ins
only) and committed under `assets/`. Regenerate with:

```bash
npm run gen          # = node tools/gen/index.mjs — deterministic, same input → same bytes
```

The art is authored at quarter resolution and integer-upscaled ×4 for a chunky 16-bit look.
This writes:

- `assets/sprites/{anna,sognatrice,avventuriera}.png` — 64×96 heroines.
- `assets/sprites/{skirt,bodice,necklace,crown,gloves,cape,logo}.png` — the six clothing-skin
  overlays + the crown logo, on the same 64×96 canvas so the layers line up.
- `assets/sprites/…` — collectibles, enemies, the goal portal, the Phase-4/5 mechanic props
  (spring, flag, swooper, roller) and the per-theme decor props.
- `assets/tilesets/tileset.png` — neutral-grey tile atlas (tinted per theme at runtime).
- `assets/backgrounds/{forest,coral,rooftops,snow,garden,castle}_{sky,mid,near}.png` —
  parallax skies + silhouettes per theme.
- `assets/audio/{menu-bgm,finale-bgm}.wav` + one track per theme
  `assets/audio/bgm-{forest,coral,rooftops,snow,garden,castle}.wav` — on the **Music** bus.
- `assets/audio/{jump,collect,coin,oops,goal,win,select,stomp,spring,checkpoint,crumble,skid}.wav`
  — synthesized gameplay SFX, on the **SFX** bus.

### Swapping in real assets

Drop real files into `assets/` keeping the same filenames — no code change needed. If a
file's **extension** changes (e.g. real music as `.mp3`), update the matching path in the
`ASSETS` map in [`src/config.js`](src/config.js); that map is the single source of truth.

## Project structure

```
index.html              canvas mount + rotate overlay + touch controls + install hint + overlays
style.css               full-viewport canvas (100dvh), letterbox bars, overlays, touch buttons
sw.js                   service worker: offline play / PWA install (registered in main.js, prod only)
manifest.webmanifest    PWA manifest (standalone, landscape, icons)
package.json            dev-only: scripts (serve/test/test:mobile/gen/deploy) + playwright-core
.env                    LOCAL ONLY (gitignored+vercelignored): VERCEL_TOKEN for `npm run deploy`
jsconfig.json           JS code-intelligence for the LSP (navigation/hover; checkJs off by default)
.mcp.json.example       template for the Playwright MCP (rename to .mcp.json to activate)
vendor/
  kaplay-3001.0.19.mjs  the pinned, vendored engine (imported by src/kaplayCtx.js)
src/
  main.js               entry: scenes, asset load, touch + audio buttons, audio unlock, install hint
  kaplayCtx.js          creates & exports the single kaplay() context `k`
  config.js             virtual resolution, palette, CHARACTERS[], SKINS[], PHYSICS, MECHANICS, ASSETS
  assets.js             loads sprites/sounds from the ASSETS manifest
  state.js              localStorage: selectedCharacter, currentLevel, score, Coccoline
  controls.js           reusable input layer: keyboard + DOM touch buttons
  audio.js              Music + SFX buses: bgm playback + persisted toggles + resumeCurrentBgm()
  audioUnlock.js        resumes the AudioContext on the first real DOM gesture (iOS Safari)
  sfx.js                one-shot sound effects (k.play wrapper) on the SFX bus
  juice.js / animspec.js game-feel helpers (confetti) + the sprite animation contract
  ui/                   DOM/HTML overlays, isolated from the game's collision logic
    insertCoin.js       "Insert Coin" death overlay
    pauseMenu.js        pause overlay (Riprendi / Impostazioni / Ricomincia / Menu)
    settings.js         settings overlay: Musica/Effetti volume sliders + Cancella i progressi
    receipt.js          finale "Scontrino" + WhatsApp payoff
    transition.js       CSS scene-fade helper
    audioToggle.js      Music + SFX toggle buttons
    audioDebug.js       on-screen WebAudio diagnostics (only with ?audiodebug=1)
    installHint.js      iOS "Aggiungi a Home" hint (PWA fullscreen)
  entities/
    player.js           makePlayer(): physics body + movement/jump + squash & stretch + skins
  scenes/
    loading.js          branded loading screen → menu when assets are ready
    menu.js             title, Start, character cards, audio unlock gesture
    game.js             plays a level: camera, parallax, Insert-Coin death, collectibles, goal
    finale.js           "Sala da Ballo": avatar in all skins + message + (delayed) receipt
  levels/
    level1.js … level6.js  six tile maps + themes (DATA only)
    build.js            generic builder (solids/hazards/collectibles/enemies/mechanics/goal)
    mapkit.js           tile legend + map helpers shared by the level data
    index.js            level registry — getLevelDef(n), hasLevel(n)
tools/
  serve.py              dev server with correct ES-module MIME types
  deploy.mjs            `npm run deploy` — prod deploy reading VERCEL_TOKEN from .env
  gen/                  pixel-art asset pipeline (run via `npm run gen`)
  test/
    smoke.mjs           boots the game in real Edge, asserts it reaches the menu
    features.mjs        audio buses, movement, Insert Coin, finale receipt
    levels.mjs          boots each level 1–6 (no errors) + screenshots the themed art
    mobile.mjs          iPhone-landscape emulation: audio unlock, controls, fit, install hint
    browser.mjs         shared Edge launcher for the test scripts
.claude/skills/         project skills: serve-game, deploy, mobile-check, regen-assets
.github/workflows/ci.yml  CI: module syntax + smoke/levels gates (feature suite non-blocking)
assets/fonts/           the vendored pixel UI font (Pixelify Sans, OFL) — Kaplay + DOM
```

## Levels

Levels are **data**: an ASCII tile map + a colour theme (see `src/levels/level1.js` …
`level6.js`). `src/levels/build.js` turns any such map into the world, so adding more levels
means adding sibling data files — no new rendering/collision code. The base legend:

```
=  solid platform / ground      ^  hazard (rovi/ricci/ghiaccio → respawn)
o  collectible (mela/perla/…)   c  crab enemy (patrols the ground → respawn)
f  flyer enemy (patrols the air, bobs → respawn)
s  stalactite (drops from the ceiling, then resets → respawn)
@  player spawn                 >  level goal
(space)  air — a gap in the ground rows is a ravine (burrone)
```

Later phases add more mechanic tiles — springs, crumbling platforms, updrafts, swoopers (`g`),
rollers, breeze columns, pendulum chandeliers, the **armored swooper** (`S`, a 2-hp diving
guardian that enrages on a stomp) and the **feather** (`+`, a high-jump power-up on the bonus
routes). See `src/levels/mapkit.js` + `build.js` for the full legend and `MECHANICS` / `POWERUP`
in `src/config.js` for the tunables.

- **Livello 1 — Foresta Incantata**: a running lane, ravines, brambles, **forest critters**
  (patrolling crabs + a circling crow), golden apples.
- **Livello 2 — Abissi di Corallo**: coral floor, sea-urchin hazards, **patrolling crabs**, pearls.
- **Livello 3 — Tetti d'Oriente**: pagoda rooftops at dusk, **flying obstacles**, lanterns.
- **Livello 4 — Cime Innevate**: snowy peaks, **stalactites** that drop and reset, crystals.
- **Livello 5 — Giardino del Crepuscolo**: a dusk garden of roses 🌹, **breeze columns** of
  petals that carry you forward and soften the fall (long assisted glides).
- **Livello 6 — Castello Reale**: the royal castle, goblets 🏆, swinging **pendulum
  chandeliers** (lethal bobs with timed safe windows) and the **Gargoyle Custode**.

Touching a hazard or enemy, or falling into a ravine, shows the Insert-Coin overlay and
respawns you (from the last checkpoint, if any). On reaching the goal, a **reward screen**
reveals the heroine in a golden spotlight wearing the freshly unlocked clothing layer, then
continues to the next level. Clearing **Livello 6** leads to the finale (the non-playable
level 7).

## Saving & resuming

Progress (chosen heroine + current level) is saved to `localStorage` after every level
(`src/state.js`). Reload and the menu shows a **Riprendi · Livello N** button that drops you
straight back in — wearing the skins unlocked so far. **Nuova partita** starts fresh from
level 1.

## Skins (sprite layering)

Clearing a level unlocks a clothing layer drawn **on top of** the chosen base body (same 64×96
transparent sprite, same centre). Six layers, in paint order: **Gonna Reale → Corpetto
Elegante → Collana → Corona → Guanti di Seta → Mantello Reale**. Which layers are worn is
**derived from the saved level** (on level N you wear every skin whose `afterLevel < N`; see
`SKINS` / `unlockedSkinKeys` in `src/config.js`).

## Finale — Sala da Ballo

Clearing Level 6 leads to the **Sala da Ballo**, a non-playable cinematic
(`src/scenes/finale.js`). The chosen heroine stands centre-stage as the **Principessa
Perfetta**, wearing all **six** skins, with a centred box showing a **personalized message**
(edit `FINALE.message` in `src/config.js`). The heartfelt note is shown first; after a reading
beat the **Scontrino** (receipt) payoff appears with the run's Coccoline bill and the WhatsApp
"Paga il Debito!" — its **Chiudi** returns to the message. Saved progress remembers the finale,
so a reload offers **Rivedi il Gran Ballo**.

## Polishing & meta-game

A "juiciness" + meta-game layer sits on top of the core game.
All DOM/HTML is isolated in `index.html`, `style.css`, and `src/ui/`, so it never touches the
collision logic in `game.js`:

- **Insert Coin (no game-over).** Failing freezes the heroine and shows an HTML overlay;
  **Inserisci Coin** adds 500 to `localStorage.totaleCoccoline` and restarts the level. The
  debt is cumulative across the whole gift.
- **Finale receipt → WhatsApp.** The Sala da Ballo shows a paper *Scontrino* with the total
  debt and a **Paga il Debito!** button that opens a pre-filled WhatsApp share.
- **Game feel.** Squash & stretch, confetti on pickups, themed ambient particles, and
  synthesized **SFX** + per-theme looping **music** on independent buses.
- **Independent audio buses.** Two top-right toggles — **🎵 Music** and **🔊 SFX** — silence
  each bus separately, and the **Impostazioni** panel adds a continuous **volume slider** per
  bus (all persisted to `localStorage`).
- **Pixel UI.** A vendored pixel font (Pixelify Sans, OFL) is the Kaplay default and the DOM
  `@font-face`, so the HUD/menus match the pixel-art world; emoji/★ render on the system font.
- **Pause & settings.** Esc / ⏸ freezes the game (`k.getTreeRoot().paused`) behind a DOM
  overlay; settings (volume + reset progress) is reachable from the menu and the pause screen.
- **Living menu.** The title screen reuses the garden parallax backdrop with drifting petals and
  a breathing heroine preview; on the character chooser, the hovered card breaks into her walk
  cycle, so picking a heroine feels like meeting her.
- **Offline / PWA.** A service worker ([`sw.js`](sw.js)) caches the shell + assets so the game
  plays offline after the first visit and installs as a standalone app (manifest in place).
- **Quality of life.** CSS fade between scenes, instant press feedback on the touch buttons.

The core journey plus this polishing layer are complete.
