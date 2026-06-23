// features.mjs — deeper browser regression test for the polishing features.
// Drives the running game in real Edge via the dev handle
// (window.__pj.k) + DOM, and asserts each meta-game / QoL behaviour.
//
// Usage:  python tools/serve.py 8137   (then)   node tools/test/features.mjs
// Exit code 0 = all pass, 1 = a failure or a console error.

import { launchBrowser, routeVendorKaplay } from "./browser.mjs";
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
  await routeVendorKaplay(page);
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

  // --- Enter gameplay on Livello 2 (it has crabs — needed for the stomp checks below).
  // state.js reads localStorage at module init, so pin the level and reload first. ---
  await page.evaluate(() => localStorage.setItem("pj.currentLevel", "2"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => window.__pj?.k && window.__pj.k.getSceneName() === "menu",
    null,
    { timeout: T, polling: 100 },
  );
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

  // --- SFX assets registered + playable. The focus click above
  // is a user gesture, so the AudioContext is unlocked and these silent probes stay quiet. ---
  const sfxMissing = await page.evaluate(() => {
    const k = window.__pj.k;
    const names = [
      "jump", "collect", "coin", "oops", "goal", "win", "select",
      "stomp", "spring", "checkpoint", "crumble", "skid",
    ];
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
    sfxMissing.length ? `missing: ${sfxMissing.join(",")}` : "12/12",
  );

  // Movement (held key → Δx) and jump (apex Δy upward), plus the animation state machine
  // driven by the same physics (src/entities/player.js + src/animspec.js).
  const px = () => page.evaluate(() => window.__pj.k.get("player")[0].pos.x);
  const py = () => page.evaluate(() => window.__pj.k.get("player")[0].pos.y);
  const anim = () => page.evaluate(() => window.__pj.k.get("player")[0].curAnim());
  // Hold right and WAIT for actual displacement instead of a fixed timeout — decoding the
  // music WAVs can stall the first frames after boot and eat a fixed-length key window.
  const x0 = await px();
  await page.keyboard.down("ArrowRight");
  const moved = await page
    .waitForFunction((sx) => window.__pj.k.get("player")[0].pos.x > sx + 60, x0, {
      timeout: 4000,
      polling: 50,
    })
    .then(() => true)
    .catch(() => false);
  const runAnim = await anim(); // sampled while the key is still held and she's moving
  await page.keyboard.up("ArrowRight");
  check("player moves right", moved, `dx=${((await px()) - x0).toFixed(1)}`);
  check("run anim while moving", runAnim === "run", `anim=${runAnim}`);

  // HOLD the jump (a bare press releases at a driver-dependent instant, and the variable-
  // height cut then makes the measured rise flaky); a 150ms hold guarantees a full arc.
  const yGround = await py();
  await page.keyboard.down("Space");
  await page.waitForTimeout(150);
  const airAnim = await anim(); // sampled mid-rise while still holding
  await page.keyboard.up("Space");
  await page.waitForTimeout(60); // ~apex
  const yApex = await py();
  check("player jumps", yGround - yApex > 60, `dy=${(yGround - yApex).toFixed(1)}`);
  check("air anim while jumping", airAnim === "jump", `anim=${airAnim}`);

  // --- Fase 1b Pause: ESC freezes the whole game tree + shows the DOM overlay; a held key
  // must not move her while frozen; ESC again resumes (proves k.onKeyPress fires while the
  // tree is paused). A DOM-button safety net unpauses if keyboard-resume ever regresses, so
  // the rest of the suite always runs unfrozen. ---
  await page.keyboard.press("Escape");
  await page
    .waitForFunction(
      () => !document.getElementById("pause-overlay").hidden && window.__pj.k.getTreeRoot().paused,
      null,
      { timeout: 4000, polling: 50 },
    )
    .catch(() => {});
  const pausedState = await page.evaluate(() => ({
    overlay: !document.getElementById("pause-overlay").hidden,
    frozen: window.__pj.k.getTreeRoot().paused,
  }));
  check("ESC pauses + freezes", pausedState.overlay && pausedState.frozen, JSON.stringify(pausedState));

  const xPaused0 = await px();
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(200);
  await page.keyboard.up("ArrowRight");
  const xPaused1 = await px();
  check("frozen world ignores input", Math.abs(xPaused1 - xPaused0) < 1, `dx=${(xPaused1 - xPaused0).toFixed(2)}`);

  await page.keyboard.press("Escape");
  await page
    .waitForFunction(
      () => document.getElementById("pause-overlay").hidden && !window.__pj.k.getTreeRoot().paused,
      null,
      { timeout: 4000, polling: 50 },
    )
    .catch(() => {});
  const resumedState = await page.evaluate(() => ({
    overlay: document.getElementById("pause-overlay").hidden,
    running: !window.__pj.k.getTreeRoot().paused,
  }));
  check("ESC resumes (key works while paused)", resumedState.overlay && resumedState.running, JSON.stringify(resumedState));
  // Safety net + refocus so later probes run on an unfrozen, focused canvas no matter what.
  if (await page.evaluate(() => window.__pj.k.getTreeRoot().paused)) await page.click("#pause-resume");
  await page.mouse.click(640, 360);
  await page.waitForTimeout(50);

  // --- Fase 1c Settings: reachable from pause; a slider writes through to localStorage
  // (the audio bus). Closing it reveals the pause card again. ---
  await page.keyboard.press("Escape"); // pause
  await page.waitForFunction(() => !document.getElementById("pause-overlay").hidden, null, { timeout: 4000, polling: 50 }).catch(() => {});
  await page.click("#pause-settings");
  await page.waitForFunction(() => !document.getElementById("settings-overlay").hidden, null, { timeout: 4000, polling: 50 }).catch(() => {});
  const settingsOpened = await page.evaluate(() => !document.getElementById("settings-overlay").hidden);
  check("settings opens from pause", settingsOpened);
  await page.evaluate(() => {
    const s = document.getElementById("set-music-vol");
    s.value = "30";
    s.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const musicVolLs = await page.evaluate(() => localStorage.getItem("pj.musicVol"));
  check("music slider persists volume", Math.abs(parseFloat(musicVolLs) - 0.3) < 0.02, `pj.musicVol=${musicVolLs}`);
  await page.click("#settings-close");
  await page
    .waitForFunction(
      () => document.getElementById("settings-overlay").hidden && !document.getElementById("pause-overlay").hidden,
      null,
      { timeout: 4000, polling: 50 },
    )
    .catch(() => {});
  const backToPause = await page.evaluate(() => ({
    settings: document.getElementById("settings-overlay").hidden,
    pause: !document.getElementById("pause-overlay").hidden,
  }));
  check("settings closes back to pause", backToPause.settings && backToPause.pause, JSON.stringify(backToPause));
  await page.click("#pause-resume"); // unfreeze for the rest of the suite (focus is off-canvas)
  await page.waitForFunction(() => !window.__pj.k.getTreeRoot().paused, null, { timeout: 4000, polling: 50 }).catch(() => {});
  await page.mouse.click(640, 360);
  await page.waitForTimeout(50);

  // --- Mario-style stomp + hit-stop: drop the heroine onto a crab; the enemy must die
  // and debug.timeScale must come back to 1 (a stranded hit-stop would slow-motion the
  // whole game). This is a feature probe, not a real play-through, so teleporting is fair game. ---
  const stomp = await page.evaluate(async () => {
    const k = window.__pj.k;
    const player = k.get("player")[0];
    const crab = k.get("enemy")[0];
    if (!crab) return { ok: false, why: "no enemy found on level 2" };
    const before = k.get("enemy").length;
    player.pos.x = crab.pos.x;
    player.pos.y = crab.pos.y - 90;
    player.vel.y = 200; // falling onto it → the stomp branch
    await new Promise((r) => setTimeout(r, 600)); // real time — unaffected by hit-stop
    return {
      ok: k.get("enemy").length === before - 1,
      enemies: `${before}→${k.get("enemy").length}`,
      timeScale: k.debug.timeScale,
    };
  });
  check("stomp defeats the enemy", stomp.ok, stomp.why || stomp.enemies);
  check("hit-stop restores time", stomp.timeScale === 1, `timeScale=${stomp.timeScale}`);

  // --- Phase-4 mechanics on Livello 2: the spring launches her, the checkpoint flag
  // arms a mid-level respawn (asserted after the death below). ---
  const springProbe = await page.evaluate(async () => {
    const k = window.__pj.k;
    const player = k.get("player")[0];
    const spring = k.get("spring")[0];
    if (!spring) return { ok: false, why: "no spring on level 2" };
    player.pos.x = spring.pos.x + 20;
    player.pos.y = spring.pos.y - 80;
    player.vel.y = 100; // dropping onto the cap
    await new Promise((r) => setTimeout(r, 250));
    return { ok: player.vel.y < -700, vy: Math.round(player.vel.y) };
  });
  check("spring launches the player", springProbe.ok, springProbe.why || `vy=${springProbe.vy}`);

  const flagX = await page.evaluate(async () => {
    const k = window.__pj.k;
    const player = k.get("player")[0];
    const flag = k.get("checkpoint")[0];
    if (!flag) return null;
    player.pos.x = flag.pos.x + 32; // walk through the flag
    player.pos.y = flag.pos.y + 60;
    player.vel.y = 0;
    await new Promise((r) => setTimeout(r, 300));
    return flag.activated ? flag.pos.x : null;
  });
  check("checkpoint flag activates", flagX !== null, `flagX=${flagX}`);

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

  // The respawn after that death must resume from the checkpoint touched above, not the
  // level's spawn point (Phase-4 checkpoint memory in game.js).
  const respawnX = await page.evaluate(() => window.__pj.k.get("player")[0].pos.x);
  check(
    "respawns at the checkpoint",
    flagX !== null && Math.abs(respawnX - (flagX + 32)) < 80,
    `x=${Math.round(respawnX)} vs flag=${flagX}`,
  );

  // --- Fase Arcade: that same death also spent a life (start LIVES.START=3 → 2). ---
  const livesAfterDeath = await page.evaluate(() => localStorage.getItem("pj.lives"));
  check("a death costs a life", livesAfterDeath === "2", `pj.lives=${livesAfterDeath}`);

  // --- Phase-4 crumble platforms (Livello 3): stand on one → it shakes, falls away,
  // then reforms a few seconds later. ---
  await page.evaluate(() => localStorage.setItem("pj.currentLevel", "3"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => window.__pj?.k && window.__pj.k.getSceneName() === "menu",
    null,
    { timeout: T, polling: 100 },
  );
  await page.evaluate(() => window.__pj.k.go("game"));
  await page.waitForFunction(
    () => window.__pj.k.getSceneName() === "game" && window.__pj.k.get("crumble").length > 0,
    null,
    { timeout: T, polling: 100 },
  );
  const crumble = await page.evaluate(async () => {
    const k = window.__pj.k;
    const player = k.get("player")[0];
    const plat = k.get("crumble")[0];
    player.pos.x = plat.pos.x + 32; // stand on the first ridge tile
    player.pos.y = plat.pos.y - 60;
    player.vel.y = 50;
    const t0 = Date.now();
    let fell = false;
    while (Date.now() - t0 < 4000 && !fell) {
      await new Promise((r) => setTimeout(r, 100));
      fell = plat.state === "falling" || plat.state === "gone";
    }
    if (!fell) return { ok: false, why: `never fell (state=${plat.state})` };
    player.pos.x = 200; // step away so it can reform in peace
    player.pos.y = 200;
    const t1 = Date.now();
    let reformed = false;
    while (Date.now() - t1 < 6000 && !reformed) {
      await new Promise((r) => setTimeout(r, 200));
      reformed = plat.state === "intact";
    }
    return { ok: reformed, why: reformed ? "fell + reformed" : `stuck in ${plat.state}` };
  });
  check("crumble platform falls and reforms", crumble.ok, crumble.why);

  // --- Fase 2 Feather (Livello 5): grabbing it boosts the player's jump force (jumpMul). ---
  await page.evaluate(() => localStorage.setItem("pj.currentLevel", "5"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__pj?.k && window.__pj.k.getSceneName() === "menu", null, { timeout: T, polling: 100 });
  await page.evaluate(() => window.__pj.k.go("game"));
  await page.waitForFunction(
    () => window.__pj.k.getSceneName() === "game" && window.__pj.k.get("player").length > 0 && window.__pj.k.get("feather").length > 0,
    null,
    { timeout: T, polling: 100 },
  );
  const feather = await page.evaluate(async () => {
    const k = window.__pj.k;
    const p = k.get("player")[0];
    const f = k.get("feather")[0];
    if (!f) return { ok: false, why: "no feather on level 5" };
    p.pos.x = f.pos.x;
    p.pos.y = f.pos.y; // overlap → pickup
    await new Promise((r) => setTimeout(r, 250));
    return { ok: Math.abs(p.jumpMul - 1.4) < 0.001, jumpMul: p.jumpMul };
  });
  check("feather grants high-jump", feather.ok, feather.why || `jumpMul=${feather.jumpMul}`);

  // --- Fase 2 Armored swooper (Livello 6): a 2-hp diving guard — survives + enrages on the
  // first stomp, falls on the second. (The Gargoyle is hp 3, so target hp===2 specifically.) ---
  await page.evaluate(() => localStorage.setItem("pj.currentLevel", "6"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__pj?.k && window.__pj.k.getSceneName() === "menu", null, { timeout: T, polling: 100 });
  await page.evaluate(() => window.__pj.k.go("game"));
  await page.waitForFunction(
    () => window.__pj.k.getSceneName() === "game" && window.__pj.k.get("player").length > 0,
    null,
    { timeout: T, polling: 100 },
  );
  await page.mouse.click(640, 360);
  await page.waitForTimeout(50);
  const armored = await page.evaluate(async () => {
    const k = window.__pj.k;
    const p = k.get("player")[0];
    const e = k.get("enemy").find((x) => x.hp === 2);
    if (!e) return { ok: false, why: "no armored (hp=2) enemy on level 6" };
    const t0 = e.swoopTime;
    p.pos.x = e.pos.x;
    p.pos.y = e.pos.y - 90;
    p.vel.y = 200; // fall onto it → stomp
    await new Promise((r) => setTimeout(r, 350));
    const survived = e.exists() && e.hp === 1;
    const enraged = e.swoopTime < t0;
    let killed = false;
    if (e.exists()) {
      p.pos.x = e.pos.x;
      p.pos.y = e.pos.y - 90;
      p.vel.y = 200;
      await new Promise((r) => setTimeout(r, 450));
      killed = !e.exists();
    }
    return { ok: survived && killed, survived, enraged, killed };
  });
  check("armored swooper takes two stomps", armored.ok, armored.why || JSON.stringify(armored));
  check("armored swooper enrages when wounded", !!armored.enraged, JSON.stringify(armored));

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

  // --- §3 Animation contract: the finale avatar wears all six skins, celebrates, and
  // every skin layer mirrors the body's sheet frame (src/animspec.js sync contract). ---
  const avatarState = await page.evaluate(() => {
    const av = window.__pj.k.get("avatar")[0];
    return av
      ? { anim: av.curAnim(), frame: av.frame, layerFrames: av.skinLayers.map((l) => l.frame) }
      : null;
  });
  check("finale avatar celebrates", avatarState?.anim === "celebrate", `anim=${avatarState?.anim}`);
  check(
    "skin layers frame-synced",
    avatarState && avatarState.layerFrames.length === 6 &&
      avatarState.layerFrames.every((f) => f === avatarState.frame),
    JSON.stringify(avatarState),
  );
  await page.screenshot({ path: SHOT });

  // --- Fase Arcade: hearts grant a life, and losing them all triggers Game Over (back to
  // level 1, score wiped, Coccoline tab KEPT). Run last, so the earlier finale-receipt
  // assertion still sees only the single 500 from the §1 death. ---
  await page.evaluate(() => {
    localStorage.setItem("pj.currentLevel", "1");
    localStorage.setItem("pj.lives", "3");
    localStorage.setItem("pj.score", "0");
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__pj?.k && window.__pj.k.getSceneName() === "menu", null, { timeout: T, polling: 100 });
  await page.evaluate(() => window.__pj.k.go("game"));
  await page.waitForFunction(
    () =>
      window.__pj.k.getSceneName() === "game" &&
      window.__pj.k.get("player").length > 0 &&
      window.__pj.k.get("heart").length > 0,
    null,
    { timeout: T, polling: 100 },
  );
  const heartProbe = await page.evaluate(async () => {
    const k = window.__pj.k;
    const p = k.get("player")[0];
    const h = k.get("heart")[0];
    const before = Number(localStorage.getItem("pj.lives"));
    p.pos.x = h.pos.x;
    p.pos.y = h.pos.y; // overlap → pickup
    await new Promise((r) => setTimeout(r, 250));
    return {
      ok: !h.exists() && Number(localStorage.getItem("pj.lives")) === before + 1,
      before,
      after: localStorage.getItem("pj.lives"),
    };
  });
  check("heart grants +1 life", heartProbe.ok, `${heartProbe.before}→${heartProbe.after}`);

  // Spend every life: each death banks 500 + a life; at 0 the Game Over overlay appears.
  const over = await page.evaluate(async () => {
    const k = window.__pj.k;
    const seeCoin = () => !document.getElementById("coin-overlay").hidden;
    const seeOver = () => !document.getElementById("gameover-overlay").hidden;
    for (let i = 0; i < 8; i++) {
      const pl = k.get("player")[0];
      if (pl) pl.pos.y = 999999; // fall off the world → die
      const t0 = Date.now();
      while (Date.now() - t0 < 2500 && !seeCoin() && !seeOver()) await new Promise((r) => setTimeout(r, 50));
      if (seeOver()) return { reached: true };
      if (seeCoin()) {
        document.getElementById("coin-btn").click();
        const t1 = Date.now();
        while (
          Date.now() - t1 < 2500 &&
          (k.getSceneName() !== "game" || seeCoin() || k.get("player").length === 0)
        ) {
          await new Promise((r) => setTimeout(r, 50));
        }
      }
    }
    return { reached: seeOver() };
  });
  check("losing all lives shows Game Over", over.reached);
  const reset = await page.evaluate(() => ({
    level: localStorage.getItem("pj.currentLevel"),
    score: localStorage.getItem("pj.score"),
    lives: localStorage.getItem("pj.lives"),
    coccoline: Number(localStorage.getItem("totaleCoccoline")),
  }));
  check("Game Over resets to level 1", reset.level === "1", `level=${reset.level}`);
  check("Game Over wipes the score", reset.score === "0", `score=${reset.score}`);
  check("Game Over refills lives", reset.lives === "3", `lives=${reset.lives}`);
  check("Game Over keeps the Coccoline tab", reset.coccoline > 0, `coccoline=${reset.coccoline}`);

  // The Game Over button restarts the journey at level 1.
  await page.click("#gameover-btn");
  await page.waitForFunction(
    () =>
      window.__pj.k.getSceneName() === "game" &&
      document.getElementById("gameover-overlay").hidden &&
      window.__pj.k.get("player").length > 0,
    null,
    { timeout: T, polling: 100 },
  );
  check("Game Over restart boots a fresh run", true);

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
