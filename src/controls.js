// controls.js — reusable virtual-input layer shared by every level.
// Decouples "what the player intends" from "how it was triggered" (keyboard vs. the
// on-screen DOM buttons), so the player entity and future levels just read getInput().
//
// - left / right: held flags (true while a key/button is down).
// - jump: an EDGE flag — set true on a fresh press, cleared by consumeJump(). This keeps
//   jumping a discrete action (holding the key/button does not auto-repeat the jump).

import { k } from "./kaplayCtx.js";

const input = {
  left: false,
  right: false,
  jump: false, // edge flag, consumed by the player each frame
  jumpHeld: false, // held flag (true while jump key/button is down) — drives variable jump height
};

/** Live input object (read every frame by the player). */
export function getInput() {
  return input;
}

/** Returns true once per press, then clears the jump edge. */
export function consumeJump() {
  if (input.jump) {
    input.jump = false;
    return true;
  }
  return false;
}

// --- Desktop keyboard ---------------------------------------------------------
// Scene-scoped: call inside a k.scene() body so Kaplay tears the handlers down on
// scene change (no duplicate bindings stacking up across level reloads).
export function bindKeyboard() {
  k.onKeyDown("left", () => (input.left = true));
  k.onKeyDown("right", () => (input.right = true));
  k.onKeyRelease("left", () => (input.left = false));
  k.onKeyRelease("right", () => (input.right = false));
  // Space or Up to jump — edge flag for the discrete action, plus a held flag (down/release)
  // so the player can modulate jump height (releasing early cuts the rise).
  k.onKeyPress(["space", "up"], () => (input.jump = true));
  k.onKeyDown(["space", "up"], () => (input.jumpHeld = true));
  k.onKeyRelease(["space", "up"], () => (input.jumpHeld = false));
}

// --- Mobile DOM buttons -------------------------------------------------------
// Attached once at module load. The buttons live in index.html and are shown only on
// coarse-pointer devices via CSS. Pointer events cover mouse/touch/pen; per-button
// state means multitouch works (hold a direction while tapping jump).
let touchBound = false;

export function bindTouchButtons() {
  if (touchBound) return; // idempotent
  const left = document.getElementById("btn-left");
  const right = document.getElementById("btn-right");
  const jump = document.getElementById("btn-jump");
  if (!left || !right || !jump) return; // no overlay present
  touchBound = true;

  // Hold-style buttons (left/right): pressed while the pointer is down on them.
  const hold = (el, set) => {
    const down = (e) => {
      e.preventDefault();
      set(true);
      el.classList.add("is-active");
    };
    const up = (e) => {
      e.preventDefault();
      set(false);
      el.classList.remove("is-active");
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("pointerleave", up);
    // Belt-and-braces for browsers routing touch separately from pointer events.
    el.addEventListener("touchstart", down, { passive: false });
    el.addEventListener("touchend", up, { passive: false });
    el.addEventListener("touchcancel", up, { passive: false });
  };

  hold(left, (v) => (input.left = v));
  hold(right, (v) => (input.right = v));

  // Jump: edge on press only.
  const jumpDown = (e) => {
    e.preventDefault();
    input.jump = true;
    input.jumpHeld = true;
    jump.classList.add("is-active");
  };
  const jumpUp = (e) => {
    e.preventDefault();
    input.jumpHeld = false;
    jump.classList.remove("is-active");
  };
  jump.addEventListener("pointerdown", jumpDown);
  jump.addEventListener("pointerup", jumpUp);
  jump.addEventListener("pointercancel", jumpUp);
  jump.addEventListener("pointerleave", jumpUp);
  jump.addEventListener("touchstart", jumpDown, { passive: false });
  jump.addEventListener("touchend", jumpUp, { passive: false });
  jump.addEventListener("touchcancel", jumpUp, { passive: false });
}

// Clear all held inputs — call when leaving gameplay so a stuck key/button doesn't
// carry a direction into the next scene.
export function resetInput() {
  input.left = false;
  input.right = false;
  input.jump = false;
  input.jumpHeld = false;
}
