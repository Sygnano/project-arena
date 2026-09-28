import type { SortMode } from "./types";

const SORT_MODES: { key: SortMode; label: string }[] = [
  { key: "games", label: "GAMES" },
  { key: "wins", label: "PLACEMENT" },
  { key: "hour", label: "BY HOUR" },
];

/** What each view shows. These tabs change the coloring or the chart, not
 * an ordering, so the caption says so rather than "SORTED". Day and hour
 * buckets are UTC (see `CalendarDayStats`), and the caption says that too. */
const MODE_CAPTION: Record<SortMode, string> = {
  games: "DAYS COLORED BY GAMES PLAYED · UTC",
  wins: "DAYS COLORED BY BEST PLACEMENT · UTC",
  hour: "GAMES BY HOUR OF DAY · UTC",
};

const MONTH_ABBREV = new Intl.DateTimeFormat("en-US", {
  month: "short",
  timeZone: "UTC",
});

export { SORT_MODES, MODE_CAPTION, MONTH_ABBREV };
