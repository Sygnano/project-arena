import type { SortMode } from "./types";

// Same you/them pair as Nemesis' round bars.
const WON_COLOR = "var(--color-lol-blue-300)";

const LOST_COLOR = "var(--color-lol-garnet)";

/** won count · won bar (grows left) · champion · lost bar (grows right) ·
 * lost count · share of duels won. */
const ROW_GRID = "40px minmax(0,1fr) 190px minmax(0,1fr) 40px 56px";

const SORT_NOUN: Record<SortMode, string> = {
  fought: "MOST FOUGHT",
  best: "BEST MATCHUPS",
  worst: "WORST MATCHUPS",
};

export { LOST_COLOR, ROW_GRID, SORT_NOUN, WON_COLOR };
