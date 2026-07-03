// Standalone browser smoke test for Un dono per Anna.
//
// Launches the installed Microsoft Edge via playwright-core (NO browser download)
// and verifies the game boots cleanly to the menu with no console/page errors —
// i.e. ES modules load (the Windows .js MIME trap), assets resolve, and Kaplay
// renders without throwing (e.g. the `[tag]` styled-text crash).
//
// Why Edge + playwright-core: Chrome isn't installed here and can't be without
// admin; the Playwright MCP is hard-wired to Chrome. See the project memory notes
// (playwright-testing-setup / dev-environment / kaplay-text-bracket-gotcha).
//
// Usage:
//   python tools/serve.py 8137      # in one terminal (or: npm run serve)
//   node tools/test/smoke.mjs       # in another (or: npm test)
//   node tools/test/smoke.mjs http://localhost:8080   # custom URL
//
// Exit code 0 = pass, 1 = fail. A screenshot is always written to tools/test/smoke.png.

import { launchBrowser, routeVendorKaplay } from "./browser.mjs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const TARGET = process.argv[2] || process.env.PJ_URL || "http://localhost:8137";
const HERE = dirname(fileURLToPath(import.meta.url));
const SHOT = join(HERE, "smoke.png");
const TIMEOUT = 15000;

const errors = [];

const browser = await launchBrowser();
try {
  // 1280x720 == the game's virtual resolution, so screen coords map 1:1 to world.
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await routeVendorKaplay(page);

  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
  });
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));

  await page.goto(TARGET, { waitUntil: "domcontentloaded", timeout: TIMEOUT });

  // The dev handle (window.__pj.k) is exposed only on localhost (see src/main.js).
  // The loading scene calls k.go("menu") once assets finish — wait for that.
  await page.waitForFunction(
    () => window.__pj?.k && window.__pj.k.getSceneName() === "menu",
    null,
    { timeout: TIMEOUT, polling: 100 },
  );

  const scene = await page.evaluate(() => window.__pj.k.getSceneName());
  await page.screenshot({ path: SHOT });

  if (errors.length) {
    throw new Error("console/page errors:\n  " + errors.join("\n  "));
  }

  console.log(`PASS — booted to "${scene}" scene, no console errors`);
  console.log(`       screenshot: ${SHOT}`);
} catch (err) {
  console.error(`FAIL — ${err.message}`);
  console.error(`       (is the server up? run: python tools/serve.py 8137)`);
  console.error(`       screenshot (if any): ${SHOT}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
