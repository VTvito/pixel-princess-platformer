// index.js — the level registry. The game scene asks for a level by number; the finale
// (level 5, a non-playable ballroom cutscene) is the only piece still to land.

import { LEVEL_1 } from "./level1.js";
import { LEVEL_2 } from "./level2.js";
import { LEVEL_3 } from "./level3.js";
import { LEVEL_4 } from "./level4.js";

const LEVELS = {
  1: LEVEL_1,
  2: LEVEL_2,
  3: LEVEL_3,
  4: LEVEL_4,
};

/** Return the definition for level `n`, falling back to level 1 if not built yet. */
export function getLevelDef(n) {
  return LEVELS[n] || LEVEL_1;
}

/** Whether a real (built) level exists for `n` — used by the completion flow. */
export const hasLevel = (n) => n in LEVELS;
