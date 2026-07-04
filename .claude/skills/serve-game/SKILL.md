---
name: serve-game
description: Launch the local dev server for Pixel Princess Platformer (the Kaplay browser platformer in this repo) so it can be played in a browser or driven with Playwright. Use when asked to run, start, serve, or open the game, or before browser-testing it.
---

# Serve Pixel Princess Platformer locally

This is a **no-build** browser game (Kaplay loaded from a CDN). Running it needs only a static
file server that sends correct ES-module MIME types — there is nothing to install or compile.

## Start the server
- Canonical command: `python tools/serve.py 8137`  (equivalently `npm run serve`).
- Launch it in the **background** (Bash `run_in_background: true`) so it persists across turns.
- **Port 8137** is what the test harness and project notes use. `tools/serve.py` defaults to 8080
  if you pass no port, so always pass `8137` for consistency.
- **Never** use `python -m http.server`: on Windows it serves `.js` as `text/plain` and the
  browser refuses to run the ES modules (the game loads to a blank screen). `tools/serve.py`
  forces `text/javascript` etc. — that is the entire reason it exists.
- Don't start a second server if one is already on the port; check `http://localhost:8137/` first.

## Play / drive it
- URL: **http://localhost:8137** — open in a browser to play by hand.
- To drive or screenshot it programmatically, use the standalone `playwright-core` scripts in
  `tools/test/` (they launch installed Microsoft Edge, not a downloaded Chromium).

## Verify / stop
- Up: a request to `http://localhost:8137` returns `index.html`.
- Stop: end the background task, or stop the python process bound to port 8137.

## Related checks
- Test harnesses: `npm test` (smoke + features + levels), or individually `npm run test:smoke`,
  `test:features`, `test:levels`, `test:mobile`.
