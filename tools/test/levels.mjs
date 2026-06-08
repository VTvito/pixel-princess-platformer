// Per-level visual + smoke check for The Princess Journey.
//
// Boots each playable level (1–4) in the installed Edge via playwright-core, asserts it
// renders with no console/page errors and that the world actually built (a goal + the
// collectibles exist), and writes a screenshot per level to tools/test/level{N}.png so the
// themed art — parallax ridges, ambient particles (bubbles / embers / snow), and the
// collectible aura — can be eyeballed. Complements smoke.mjs (menu) and features.mjs (rules).
//
// Why Edge + playwright-core: see the project memory notes (playwright-testing-setup).
//
// Usage:
//   python tools/serve.py 8137      # one terminal (or: npm run serve)
//   node tools/test/levels.mjs      # another (or: npm run test:levels)
//
// Exit code 0 = pass, 1 = fail. Screenshots are always written.

import { launchBrowser } from "./browser.mjs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const TARGET = process.argv[2] || process.env.PJ_URL || "http://localhost:8137";
const HERE = dirname(fileURLToPath(import.meta.url));
const TIMEOUT = 15000;
const LEVELS = [1, 2, 3, 4];

const allErrors = [];
let failed = false;

const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("console", (msg) => {
    if (msg.type() === "error") allErrors.push(`console.error: ${msg.text()}`);
  });
  page.on("pageerror", (err) => allErrors.push(`pageerror: ${err.message}`));

  await page.goto(TARGET, { waitUntil: "domcontentloaded", timeout: TIMEOUT });

  for (const n of LEVELS) {
    const before = allErrors.length;

    // Pin the character + level, then reload so state.js re-reads them at module init
    // (the in-memory mirror is seeded once on load, so setting storage alone isn't enough).
    await page.evaluate((lvl) => {
      localStorage.setItem("pj.character", "anna");
      localStorage.setItem("pj.currentLevel", String(lvl));
    }, n);
    await page.reload({ waitUntil: "domcontentloaded", timeout: TIMEOUT });

    await page.waitForFunction(
      () => window.__pj?.k && window.__pj.k.getSceneName() === "menu",
      null,
      { timeout: TIMEOUT, polling: 100 },
    );
    await page.evaluate(() => window.__pj.k.go("game"));
    await page.waitForFunction(() => window.__pj.k.getSceneName() === "game", null, {
      timeout: TIMEOUT,
      polling: 50,
    });

    // Let parallax settle and a few ambient particles / goal motes spawn.
    await page.waitForTimeout(700);

    const counts = await page.evaluate(() => ({
      level: window.__pj.k.get("collectible").length,
      goals: window.__pj.k.get("goal").length,
    }));

    const shot = join(HERE, `level${n}.png`);
    await page.screenshot({ path: shot });

    const newErrors = allErrors.slice(before);
    const ok = newErrors.length === 0 && counts.goals > 0 && counts.level > 0;
    if (!ok) failed = true;
    const status = ok ? "PASS" : "FAIL";
    console.log(
      `${status} — Livello ${n}: ${counts.level} collectibles, ${counts.goals} goal` +
        (newErrors.length ? `\n        errors:\n          ${newErrors.join("\n          ")}` : "") +
        `\n        screenshot: ${shot}`,
    );
  }

  if (failed) throw new Error("one or more levels failed");
  console.log("\nAll 4 levels booted cleanly.");
} catch (err) {
  console.error(`\nFAIL — ${err.message}`);
  console.error(`       (is the server up? run: python tools/serve.py 8137)`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
