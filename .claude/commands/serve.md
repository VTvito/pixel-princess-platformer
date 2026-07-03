---
description: Start the local dev server for Un dono per Anna and print the play URL
argument-hint: "[port]"
---
Start the game's local dev server so it can be played in a browser (or driven with Playwright).

Port: use `$ARGUMENTS` if a number was given, otherwise **8137** (the port the test harness and
project notes use; `tools/serve.py` itself defaults to 8080 when no port is passed).

Do this:
1. **Don't double-start.** First check whether something is already serving that port (a quick
   request to `http://localhost:<port>/`). If it's already up, just report the URL and stop.
2. Otherwise start it in the **background** (Bash `run_in_background: true`) so it keeps running
   across turns:
   `python tools/serve.py <port>`  (equivalently `npm run serve` for the default 8137).
   NEVER use `python -m http.server` — on Windows it serves `.js` as `text/plain` and the ES
   modules refuse to load; `tools/serve.py` exists precisely to force the correct MIME types.
3. Confirm it's listening, then tell the user: **http://localhost:<port>** — open it in a
   browser to play, or ask me to drive/screenshot it with the Playwright scripts in `tools/test/`.
4. To stop it later: end the background task, or kill the python process serving that port.
