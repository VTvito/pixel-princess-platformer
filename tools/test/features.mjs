// features.mjs — deeper browser regression test for the polishing features
// (Specifiche_Polishing). Drives the running game in real Edge via the dev handle
// (window.__pj.k) + DOM, and asserts each meta-game / QoL behaviour.
//
// Usage:  python tools/serve.py 8137   (then)   node tools/test/features.mjs
// Exit code 0 = all pass, 1 = a failure or a console error.

import { launchBrowser } from "./browser.mjs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const TARGET = process.argv[2] || process.env.PJ_URL || "http://localhost:8137";
const HERE = dirname(fileURLToPath(import.meta.url));
const SHOT = join(HERE, "features.png");
const T = 15000;

const errors = [];
const results = [];
const check = (name, ok, extra = "") => results.push({ name, ok: !!ok, extra });

const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

  // Boot with a clean slate so Coccoline/mute start from zero/off.
  await page.goto(TARGET, { waitUntil: "domcontentloaded", timeout: T });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => window.__pj?.k && window.__pj.k.getSceneName() === "menu",
    null,
    { timeout: T, polling: 100 },
  );
  check("boots to menu", true);

  // --- §4 Audio: independent Music + SFX buses flip, reflect their icon/state, persist ---
  await page.click("#audio-toggle"); // SFX → off
  const s1 = await page.evaluate(() => ({
    icon: document.getElementById("audio-toggle").textContent,
    ls: localStorage.getItem("pj.sfx"),
  }));
  check("sfx toggle → off", s1.icon.includes("🔇") && s1.ls === "0", JSON.stringify(s1));
  await page.click("#audio-toggle"); // SFX → on
  const s2 = await page.evaluate(() => ({
    icon: document.getElementById("audio-toggle").textContent,
    ls: localStorage.getItem("pj.sfx"),
  }));
  check("sfx toggle → on", s2.icon.includes("🔊") && s2.ls === "1", JSON.stringify(s2));

  await page.click("#music-toggle"); // Music → off (🎵 dims; glyph stays the same)
  const mu1 = await page.evaluate(() => ({
    muted: document.getElementById("music-toggle").classList.contains("is-muted"),
    ls: localStorage.getItem("pj.music"),
  }));
  check("music toggle → off", mu1.muted && mu1.ls === "0", JSON.stringify(mu1));
  await page.click("#music-toggle"); // Music → on
  const mu2 = await page.evaluate(() => ({
    muted: document.getElementById("music-toggle").classList.contains("is-muted"),
    ls: localStorage.getItem("pj.music"),
  }));
  check("music toggle → on", !mu2.muted && mu2.ls === "1", JSON.stringify(mu2));

  // --- Enter gameplay (force the scene; char defaults to the first heroine) ---
  await page.evaluate(() => window.__pj.k.go("game"));
  await page.waitForFunction(
    () => window.__pj.k.getSceneName() === "game" && window.__pj.k.get("player").length > 0,
    null,
    { timeout: T, polling: 100 },
  );
  check("enters game scene", true);

  // Focus the canvas so keystrokes reach Kaplay (the audio-button click stole focus;
  // in real play, clicking Start focuses the canvas). The game scene has no click handler
  // at screen-centre, so this is a harmless focus click.
  await page.mouse.click(640, 360);
  await page.waitForTimeout(50);

  // --- SFX assets registered + playable (Specifiche_Polishing §3/§4). The focus click above
  // is a user gesture, so the AudioContext is unlocked and these silent probes stay quiet. ---
  const sfxMissing = await page.evaluate(() => {
    const k = window.__pj.k;
    const names = ["jump", "collect", "coin", "oops", "goal", "win", "select"];
    const missing = [];
    for (const n of names) {
      try {
        const h = k.play(n, { volume: 0 });
        if (!h) missing.push(n);
        else if (typeof h.stop === "function") h.stop();
      } catch {
        missing.push(n);
      }
    }
    return missing;
  });
  check(
    "sfx assets load + play",
    sfxMissing.length === 0,
    sfxMissing.length ? `missing: ${sfxMissing.join(",")}` : "7/7",
  );

  // Movement (held key → Δx) and jump (apex Δy upward).
  const px = () => page.evaluate(() => window.__pj.k.get("player")[0].pos.x);
  const py = () => page.evaluate(() => window.__pj.k.get("player")[0].pos.y);
  const x0 = await px();
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(400);
  await page.keyboard.up("ArrowRight");
  check("player moves right", (await px()) - x0 > 30, `dx=${((await px()) - x0).toFixed(1)}`);

  const yGround = await py();
  await page.keyboard.press("Space");
  await page.waitForTimeout(180); // sample near apex
  const yApex = await py();
  check("player jumps", yGround - yApex > 30, `dy=${(yGround - yApex).toFixed(1)}`);

  // --- §1 Insert Coin: falling off the world shows the DOM overlay (not Kaplay) ---
  await page.evaluate(() => (window.__pj.k.get("player")[0].pos.y = 999999));
  await page.waitForFunction(() => !document.getElementById("coin-overlay").hidden, null, {
    timeout: T,
    polling: 100,
  });
  check("death shows insert-coin overlay", true);

  // Inserting the coin banks 500, hides the overlay, restarts the level.
  await page.click("#coin-btn");
  await page.waitForFunction(
    () =>
      window.__pj.k.getSceneName() === "game" &&
      document.getElementById("coin-overlay").hidden,
    null,
    { timeout: T, polling: 100 },
  );
  const coc = await page.evaluate(() => localStorage.getItem("totaleCoccoline"));
  check("insert coin banks 500", coc === "500", `totaleCoccoline=${coc}`);

  // --- §2 Finale receipt: shows the running debt ---
  await page.evaluate(() => window.__pj.k.go("finale"));
  await page.waitForFunction(() => !document.getElementById("receipt-overlay").hidden, null, {
    timeout: T,
    polling: 100,
  });
  const amount = await page.evaluate(
    () => document.getElementById("receipt-amount").textContent,
  );
  check("finale receipt shows debt", amount === "500", `amount=${amount}`);
  await page.screenshot({ path: SHOT });

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
  console.log(`\nscreenshot: ${SHOT}`);
  process.exitCode = allOk ? 0 : 1;
} catch (err) {
  console.error(`FAIL — exception: ${err.message}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
