// debug-deaths.mjs — one-off: drive level N with the same bot rules as play.mjs but log
// the heroine's position (and nearby tags) at every death. Not part of the test suite.
import { launchBrowser, routeVendorKaplay } from "./browser.mjs";

const TARGET = "http://localhost:8137";
const LEVEL = Number(process.argv[2] || 3);

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await routeVendorKaplay(page);
await page.goto(TARGET, { waitUntil: "domcontentloaded", timeout: 15000 });
await page.waitForFunction(() => window.__pj?.k && window.__pj.k.getSceneName() === "menu", null, { timeout: 15000, polling: 100 });
await page.evaluate((lvl) => {
  localStorage.setItem("pj.character", "anna");
  localStorage.setItem("pj.currentLevel", String(lvl));
}, LEVEL);
await page.reload({ waitUntil: "domcontentloaded", timeout: 15000 });
await page.waitForFunction(() => window.__pj?.k && window.__pj.k.getSceneName() === "menu", null, { timeout: 15000, polling: 100 });
await page.evaluate(() => {
  window.__pj.debug.deaths = 0;
  window.__pj.k.go("game");
});
await page.waitForFunction(() => window.__pj.k.getSceneName() === "game", null, { timeout: 15000, polling: 50 });

// Same tick as play.mjs, plus position capture.
const tick = () =>
  page.evaluate(() => {
    const pj = window.__pj;
    const k = pj.k;
    const inp = pj.input;
    const p = k.get("player")[0];
    const out = {
      deaths: pj.debug.deaths,
      reachedGoal: pj.debug.reachedGoal,
      coinShown: !(document.getElementById("coin-overlay")?.hidden ?? true),
      x: p ? p.pos.x : null,
      y: p ? p.pos.y : null,
      near: [],
    };
    if (!p) { inp.left = false; inp.right = false; return out; }
    // record nearby threats for the log
    for (const tag of ["hazard", "enemy"]) {
      for (const o of k.get(tag)) {
        if (Math.abs(o.pos.x - p.pos.x) < 160 && Math.abs(o.pos.y - p.pos.y) < 160) {
          out.near.push(`${tag}@(${Math.round(o.pos.x)},${Math.round(o.pos.y)})`);
        }
      }
    }
    const px = p.pos.x;
    const feetY = p.pos.y + 46;
    const grounded = !!p.isGrounded();
    const solids = k.get("solid");
    const hazards = k.get("hazard");
    const enemies = k.get("enemy");
    const cxOf = (o) => o.pos.x + (o.spanW || o.width || 64) / 2;
    const spanOf = (o) => o.spanW || o.width || 64;
    const overlapsAhead = (o, from, to) => px + to > o.pos.x && px + from < o.pos.x + spanOf(o);
    const groundAhead = solids.some((s) => s.pos.y > feetY - 12 && s.pos.y < feetY + 170 && overlapsAhead(s, 40, 96));
    const stepUp = solids.some((s) => s.pos.y <= feetY - 12 && s.pos.y > feetY - 150 && overlapsAhead(s, 40, 110));
    const thornAhead = hazards.some((h) => !h.falling && Math.abs(h.pos.y + (h.height || 32) / 2 - feetY) < 90 && cxOf(h) > px + 8 && cxOf(h) < px + 118);
    const stalThreat = hazards.some((h) => h.falling && cxOf(h) > px - 24 && cxOf(h) < px + 88);
    const groundEnemyAhead = enemies.some((e) => Math.abs(e.pos.y - feetY) < 100 && e.pos.x > px + 4 && e.pos.x < px + 96);
    const airEnemyAhead = enemies.some((e) => e.pos.y < feetY - 100 && e.pos.x > px - 24 && e.pos.x < px + 96);
    let action = "run";
    if (stalThreat) action = "wait";
    else if ((!groundAhead || thornAhead || groundEnemyAhead || stepUp) && !airEnemyAhead) action = "jump";
    else if (!groundAhead) action = "jump";
    if (!groundAhead && action === "jump") {
      const mover = solids.find((s) => s.is("mover") && px + 200 > s.base.x - Math.abs(s.ampX) && px + 40 < s.base.x + Math.abs(s.ampX) + spanOf(s));
      if (mover) {
        const top = mover.pos.y;
        const reachable = top > feetY - 130 && top < feetY + 160;
        const inbound = mover.pos.x + spanOf(mover) > px + 30 && mover.pos.x < px + 150;
        if (!(reachable && inbound)) action = "wait";
      }
    }
    for (const h of pj.debug.botHints || []) {
      if (px >= h.x && px < h.x + (h.w || 80)) action = h.do;
    }
    inp.left = false;
    inp.right = action !== "wait";
    if (window.__botJumpHold === undefined) window.__botJumpHold = 0;
    if (action === "jump" && grounded && window.__botJumpHold === 0) {
      inp.jump = true;
      inp.jumpHeld = true;
      window.__botJumpHold = 7;
    } else if (window.__botJumpHold > 0) {
      inp.jumpHeld = true;
      window.__botJumpHold--;
    } else {
      inp.jumpHeld = false;
    }
    out.action = action;
    return out;
  });

const t0 = Date.now();
let seenDeaths = 0;
let last = null;
while (Date.now() - t0 < 60000) {
  const s = await tick();
  if (s.reachedGoal) { console.log(`GOAL after ${seenDeaths} deaths`); break; }
  if (s.coinShown || s.deaths > seenDeaths) {
    seenDeaths = s.deaths;
    const cell = last ? `cell(${(last.x / 64).toFixed(1)}, ${(last.y / 64).toFixed(1)})` : "?";
    console.log(`DEATH #${seenDeaths} at x=${Math.round(last?.x ?? -1)} y=${Math.round(last?.y ?? -1)} ${cell} action=${last?.action} near=[${last?.near.join(" ")}]`);
    if (seenDeaths >= 15) break;
    await page.evaluate(() => document.getElementById("coin-btn")?.click());
    await page.waitForFunction(() => window.__pj.k.getSceneName() === "game", null, { timeout: 15000, polling: 50 }).catch(() => {});
    continue;
  }
  if (s.x != null) {
    last = s;
    // Stall trace: when barely moving, print the full probe state once per second.
    if (globalThis.__trace === undefined) globalThis.__trace = { lastX: -1, since: 0, lastLog: 0 };
    const tr = globalThis.__trace;
    if (Math.abs(s.x - tr.lastX) > 1.2) { tr.lastX = s.x; tr.since = Date.now(); }
    else if (Date.now() - tr.since > 2000 && Date.now() - tr.lastLog > 1000) {
      tr.lastLog = Date.now();
      console.log(`STALL x=${Math.round(s.x)} y=${Math.round(s.y)} cell(${(s.x / 64).toFixed(1)},${(s.y / 64).toFixed(1)}) action=${s.action} near=[${s.near.join(" ")}]`);
    }
  }
  await new Promise((r) => setTimeout(r, 70));
}
await browser.close();
