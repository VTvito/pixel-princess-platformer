// kaplayCtx.js — creates the one Kaplay context and exports it.
// Every other module imports `k` from here, so there is exactly one engine instance
// and no global (window) pollution.

import kaplay from "https://unpkg.com/kaplay@3001.0.19/dist/kaplay.mjs";
import { GAME_W, GAME_H, PALETTE } from "./config.js";

export const k = kaplay({
  width: GAME_W,
  height: GAME_H,
  // letterbox + stretch: scale to the viewport while keeping the 16:9 landscape aspect
  // ratio, adding bars on off-ratio screens instead of distorting.
  letterbox: true,
  stretch: true,
  background: PALETTE.sky,
  canvas: document.querySelector("#game"),
  global: false,           // use the returned context, no globals
  touchToMouse: true,      // taps fire onClick — menu works on mobile
  pixelDensity: Math.min(window.devicePixelRatio || 1, 2), // crisp but cap for perf
  // Default font that ships with Kaplay; swap for a custom font in a later prompt.
  font: "sans-serif",
});
