import type { BanSort } from "./types";

/** The direction each column sorts in when you first click it: names read
 * A-Z, every number reads biggest-first. */
const NATURAL_DIR: Record<BanSort, "asc" | "desc"> = {
  champion: "asc",
  rate: "desc",
  win: "desc",
};

const SORT_LABEL: Record<BanSort, string> = {
  champion: "BY NAME",
  rate: "BY BAN RATE",
  win: "BY WIN %",
};

/** Sorts whose leading rows are a rate over a handful of games, so low-sample
 * rows rank last and render dimmed (see `lib/sample.ts`). */
const RATE_SORTS: readonly BanSort[] = ["win"];

/** Row geometry as real numbers (the rows' `py-1.25` around a 36px icon, and
 * the list's `gap-0.75`): the icon layer is positioned by `index * SLOT_PITCH`
 * rather than flowing with the rows — same split as `Damage.tsx`. */
const ROW_HEIGHT = 46;

const ROW_GAP = 3;

const SLOT_PITCH = ROW_HEIGHT + ROW_GAP;

const ICON_SIZE = 36;

const ROW_PADDING_X = 6;

/** Half-width of the swing rail, in px (the rail is 240px, baseline centered). */
const SWING_CLAMP = 108;

/** The rail's full-scale deflection never drops below this many percentage
 * points, so a page of tiny swings isn't blown up to look dramatic. It used
 * a fixed 17px per point, which pinned every swing beyond ±6.4% to the same
 * end of the rail. */
const MIN_SWING_SCALE_PP = 10;

export {
  NATURAL_DIR,
  SORT_LABEL,
  RATE_SORTS,
  ROW_HEIGHT,
  ROW_GAP,
  SLOT_PITCH,
  ICON_SIZE,
  ROW_PADDING_X,
  SWING_CLAMP,
  MIN_SWING_SCALE_PP,
};
