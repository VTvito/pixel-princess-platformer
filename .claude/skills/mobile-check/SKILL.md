---
name: mobile-check
description: Run the iPhone-landscape emulation checks for Pixel Princess Platformer (audio unlock, touch controls, landscape fit, install hint) and review the screenshots. Use when asked to test the mobile or iOS experience.
---

# Mobile / iOS check

Emulates a recent iPhone in landscape (installed Edge via `playwright-core`) and asserts the
mobile fixes.

## Run
1. Start the server (skill `/serve-game`): `python tools/serve.py 8137` (background).
2. `npm run test:mobile`
3. Review the screenshots: `tools/test/mobile-menu.png`, `tools/test/mobile-game.png`.

## What it asserts
- touch controls **hidden on the menu**, visible only in gameplay (`body.playing`)
- audio context reaches `"running"` after a real tap (`src/audioUnlock.js`)
- iOS install hint shows on an iOS UA; landscape fit + control layout fully on-screen

## Honest limit
Edge/Chromium does **not** emulate WebKit audio quirks or the `env(safe-area)` notch insets.
Confirm the **real** audio + safe-area on a physical iPhone: open the live site, tap once →
sound starts; rotate to landscape → nothing clipped by the top bar or under the notch/home bar.

## Optional: interactive browser via MCP
To drive the browser live (navigate / click / screenshot / device-emulate) instead of the
script, activate the **Playwright MCP**: rename `.mcp.json.example` → `.mcp.json`, restart the
session, approve the server. Still Chromium, not iOS WebKit.
