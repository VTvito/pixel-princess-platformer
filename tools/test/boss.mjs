// boss.mjs — regression test for the Livello 6 final boss ("Custode di Pietra").
//
// The boss is the one piece the author can't easily playtest by hand, so this gate proves the
// invariants that keep it FAIR and SOFTLOCK-PROOF, driving the game through the dev handle
// (window.__pj):
//   • it spawns on Livello 6 only (and never on another level);
//   • it runs its deterministic phase loop into a VULNERABLE WINDOW (invulnerable → false) at a
//     lower, stompable height, and back out — so the fight always comes back around;
//   • it actually FIRES attacks (transient "boss-attack" hazards appear);
//   • a stomp during the window DAMAGES it (hp 2 → 1) — i.e. it's beatable with jump+stomp;
//   • it GATES the goal: with the boss alive the ballroom doors stay sealed; once it's gone the
//     goal completes and progress advances (Livello 6 → 7).
// The full 2-stomp kill is verified by hand in-browser; here we prove the mechanic + the gate.
//
// Usage:  python tools/serve.py 8137   (then)   node tools/test/boss.mjs
// Exit code 0 = all pass, 1 = a failure or a console error.

import { launchBrowser, routeVendorKaplay } from "./browser.mjs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const TARGET = process.argv[2] || process.env.PJ_URL || "http://localhost:8137";
const HERE = dirname(fileURLToPath(import.meta.url));
const SHOT = join(HERE, "boss.png");
const T = 15000;

const errors = [];
const results = [];
const check = (name, ok, extra = "") => results.push({ name, ok: !!ok, extra });

// Boot a given level into the game scene (state.js reads localStorage at module init, so the
// level is pinned + the page reloaded before entering).
async function bootLevel(page, lvl) {
  await page.evaluate((n) => {
    localStorage.setItem("pj.character", "anna");
    localStorage.setItem("pj.currentLevel", String(n));
  }, lvl);
  await page.reload({ waitUntil: "domcontentloaded", timeout: T });
  await page.waitForFunction(() => window.__pj?.k && window.__pj.k.getSceneName() === "menu", null, {
    timeout: T,
    polling: 100,
  });
  await page.evaluate(() => window.__pj.k.go("game"));
  await page.waitForFunction(
    () => window.__pj.k.getSceneName() === "game" && window.__pj.k.get("player").length > 0,
    null,
    { timeout: T, polling: 100 },
  );
}

const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await routeVendorKaplay(page);
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

  await page.goto(TARGET, { waitUntil: "domcontentloaded", timeout: T });

  // --- Livello 6: the boss spawns (exactly one), with the expected starting state ---
  await bootLevel(page, 6);
  const spawn = await page.evaluate(() => {
    const b = window.__pj.k.get("boss");
    return {
      count: b.length,
      hp: b[0]?.hp,
      invulnerable: b[0]?.invulnerable,
      phase: b[0]?.phase,
      goals: window.__pj.k.get("goal").length,
    };
  });
  check("boss spawns on Livello 6", spawn.count === 1, `count=${spawn.count}`);
  check("boss starts at full hp + invulnerable", spawn.hp === 2 && spawn.invulnerable === true, JSON.stringify(spawn));
  check("Livello 6 still has its goal", spawn.goals > 0, `goals=${spawn.goals}`);

  // --- Gate CLOSED: with the boss alive the goal is sealed. Park the boss (pause its AI + clear
  // any in-flight attacks) so the probe can't be interrupted by a hit, then teleport the heroine
  // into the goal beam: progress must NOT advance. ---
  const gateClosed = await page.evaluate(async () => {
    const k = window.__pj.k;
    const boss = k.get("boss")[0];
    boss.paused = true; // freeze its AI/attacks for a clean probe
    k.get("boss-attack").forEach((h) => k.destroy(h));
    const g = k.get("goal")[0];
    const p = k.get("player")[0];
    p.pos.x = g.pos.x - 300; p.pos.y = g.pos.y; p.vel.y = 0; // ensure not overlapping first
    await new Promise((r) => setTimeout(r, 120));
    p.pos.x = g.pos.x; p.pos.y = g.pos.y; p.vel.y = 0; // into the beam
    await new Promise((r) => setTimeout(r, 350));
    boss.paused = false; // resume for the rest of the test
    return localStorage.getItem("pj.currentLevel");
  });
  check("goal is GATED while the boss lives", gateClosed === "6", `currentLevel=${gateClosed}`);

  // --- Observe the phase loop (no interaction — the heroine is parked far away at spawn, so the
  // boss's local attacks can't reach her). Prove it opens a vulnerable window, fires attacks, and
  // moves between a high (out-of-reach) attack pose and a low (stompable) window pose. ---
  const obs = await page.evaluate(async () => {
    const k = window.__pj.k;
    const p = k.get("player")[0];
    p.pos.x = 160; p.pos.y = 200; // park her at the level's far-left spawn, clear of the arena
    let sawVul = false, sawInv = false, attacksMax = 0;
    let minY = Infinity, maxY = -Infinity;
    let vulYsum = 0, vulN = 0, invYsum = 0, invN = 0;
    const phases = new Set();
    const t0 = Date.now();
    while (Date.now() - t0 < 7000) {
      const b = k.get("boss")[0];
      if (b) {
        phases.add(b.phase);
        minY = Math.min(minY, b.pos.y);
        maxY = Math.max(maxY, b.pos.y);
        if (b.invulnerable) { sawInv = true; invYsum += b.pos.y; invN++; }
        else { sawVul = true; vulYsum += b.pos.y; vulN++; }
      }
      attacksMax = Math.max(attacksMax, k.get("boss-attack").length);
      // keep her parked (away) so a stray attack never ends the run mid-observation
      p.pos.x = 160; p.pos.y = 200; p.vel.y = 0;
      await new Promise((r) => setTimeout(r, 60));
    }
    return {
      sawVul, sawInv, attacksMax,
      descend: Math.round(maxY - minY),
      vulAvg: vulN ? Math.round(vulYsum / vulN) : null,
      invAvg: invN ? Math.round(invYsum / invN) : null,
      phases: [...phases],
    };
  });
  check("boss opens a vulnerable window", obs.sawVul, JSON.stringify(obs));
  check("boss also hides (invulnerable) between windows", obs.sawInv, JSON.stringify(obs));
  check("boss fires attacks (shockwave / debris)", obs.attacksMax > 0, `attacksMax=${obs.attacksMax}`);
  check("boss descends a meaningful distance", obs.descend >= 100, `descendΔ=${obs.descend}px`);
  check(
    "boss is LOWER while vulnerable than while attacking",
    obs.vulAvg !== null && obs.invAvg !== null && obs.vulAvg > obs.invAvg,
    `vulY=${obs.vulAvg} > invY=${obs.invAvg}`,
  );

  await page.screenshot({ path: SHOT });

  // --- A stomp during the window DAMAGES the boss (hp 2 → 1): wait for the window, clear any
  // in-flight attack, drop onto the boss from above. Proves it's beatable with jump+stomp. ---
  const damage = await page.evaluate(async () => {
    const k = window.__pj.k;
    // wait for an open window
    let boss = null;
    const t0 = Date.now();
    while (Date.now() - t0 < 9000) {
      const b = k.get("boss")[0];
      if (b && !b.invulnerable) { boss = b; break; }
      await new Promise((r) => setTimeout(r, 40));
    }
    if (!boss) return { ok: false, why: "window never opened" };
    const hp0 = boss.hp;
    k.get("boss-attack").forEach((h) => k.destroy(h)); // clear so the stomp probe can't be killed
    const p = k.get("player")[0];
    p.pos.x = boss.pos.x; p.pos.y = boss.pos.y - 80; p.vel.y = 240; // fall onto it → stomp branch
    await new Promise((r) => setTimeout(r, 350));
    return { ok: boss.exists() && boss.hp === hp0 - 1, hp: `${hp0}→${boss.hp}`, retreated: boss.invulnerable };
  });
  check("a stomp wounds the boss (hp −1)", damage.ok, damage.why || `hp ${damage.hp}`);
  check("the wounded boss retreats (re-invulnerable)", damage.retreated === true, JSON.stringify(damage));

  // --- Gate OPEN: once the boss is gone the doors unseal — destroy it (a stand-in for the final
  // stomp), teleport the heroine into the goal, and progress must advance (Livello 6 → 7). ---
  const gateOpen = await page.evaluate(async () => {
    const k = window.__pj.k;
    k.get("boss").forEach((b) => k.destroy(b)); // as if felled
    k.get("boss-attack").forEach((h) => k.destroy(h));
    const g = k.get("goal")[0];
    const p = k.get("player")[0];
    p.pos.x = g.pos.x - 300; p.pos.y = g.pos.y; p.vel.y = 0; // exit any prior overlap
    await new Promise((r) => setTimeout(r, 120));
    p.pos.x = g.pos.x; p.pos.y = g.pos.y; p.vel.y = 0; // into the beam → reward flow
    const t0 = Date.now();
    while (Date.now() - t0 < 3000 && localStorage.getItem("pj.currentLevel") !== "7") {
      await new Promise((r) => setTimeout(r, 60));
    }
    return localStorage.getItem("pj.currentLevel");
  });
  check("goal OPENS once the boss is felled (L6 → 7)", gateOpen === "7", `currentLevel=${gateOpen}`);

  // --- The boss is exclusive to Livello 6: no other level spawns one (spot-check L5). ---
  await bootLevel(page, 5);
  const l5 = await page.evaluate(() => window.__pj.k.get("boss").length);
  check("no boss on other levels (L5)", l5 === 0, `count=${l5}`);

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
  console.error(`       (is the server up? run: python tools/serve.py 8137)`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
