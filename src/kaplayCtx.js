// kaplayCtx.js — creates the one Kaplay context and exports it.
// Every other module imports `k` from here, so there is exactly one engine instance
// and no global (window) pollution.

// Kaplay is vendored (pinned 3001.0.19, downloaded from unpkg) so production never
// depends on a CDN being up, and the game can later work offline as a PWA.
import kaplay from "../vendor/kaplay-3001.0.19.mjs";
import { GAME_W, GAME_H, PALETTE } from "./config.js";

// Touch devices (phones/tablets) usually pair a high devicePixelRatio (3 on iPhone) with a
// modest mobile GPU. Rendering the virtual 1280×720 world at 2× there means a ~2560×1440
// backbuffer — ~4× the fragment/fill work of density 1 — which makes the game feel "scattoso"
// (choppy) on iOS. Since the art is nearest-neighbour pixel art scaled to full-screen anyway,
// dropping to density 1 on mobile is barely perceptible visually but vastly smoother. Desktop
// keeps min(dpr, 2) for crisp HUD text where the GPU budget is there.
const coarsePointer =
  typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)")?.matches;

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
  // Density 1 on touch/mobile (smooth over crisp — see coarsePointer note above), capped 2 on desktop.
  pixelDensity: coarsePointer ? 1 : Math.min(window.devicePixelRatio || 1, 2),
  // maxFPS: blocca il loop a 60fps a cadenza regolare SU MOBILE. Un iPhone ProMotion gira a
  // 120Hz, ma l'engine free-running non tiene i 120 pieni a causa del costo JS per-frame, così
  // la cadenza oscilla (120→95→110…) e gli intervalli irregolari si leggono come "scattoso"
  // anche con fps medio alto. Un 60 fermo è più liscio di un 90-110 ballerino — è l'obiettivo
  // di fluidità su mobile. Desktop resta libero (di norma già a 60Hz, e il bot autoplay
  // desktop non deve cambiare timing).
  maxFPS: coarsePointer ? 60 : undefined,
  crisp: true, // nearest-neighbour sampling so the generated 64px tiles/sprites stay sharp
  // Default UI font: the vendored pixel font (loaded in src/assets.js as "pixel"). Every
  // k.text() inherits it, so the HUD/menus read as pixel art instead of system sans-serif.
  // The few labels with emoji/symbol glyphs the font lacks (▶ ★ ✨ 👑) override to
  // font:"sans-serif" per object. Until the async load finishes (the loading scene), Kaplay
  // falls back to its built-in font for the brief "Caricamento..." text.
  font: "pixel",
});
