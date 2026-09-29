import type { SortMode } from "./types";

// Percentages of the chart's own bar track (`HextechBarChart`'s
// `heightUnit="percent"`), not px — the leader bar is deliberately capped
// below 100% rather than always touching the track's top edge, leaving
// headroom above the tallest column.
const BAR_MAX_HEIGHT = 70;

const BAR_MIN_HEIGHT = 5;

/**
 * The design's middle stack segment (`top3ExclTop1`, 2nd-3rd place — see
 * `ChampionPickBreakdown`) is labeled "TOP 4" in the original prototype's
 * legend/sidebar text, a leftover from an earlier Arena team-size era (see
 * CLAUDE.md §2 on why team size — and therefore what "top 4" even means —
 * isn't stable). Relabeled to "WINRATE" here to match what the field actually
 * counts and stay consistent with `PlacementStats.top3Finishes`'s "win"
 * definition used everywhere else in the app; no data or layout changed.
 */
const TOP3_RATE_COLOR = "#e0b563";

const FIRST_RATE_COLOR = "var(--color-augment-prismatic)";

const SORT_NOUN: Record<SortMode, string> = {
  picks: "BY PICKS",
  top3: "BY WINRATE",
  rate: "BY 1ST RATE",
};

export { BAR_MAX_HEIGHT, BAR_MIN_HEIGHT, TOP3_RATE_COLOR, FIRST_RATE_COLOR, SORT_NOUN };
