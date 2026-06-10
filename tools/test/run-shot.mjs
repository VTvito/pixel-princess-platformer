// run-shot.mjs — one-off visual probe: boot a level, hold right, screenshot mid-run.
// Usage: node tools/test/run-shot.mjs [level]   (server must be up on :8137)

import { launchBrowser, routeVendorKaplay } from "./browser.mjs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const level = Number(process.argv[2] || 4);

const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await routeVendorKaplay(page);
  await page.goto("http://localhost:8137", { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForFunction(() => window.__pj?.k?.getSceneName() === "menu", null, { timeout: 15000 });
  await page.evaluate((lvl) => {
    localStorage.setItem("pj.character", "anna");
    localStorage.setItem("pj.currentLevel", String(lvl));
  }, level);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__pj?.k?.getSceneName() === "menu", null, { timeout: 15000 });
  await page.evaluate(() => window.__pj.k.go("game"));
  await page.waitForFunction(() => window.__pj.k.getSceneName() === "game", null, { timeout: 15000 });
  await page.evaluate(() => (window.__pj.input.right = true));
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(HERE, "run-shot.png") });
  await page.evaluate(() => (window.__pj.input.right = false));
  console.log("screenshot:", join(HERE, "run-shot.png"));
} finally {
  await browser.close();
}
