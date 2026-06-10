// Autoplay reachability test for The Princess Journey.
//
// A rule-based bot drives each playable level (1–4) to its goal in the installed Microsoft
// Edge (via playwright-core — no browser download) and asserts the casual path is actually
// completable. This is the regression guard that would have caught the oversized-player / 1-
// tile level mismatch that made Livello 1 unplayable: a level whose goal can't be reached
// fails here instead of in the player's hands.
//
// HOW IT DRIVES THE GAME: on localhost the game exposes window.__pj.input (the live virtual-
// input object) and window.__pj.debug (deaths + reachedGoal), see src/main.js. Each tick the
// bot looks a little way ahead using the live game objects and decides — like a cautious
// player would:
//   • RUN by default (hold right);
//   • JUMP when a ravine, a lane hazard (thorn/urchin/spike), or a ground enemy (crab) is
//     just ahead — but NOT when an air enemy (flyer) hangs ahead, so it runs underneath;
//   • WAIT (stop) while a stalactite is dropping in the column ahead, then resume.
// On death it banks the "Insert Coin" overlay to retry from the spawn.
//
// IS THIS A LEGITIMATE "PLAYER"? Yes. The bot writes ONLY the virtual-input flags
// (left/right/jump/jumpHeld) on window.__pj.input — the exact same object the keyboard
// handlers populate (src/controls.js). Every move therefore goes through the real physics,
// collision, jump-arc and respawn code, identically to a human pressing keys. The bot never
// writes player.pos or player.vel: it does NOT teleport, set speed, or otherwise cheat — it
// only decides which "buttons" to hold. The single difference from a human is that it sets
// the flags directly instead of dispatching synthetic key events (this keeps it robust across
// the scene rebuilds a respawn triggers). assertInputContract() below enforces that invariant.
//
// Why Edge + playwright-core: see the project memory notes (playwright-testing-setup) and the
// sibling smoke.mjs / levels.mjs.
//
// Usage:
//   python tools/serve.py 8137                  # one terminal (or: npm run serve)
//   node tools/test/play.mjs                    # another (or: npm run test:play)
//   node tools/test/play.mjs --levels 2,3       # only some levels — cheap while iterating
//   PJ_LEVELS=4 node tools/test/play.mjs        # same, via env
//
// Exit code 0 = every requested level reached its goal; 1 = at least one was unreachable.

import { launchBrowser, routeVendorKaplay } from "./browser.mjs";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

// Args: an optional target URL and an optional --levels filter, in any order.
const args = process.argv.slice(2);
let urlArg = null;
let levelsArg = process.env.PJ_LEVELS || null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--levels") levelsArg = args[++i];
  else if (args[i].startsWith("--levels=")) levelsArg = args[i].slice("--levels=".length);
  else urlArg = args[i];
}
const TARGET = urlArg || process.env.PJ_URL || "http://localhost:8137";
void dirname(fileURLToPath(import.meta.url)); // (kept for parity with sibling tests)
const BOOT_TIMEOUT = 15000;
const ALL_LEVELS = [1, 2, 3, 4];
const LEVELS = levelsArg
  ? levelsArg.split(",").map((s) => Number(s.trim())).filter((n) => ALL_LEVELS.includes(n))
  : ALL_LEVELS;
if (LEVELS.length === 0) {
  console.error(`FAIL — no valid levels in "${levelsArg}" (expected e.g. --levels 2,3 with levels 1-4)`);
  process.exit(2);
}

// WHAT THIS GUARDS — and what it does NOT. This is a REACHABILITY check: "does a completable
// path exist?" It is NOT a balance/quality/fun gate, and the bot is deliberately impeded
// (1–2 cells of look-ahead, fixed rules, a fixed-length jump hold, no human timing). So:
//   • A level PASSES when the bot reaches the goal within the death tolerance below.
//   • Non-zero deaths are EXPECTED, especially on moving-enemy levels (a slow crab a human
//     would simply time or stomp can still catch the cautious bot). Deaths are reported as
//     information, not a regression — DO NOT tune levels to push this count to zero (that
//     would flatten the game; dying sometimes is the point — see the "Insert Coin" meta).
//   • A SUDDEN failure (can't reach the goal, wedged, or deaths blow past the tolerance) right
//     after a change is the real signal: investigate it as a likely introduced bug.
//
// Bot tuning (ms). Generous — this checks "is there a path", not speedrunning.
const POLL = 70; // sample/drive cadence
const LEVEL_BUDGET = 120000; // wall-clock per level before giving up; headroom for retries (each
//                              respawn replays from the start) so a few deaths never time out
const STALL_FAIL = 4000; // wedged (not deliberately waiting) this long → blocked: report x
const WAIT_FAIL = 5000; // waiting on a hazard this long → something is wrong
const DEATH_TOLERANCE = 15; // respawns allowed before we call the path un-completable (NOT a
//                             target to minimise — the impeded bot is expected to die some)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// One round-trip per tick: look ahead, choose run/jump/wait, apply input, read state back.
const tick = (page) =>
  page.evaluate(() => {
    const pj = window.__pj;
    const k = pj.k;
    const inp = pj.input;
    const p = k.get("player")[0];
    const goal = k.get("goal")[0];
    const out = {
      scene: typeof k.getSceneName === "function" ? k.getSceneName() : null,
      deaths: pj.debug.deaths,
      reachedGoal: pj.debug.reachedGoal,
      coinShown: !(document.getElementById("coin-overlay")?.hidden ?? true),
      x: p ? p.pos.x : null,
      goalX: goal ? goal.pos.x : null,
      grounded: false,
      action: "run",
    };
    if (!p) {
      inp.left = false;
      inp.right = false;
      return out;
    }
    const px = p.pos.x;
    const grounded = !!p.isGrounded();
    out.grounded = grounded;

    const solids = k.get("solid");
    const hazards = k.get("hazard");
    const enemies = k.get("enemy");
    const cxOf = (o) => o.pos.x + (o.width || 64) / 2; // solids/hazards anchor top-left

    // Lane ground present a little ahead of the feet? (row-6 perches sit at y≈384 and are
    // excluded by the y>540 floor test, so they don't read as "ground".)
    const probe = px + 58;
    const groundAhead = solids.some(
      (s) => s.pos.y > 540 && probe >= s.pos.x && probe < s.pos.x + (s.width || 64),
    );
    // A thorn / urchin / ice-spike on the lane just ahead. The look-ahead (px+118) gives the
    // hop enough lead to clear the spike under the new variable-jump arc (the old px+82 was
    // tuned to the symmetric arc and sometimes fired too late, clipping the spike on take-off).
    const thornAhead = hazards.some(
      (h) => !h.falling && h.pos.y > 500 && cxOf(h) > px + 8 && cxOf(h) < px + 118,
    );
    // A stalactite dropping in the column over / just ahead of the heroine.
    const stalThreat = hazards.some((h) => h.falling && cxOf(h) > px - 24 && cxOf(h) < px + 88);
    // A ground enemy (crab) to hop over (enemies use a centred anchor).
    const crabAhead = enemies.some((e) => e.pos.y > 480 && e.pos.x > px + 4 && e.pos.x < px + 96);
    // An air enemy (flyer) just ahead — run underneath, don't hop into it.
    const flyerAhead = enemies.some((e) => e.pos.y <= 480 && e.pos.x > px - 24 && e.pos.x < px + 96);

    let action = "run";
    if (stalThreat) action = "wait";
    else if ((!groundAhead || thornAhead || crabAhead) && !flyerAhead) action = "jump";

    inp.left = false;
    inp.right = action !== "wait";

    // Variable jump height: the player now cuts the rise if jumpHeld goes false early, so a
    // single-tick tap only gives the minimum hop. To clear ravines/obstacles the bot must
    // HOLD the jump for several ticks. Start a hold when grounded and a jump is wanted, then
    // keep jumpHeld up for ~7 ticks (≈0.5s, the full rise) before releasing.
    if (window.__botJumpHold === undefined) window.__botJumpHold = 0;
    if (action === "jump" && grounded && window.__botJumpHold === 0) {
      inp.jump = true; // edge: triggers the jump this frame
      inp.jumpHeld = true;
      window.__botJumpHold = 7;
    } else if (window.__botJumpHold > 0) {
      inp.jumpHeld = true; // keep holding through the rise
      window.__botJumpHold--;
    } else {
      inp.jumpHeld = false;
    }
    out.action = action;
    return out;
  });

// Anti-cheat invariant: the input object the bot drives must expose ONLY the four virtual
// buttons, and window.__pj must not hand out a way to write the player's position/velocity.
// If this ever fails, the "autoplay" would no longer be playing the way a human can — the
// test should be fixed (or the leak removed) rather than silently driving the game unfairly.
async function assertInputContract(page) {
  const report = await page.evaluate(() => {
    const pj = window.__pj;
    const allowed = ["left", "right", "jump", "jumpHeld"];
    const keys = Object.keys(pj.input);
    const extra = keys.filter((kk) => !allowed.includes(kk));
    return { keys, extra, pjKeys: Object.keys(pj) };
  });
  if (report.extra.length) {
    throw new Error(`autoplay input contract broken — unexpected input fields: ${report.extra.join(", ")}`);
  }
  // __pj is a dev handle; it should not expose player pos/vel writers to the driver.
  if (report.pjKeys.some((kk) => /pos|vel|setpos|teleport/i.test(kk))) {
    throw new Error(`autoplay handle leaks position/velocity control: ${report.pjKeys.join(", ")}`);
  }
}

async function bootMenu(page) {
  await page.waitForFunction(
    () => window.__pj?.k && window.__pj.k.getSceneName() === "menu",
    null,
    { timeout: BOOT_TIMEOUT, polling: 100 },
  );
}

async function playLevel(page, n) {
  // Pin character + level, then reload so state.js re-reads them at module init.
  await page.evaluate((lvl) => {
    localStorage.setItem("pj.character", "anna");
    localStorage.setItem("pj.currentLevel", String(lvl));
  }, n);
  await page.reload({ waitUntil: "domcontentloaded", timeout: BOOT_TIMEOUT });
  await bootMenu(page);

  // Zero the counters for a clean per-level reading, then drop into gameplay.
  await page.evaluate(() => {
    window.__pj.debug.deaths = 0;
    window.__pj.debug.reachedGoal = false;
    window.__pj.k.go("game");
  });
  await page.waitForFunction(() => window.__pj.k.getSceneName() === "game", null, {
    timeout: BOOT_TIMEOUT,
    polling: 50,
  });

  const t0 = Date.now();
  let lastX = -Infinity;
  let maxX = -Infinity;
  let stall = 0;
  let waiting = 0;
  let seenDeaths = 0;
  let goalX = null;
  let lastX2 = null;

  while (Date.now() - t0 < LEVEL_BUDGET) {
    const s = await tick(page);
    if (s.goalX != null) goalX = s.goalX;

    if (s.reachedGoal) {
      return { ok: true, level: n, maxX, goalX, deaths: s.deaths, ms: Date.now() - t0 };
    }

    // Death → bank the coin to respawn, then reset the watchdog.
    if (s.coinShown || s.deaths > seenDeaths) {
      seenDeaths = s.deaths;
      if (seenDeaths >= DEATH_TOLERANCE) {
        return { ok: false, level: n, why: "too many deaths", maxX, goalX, deaths: seenDeaths, ms: Date.now() - t0 };
      }
      await page.evaluate(() => document.getElementById("coin-btn")?.click());
      await page
        .waitForFunction(() => window.__pj.k.getSceneName() === "game", null, {
          timeout: BOOT_TIMEOUT,
          polling: 50,
        })
        .catch(() => {});
      lastX = -Infinity;
      stall = 0;
      waiting = 0;
      continue;
    }

    if (typeof s.x === "number") {
      if (s.x > maxX) maxX = s.x;
      lastX2 = s.x;
      if (s.action === "wait") {
        waiting += POLL;
        stall = 0;
        if (waiting >= WAIT_FAIL) {
          return { ok: false, level: n, why: "stuck waiting on a hazard", maxX, goalX, deaths: s.deaths, stuckX: lastX2, ms: Date.now() - t0 };
        }
      } else {
        waiting = 0;
        if (s.x > lastX + 1.2) stall = 0;
        else stall += POLL;
        lastX = s.x;
        if (stall >= STALL_FAIL) {
          return { ok: false, level: n, why: "stuck", maxX, goalX, deaths: s.deaths, stuckX: lastX2, ms: Date.now() - t0 };
        }
      }
    }
    await sleep(POLL);
  }
  return { ok: false, level: n, why: "timeout", maxX, goalX, deaths: seenDeaths, stuckX: lastX2, ms: Date.now() - t0 };
}

const browser = await launchBrowser();
let failed = false;
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await routeVendorKaplay(page);
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(TARGET, { waitUntil: "domcontentloaded", timeout: BOOT_TIMEOUT });
  await bootMenu(page);
  await assertInputContract(page); // fail fast if the bot could cheat / drives the wrong thing

  for (const n of LEVELS) {
    const r = await playLevel(page, n);
    const pct = r.goalX ? Math.round((Math.max(0, r.maxX) / r.goalX) * 100) : "?";
    if (r.ok) {
      console.log(`PASS — Livello ${n}: reached goal in ${(r.ms / 1000).toFixed(1)}s, ${r.deaths} death(s)`);
    } else {
      failed = true;
      const at = r.stuckX != null ? `, wedged near x=${Math.round(r.stuckX)}` : "";
      console.log(
        `FAIL — Livello ${n}: ${r.why} after ${(r.ms / 1000).toFixed(1)}s — progress ${pct}% ` +
          `(x=${Math.round(r.maxX)}/${Math.round(r.goalX ?? 0)})${at}, ${r.deaths} death(s)`,
      );
    }
  }

  if (errors.length) {
    failed = true;
    console.error("\nconsole/page errors:\n  " + errors.join("\n  "));
  }
  if (failed) throw new Error("one or more levels were not completable");
  console.log(`\nAll ${LEVELS.length} requested level(s) are completable by the autoplay bot.`);
} catch (err) {
  console.error(`\nFAIL — ${err.message}`);
  console.error(`       (is the server up? run: python tools/serve.py 8137)`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
