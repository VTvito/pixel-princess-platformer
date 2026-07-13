// backgroundFreeze.js — idle the whole PWA while it's in the background.
//
// Why this exists: on an installed iOS PWA the app never truly went idle when backgrounded, so
// iOS counted it as "in use" for HOURS in Screen Time (the reported phantom 7h+ "Tempo di
// utilizzo") and drained the battery. Two things kept the page alive off-screen:
//   1. AUDIO. src/audioUnlock.js sets navigator.audioSession.type = "playback" (needed so iOS
//      doesn't route the game to the silent ambient audio category). A LIVE "playback"
//      AudioContext is exactly what iOS keeps warm in the background — it treats the PWA as an
//      active media session, so the app stays "running" and Screen Time keeps counting.
//   2. THE LOOP. That warm state also keeps Kaplay's requestAnimationFrame loop firing, so every
//      onUpdate keeps ticking — including the time-attack run clock (src/scenes/game.js adds
//      k.dt() each frame), which then creeps up by real seconds while nobody is playing.
//
// The fix: on visibilitychange → hidden, FREEZE the game tree (stops every onUpdate — the run
// timer and all simulation, the same "pauses are excluded for free" path the timer already relies
// on) and SUSPEND the AudioContext (releases the media session so iOS can suspend the whole PWA).
// On → visible, restore exactly the prior state.
//
// Preserving the manual pause (the "Pause = global freeze" invariant in CLAUDE.md): the pause
// overlay drives the SAME k.getTreeRoot().paused flag. So we snapshot it on the way out and
// restore that snapshot on the way back — a game the player had paused stays paused (its DOM
// overlay still up), an active game resumes, and we never leak a wrong paused state into a scene.
//
// Audio resume needs NO change here: src/audioUnlock.js already re-resumes the context on
// visibilitychange → visible and on the next real gesture, restarting the bgm on the
// suspended→running edge (resumeCurrentBgm). Suspending on hidden just makes explicit the
// "interrupted" state that resume path is already built to recover from — keep those handlers.
//
// Emulation caveat (per CLAUDE.md): Edge/Chromium can't reproduce the WebKit media-session/
// Screen-Time accounting, so the real win is verified on a physical iPhone; the mechanism (tree
// freezes, context suspends, timer stops, manual pause survives) is what the tests assert.

import { k } from "./kaplayCtx.js";

let installed = false;
let frozenByBackground = false; // are WE the ones holding the tree frozen right now?
let resumePaused = false; // the paused state to restore on return (e.g. a manual pause)

/** Freeze the tree + suspend audio so iOS can suspend the PWA. Idempotent while backgrounded. */
function freeze() {
  if (frozenByBackground) return; // already idled — don't re-snapshot the (now true) paused flag
  frozenByBackground = true;
  const root = k.getTreeRoot();
  resumePaused = !!root.paused; // remember a manual pause so we don't unpause it on return
  root.paused = true;
  // Release the "playback" audio session — the load-bearing bit for iOS Screen Time / battery.
  k.audioCtx?.suspend()?.catch(() => {});
}

/** Restore the pre-background paused state. Audio comes back via src/audioUnlock.js. */
function thaw() {
  if (!frozenByBackground) return; // we didn't freeze it — leave whatever state it's in alone
  frozenByBackground = false;
  k.getTreeRoot().paused = resumePaused;
}

/**
 * Wire the background freeze/thaw. Call once at startup (from main.js). Uses visibilitychange —
 * the reliable foreground/background signal on an iOS standalone PWA — mirroring the existing
 * audioUnlock / viewportResync resume listeners.
 *
 * Thaw also hangs off `pageshow` and `focus`. This is deliberate belt-and-braces: freeze() holds
 * the WHOLE tree paused, so a `hidden` whose matching `visible` never arrives (iOS can drop it
 * across an app-switch or an orientation transition) would leave the game permanently frozen — the
 * screen locked up until a reload. Those two extra signals give the thaw a second and third chance.
 * thaw() is idempotent (`frozenByBackground` gates it) and restores the SNAPSHOT, so a manually
 * paused game still stays paused — the invariant in CLAUDE.md holds.
 */
export function installBackgroundFreeze() {
  if (installed) return;
  installed = true;

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") freeze();
    else thaw();
  });
  window.addEventListener("pageshow", thaw);
  window.addEventListener("focus", thaw);
}
