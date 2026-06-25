// mobile.mjs — iPhone-landscape emulation checks for the mobile fixes:
//   1) audio unlock on a REAL DOM gesture (k.audioCtx reaches "running"),
//   2) touch controls hidden on the menu, shown only during gameplay (body.playing),
//   3) landscape fit (100dvh) + the iOS "Aggiungi a Home" hint appears on an iOS UA.
//
// Emulates a recent iPhone Pro held in landscape (a real "iPhone 17" device descriptor isn't
// in playwright-core; the viewport/DPR/touch profile below matches that class of device).
//
// Honest scope: Edge/Chromium does NOT emulate iOS WebKit's audio-unlock quirks nor the
// env(safe-area-inset-*) notch insets, so the *real* iOS audio behaviour and safe-area layout
// must still be confirmed on a physical iPhone. This guards the new code paths (the unlock
// listener + resumeCurrentBgm run cleanly, the .playing visibility logic, the install hint)
// and produces landscape screenshots to eyeball the fit + control layout.
//
// Usage:  python tools/serve.py 8137   (then)   node tools/test/mobile.mjs
// Exit 0 = all pass, 1 = a failure or a console error.

import { launchBrowser, routeVendorKaplay } from "./browser.mjs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const TARGET = process.argv[2] || process.env.PJ_URL || "http://localhost:8137";
const HERE = dirname(fileURLToPath(import.meta.url));
const SHOT_MENU = join(HERE, "mobile-menu.png");
const SHOT_GAME = join(HERE, "mobile-game.png");
const T = 15000;

// iPhone-Pro-class landscape profile. iOS Safari UA so src/ui/installHint.js treats it as iOS.
const IPHONE_LANDSCAPE = {
  viewport: { width: 932, height: 430 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 " +
    "(KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
};

const errors = [];
const results = [];
const check = (name, ok, extra = "") => results.push({ name, ok: !!ok, extra });

const browser = await launchBrowser();
try {
  const page = await browser.newPage(IPHONE_LANDSCAPE);
  await routeVendorKaplay(page);
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

  // Boot with a clean slate (so the install hint isn't pre-dismissed and audio starts locked).
  await page.goto(TARGET, { waitUntil: "domcontentloaded", timeout: T });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => window.__pj?.k && window.__pj.k.getSceneName() === "menu",
    null,
    { timeout: T, polling: 100 },
  );
  check("boots to menu (landscape)", true);

  // Environment sanity: emulation actually reports a touch / coarse-pointer device, and the
  // page isn't stuck behind the portrait rotate overlay.
  const env = await page.evaluate(() => ({
    coarse: window.matchMedia("(pointer: coarse)").matches,
    portrait: window.matchMedia("(orientation: portrait)").matches,
    rotateShown: getComputedStyle(document.getElementById("rotate-overlay")).display !== "none",
    audioInitial: window.__pj.k.audioCtx ? window.__pj.k.audioCtx.state : "no-ctx",
  }));
  check("landscape (no rotate overlay)", !env.portrait && !env.rotateShown, JSON.stringify(env));

  // --- (2) Touch controls must be HIDDEN on the menu (no body.playing). ---
  const onMenu = await page.evaluate(() => ({
    playing: document.body.classList.contains("playing"),
    tcDisplay: getComputedStyle(document.getElementById("touch-controls")).display,
  }));
  check(
    "controls hidden on menu",
    !onMenu.playing && onMenu.tcDisplay === "none",
    JSON.stringify(onMenu),
  );

  // --- (3) Install hint shows on an iOS UA (not standalone, not dismissed). ---
  const hintShown = await page.evaluate(
    () => !document.getElementById("install-hint").hidden,
  );
  check("iOS install hint visible", hintShown);

  await page.screenshot({ path: SHOT_MENU });

  // --- (4) Resume resync (src/viewportResync.js): the iOS-PWA "two colour bands on resume in
  // landscape" fix. Emulation can't reproduce WebKit's stale-canvas latch, so this only proves
  // the resume handlers run cleanly and leave the #game canvas covering the full viewport (no
  // short canvas / body showing through). The real recovery is verified on a physical iPhone. ---
  const resume = await page.evaluate(async () => {
    // Fire every foreground signal the module listens for.
    window.dispatchEvent(new Event("pageshow"));
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));
    // Let the rAF release + the 300 ms delayed second pass run.
    await new Promise((r) => setTimeout(r, 420));
    const c = document.getElementById("game");
    const r = c.getBoundingClientRect();
    return {
      covers: Math.abs(r.width - window.innerWidth) <= 2 && Math.abs(r.height - window.innerHeight) <= 2,
      inlineLeft: c.style.width || "(cleared)", // should be handed back to the stylesheet
      rect: { w: Math.round(r.width), h: Math.round(r.height) },
      vp: { w: window.innerWidth, h: window.innerHeight },
    };
  });
  check("canvas covers viewport after a resume signal", resume.covers, JSON.stringify(resume));
  check("resync releases the inline size back to CSS", resume.inlineLeft === "(cleared)", `inline=${resume.inlineLeft}`);

  // --- (1) Audio unlock on a REAL gesture: a genuine tap fires the window capture listener
  // in src/audioUnlock.js, which resumes k.audioCtx. ---
  await page.touchscreen.tap(466, 215); // centre of the 932×430 viewport — a real touch gesture
  const audioState = await page
    .waitForFunction(() => window.__pj.k.audioCtx && window.__pj.k.audioCtx.state === "running", null, {
      timeout: 5000,
      polling: 50,
    })
    .then(() => "running")
    .catch(async () => page.evaluate(() => window.__pj.k.audioCtx?.state || "no-ctx"));
  check("audio context unlocks on tap", audioState === "running", `state=${audioState}`);

  // --- (2) Enter gameplay → controls become visible (body.playing). ---
  await page.evaluate(() => window.__pj.k.go("game"));
  await page.waitForFunction(
    () => window.__pj.k.getSceneName() === "game" && window.__pj.k.get("player").length > 0,
    null,
    { timeout: T, polling: 100 },
  );
  const inGame = await page.evaluate(() => ({
    playing: document.body.classList.contains("playing"),
    tcDisplay: getComputedStyle(document.getElementById("touch-controls")).display,
    coarse: window.matchMedia("(pointer: coarse)").matches,
    jump: document.getElementById("btn-jump").getBoundingClientRect(),
    dpad: document.getElementById("dpad").getBoundingClientRect(),
  }));
  check("body.playing on in gameplay", inGame.playing, JSON.stringify({ playing: inGame.playing }));
  // The CSS reveal is gated on (pointer: coarse); only assert display when the emulator reports it.
  check(
    "controls visible in gameplay",
    inGame.coarse ? inGame.tcDisplay === "block" : true,
    `coarse=${inGame.coarse} display=${inGame.tcDisplay}`,
  );
  // Layout sanity: jump bottom-right, d-pad bottom-left, both inside the viewport.
  check(
    "control layout (jump right / dpad left, on-screen)",
    inGame.jump.right <= 932 && inGame.jump.left > 466 &&
      inGame.dpad.left >= 0 && inGame.dpad.right < 466 &&
      inGame.jump.bottom <= 430 && inGame.dpad.bottom <= 430,
    JSON.stringify({ jump: inGame.jump, dpad: inGame.dpad }),
  );

  await page.screenshot({ path: SHOT_GAME });

  // --- Report ---
  let allOk = errors.length === 0;
  for (const r of results) {
    allOk = allOk && r.ok;
    console.log(`${r.ok ? "PASS" : "FAIL"} — ${r.name}${r.extra ? `  (${r.extra})` : ""}`);
  }
  if (errors.length) {
    console.log("\nConsole/page errors:");
    errors.forEach((e) => console.log("  " + e));
  }
  console.log(`\nscreenshots:\n  ${SHOT_MENU}\n  ${SHOT_GAME}`);
  console.log(
    "\nNote: iOS WebKit audio quirks + env(safe-area) notch insets are NOT emulated by " +
      "Edge/Chromium — confirm the real audio + safe-area on a physical iPhone.",
  );
  process.exitCode = allOk ? 0 : 1;
} catch (err) {
  console.error(`FAIL — exception: ${err.message}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
