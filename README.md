# 👑 The Princess Journey

A personalized 2D platformer gift, built with [Kaplay](https://kaplayjs.com/)
(`3001.0.19`, loaded from a CDN — no build step). See
`Specifiche_Gioco_Anna_Princess.md` for the full design.

This first slice is the **base scaffolding**: a responsive landscape canvas, a main
menu with character selection (Anna / La Sognatrice / L'Avventuriera), audio-context
unlock on the first tap, and wired stub scenes with `localStorage` progress.

## Run it locally

ES modules require an HTTP server — opening `index.html` by double-click (`file://`)
will **not** work. Use the bundled dev server:

```bash
python tools/serve.py 8080
```

Then open <http://localhost:8080> and play. On mobile, hold the device in **landscape**.

> **Why not `python -m http.server`?** On Windows, the built-in server reads MIME types
> from the registry, which often serves `.js` as `text/plain`. Browsers enforce strict
> MIME checking for ES modules and silently refuse to run them, so the game won't load.
> `tools/serve.py` forces the correct `text/javascript` type. (`npx http-server` or the
> VS Code **Live Server** extension also work.)

## Testing

Browser-level checks run in the installed **Edge** via `playwright-core` (a dev-only
dependency — the game itself still has no build step). Start the server, then run a test:

```bash
npm install             # once: fetches playwright-core (skips the browser download)
npm run serve           # terminal 1 — serves http://localhost:8137
npm test                # terminal 2 — smoke: boots to the menu, no console errors
npm run test:features   # deeper: audio toggle, SFX load, movement/jump, Insert Coin, receipt
npm run test:levels     # boots each of levels 1–4, asserts no errors + screenshots the art
```

Each writes a screenshot to `tools/test/`. The tests read a localhost-only dev handle
(`window.__pj.k`, set in `src/main.js`) to introspect the engine; it's never attached on a
real deployment.

## Controls

- **Desktop:** ◀ ▶ arrows to move, **Space** or **↑** to jump.
- **Mobile:** on-screen D-pad (bottom-left) + jump button (bottom-right); they appear
  only on touch devices.

## Placeholder assets

Real art/audio don't exist yet, so committed placeholders live in `assets/`. Regenerate
them with the stdlib-only generator (no pip / npm needed):

```bash
python tools/gen_placeholders.py     # uses Python (recommended on this machine)
# or, if you have Node:
node tools/gen-placeholders.mjs
```

This writes:

- `assets/sprites/{anna,sognatrice,avventuriera,logo}.png` — 64×64 transparent RGBA
  (same size/transparency the skin-layering system will need).
- `assets/audio/menu-bgm.wav` — a short placeholder track.
- `assets/audio/{jump,collect,coin,oops,goal,win,select}.wav` — synthesized gameplay SFX.

### Swapping in real assets

Drop real files into `assets/` keeping the same filenames — no code change needed. If a
file's **extension** changes (e.g. real music as `.mp3`), update the matching path in the
`ASSETS` map in [`src/config.js`](src/config.js); that map is the single source of truth.

## Project structure

```
index.html              canvas mount + rotate overlay + touch controls + DOM overlays
style.css               full-viewport canvas, letterbox bars, overlays, touch buttons
package.json            dev-only: scripts + playwright-core for the test harness
src/
  main.js               entry: registers scenes, loads assets, wires touch + audio buttons
  kaplayCtx.js          creates & exports the single kaplay() context `k`
  config.js             virtual resolution, palette, CHARACTERS[], PHYSICS, ASSETS
  assets.js             loads sprites/sounds from the ASSETS manifest
  state.js              localStorage: selectedCharacter, currentLevel, totaleCoccoline
  controls.js           reusable input layer: keyboard + DOM touch buttons
  juice.js              game-feel helpers (confetti burst) — pure Kaplay, no DOM
  sfx.js                one-shot sound effects (k.play wrapper; honours the mute toggle)
  ui/                   DOM/HTML overlays, isolated from the game's collision logic
    insertCoin.js       "Insert Coin" death overlay (spec §1)
    receipt.js          finale "Scontrino" + WhatsApp payoff (spec §2)
    transition.js       CSS scene-fade helper (spec §4)
    audioToggle.js      global bgm mute button (spec §4)
  entities/
    player.js           makePlayer(): physics body + movement/jump + squash & stretch
  scenes/
    loading.js          branded loading screen → menu when assets are ready
    menu.js             title, Start, character cards, audio unlock
    game.js             plays a level: camera, parallax, Insert-Coin death, apples, goal
    finale.js           "Sala da Ballo" cutscene: avatar in all skins + message + receipt
  levels/
    level1.js           "Foresta Incantata" tile map + theme (DATA only)
    level2.js           "Abissi di Corallo" tile map + theme (DATA only)
    level3.js           "Tetti d'Oriente" tile map + theme (DATA only)
    level4.js           "Cime Innevate" tile map + theme (DATA only)
    build.js            generic builder (solids/hazards/collectibles/crabs/flyers/stalactites/goal)
    index.js            level registry — getLevelDef(n), hasLevel(n)
assets/
  sprites/*.png         placeholder character/logo art
  audio/menu-bgm.wav    placeholder menu music
tools/
  serve.py              dev server with correct ES-module MIME types
  gen_placeholders.py   Python placeholder generator (stdlib only)
  gen-placeholders.mjs  Node equivalent (optional)
  test/
    smoke.mjs           boots the game in real Edge, asserts it reaches the menu
    features.mjs        deeper checks: audio, movement, Insert Coin, finale receipt
    levels.mjs          boots each level 1–4 (no errors) + screenshots the themed art
```

## Levels

Levels are **data**: an ASCII tile map + a colour theme (see `src/levels/level1.js` …
`level4.js`). `src/levels/build.js` turns any such map into the world, so adding more
levels means adding sibling data files — no new rendering/collision code. Tile legend:

```
=  solid platform / ground      ^  hazard (rovi/ricci/ghiaccio → respawn)
o  collectible (mela/perla/…)   c  crab enemy (patrols the ground → respawn)
f  flyer enemy (patrols the air, bobs → respawn)
s  stalactite (drops from the ceiling, then resets → respawn)
@  player spawn                 >  level goal
(space)  air — a gap in the ground rows is a ravine (burrone)
```

- **Livello 1 — Foresta Incantata**: platforms, ravines, brambles, 6 golden apples.
- **Livello 2 — Abissi di Corallo**: coral platforms, sea-urchin hazards, **patrolling
  crabs**, 6 pearls, underwater backdrop with bubbles.
- **Livello 3 — Tetti d'Oriente**: pagoda rooftops at dusk, **flying obstacles** (crows
  that patrol the air and bob), broken-tile spikes, 6 lanterns.
- **Livello 4 — Cime Innevate**: snowy peaks, **stalactites** that drop from the ceiling
  and reset, ice spikes, 6 crystals, drifting snow.

Touching a hazard or enemy, or falling into a ravine, respawns you at the start (no
game-over, spec §4). The camera follows the heroine across each ~2-screen level. On
reaching the goal, a **reward screen** unlocks the next clothing layer and continues to
the next level.

## Saving & resuming

Progress (chosen heroine + current level) is saved to `localStorage` after every level
(`src/state.js`). Reload the page and the menu shows a **Riprendi · Livello N** button
that drops you straight back in — wearing the skins unlocked so far. **Nuova partita**
starts a fresh run from level 1.

## Skins (sprite layering, spec §3)

Clearing a level unlocks a clothing layer that is drawn **on top of** the chosen base
body (same 64×64 transparent sprite, same centre): Gonna Reale → Corpetto Elegante →
Collana → Corona. Which layers are worn is **derived from the saved level** (no extra
state): on level N you wear every skin whose `afterLevel < N` (see `SKINS` /
`unlockedSkinKeys` in `src/config.js`). `makePlayer(char, pos, skinKeys)` adds the layers
as child sprites and keeps their `flipX` in sync with the body. Placeholder skin art is
generated alongside the other assets (`skirt/bodice/necklace/crown.png`).

## Finale — Sala da Ballo

Clearing Level 4 leads to the **Sala da Ballo**, a non-playable cinematic
(`src/scenes/finale.js`). No controls: the chosen heroine stands centre-stage as the
**Principessa Perfetta**, wearing all four skins (skirt + bodice + necklace + crown), with
a centred box showing a **personalized message**. Edit that message — the gift's heartfelt
core — in the `FINALE` constant in `src/config.js` (keep it bracket-free and use only
widely-shipped emoji; decorative emoji are rendered as their own untinted objects because
`k.color()` would darken the glyph). Saved progress remembers the finale, so a reload
offers **Rivedi il Gran Ballo**; **Nuova partita** starts a fresh run from level 1.

## Polishing & meta-game

A "juiciness" + meta-game layer sits on top of the core game (see `Specifiche_Polishing.md`).
All DOM/HTML is isolated in `index.html`, `style.css`, and `src/ui/`, so it never touches the
collision logic in `game.js`:

- **Insert Coin (no game-over).** Touching a hazard/enemy or falling off the world freezes
  the heroine and shows an HTML overlay; **Inserisci Coin** adds 500 to
  `localStorage.totaleCoccoline` and restarts the level. The debt is cumulative across the
  whole gift — it is *not* reset by "Nuova partita".
- **Finale receipt → WhatsApp.** The Sala da Ballo shows a paper *Scontrino* with the total
  debt and a **Paga il Debito!** button that opens a pre-filled WhatsApp share (no fixed
  number; the amount is substituted into the link).
- **Game feel.** Squash & stretch on jump/land, a confetti burst on every pickup, a soft
  themed aura behind each collectible, rising motes at every level goal, and synthesized
  **sound effects** (jump, collect, Insert-Coin, level clear, finale fanfare) wrapped in
  `src/sfx.js` so the 🔊 / 🔇 toggle mutes them too.
- **Per-level art.** A two-layer parallax backdrop (0.2× / 0.5× the camera speed) whose
  ridge colours are tuned per theme (`parallaxFar` / `parallaxNear`) so they read on both
  dark (forest, dusk) and pale (snow) skies, plus signature ambient particles for every
  level: **enchanted-forest fireflies/pollen**, coral bubbles, dusk embers, alpine snow.
- **Quality of life.** A CSS fade between scenes, an always-on **🔊 / 🔇** audio toggle
  (top-right, choice persisted), and instant press feedback on the touch buttons.

The core journey plus this polishing layer are complete. Real art and audio remain the
natural next step (drop files into `assets/` keeping the same names; only `src/config.js`
knows the paths).
