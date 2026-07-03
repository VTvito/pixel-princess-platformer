---
name: deploy
description: Deploy Un dono per Anna to Vercel production (or a preview) and verify the live site. Use when asked to deploy, ship, publish, or push the game live.
---

# Deploy Un dono per Anna (Vercel)

No build step — Vercel serves the static files. The project is already linked (`.vercel/`).

## Deploy
- **Production:** `npm run deploy`  (aliases <https://gameforprincess.vercel.app>)
- **Preview:** `npm run deploy -- --preview`
- `tools/deploy.mjs` reads `VERCEL_TOKEN` from the **gitignored `.env`** — no token pasting.
  If `.env` is missing it falls back to an ambient `VERCEL_TOKEN`; create one at
  <https://vercel.com/account/tokens> and put `VERCEL_TOKEN=...` in `.env`.

## Verify (after a production deploy)
Curl the live site and confirm:
- new modules served: `/src/audioUnlock.js`, `/src/ui/installHint.js` → **200**
- `/style.css` contains `100dvh`
- **secret safe:** `/.env` → **404** (never uploaded — it's in `.vercelignore`)

Report the aliased production URL from the CLI output.

## Rules
- `--scope lion-vi` (team token) is applied by `tools/deploy.mjs`.
- **Never** commit `.env` or print the token.
- Real iOS audio / safe-area can only be confirmed on a **physical iPhone** after deploy.
