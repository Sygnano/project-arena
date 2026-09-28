import type { SortMode } from "./types";

// Percentages of the chart's own bar track (`HextechBarChart`'s
// `heightUnit="percent"`), not px — the leader bar is deliberately capped
// below 100% rather than always touching the track's top edge, leaving
// headroom above the tallest column.
const BAR_MAX_HEIGHT = 70;

const BAR_MIN_HEIGHT = 5;

const TOP3_RATE_COLOR = "#e0b563";

const FIRST_RATE_COLOR = "var(--color-augment-prismatic)";

const SORT_NOUN: Record<SortMode, string> = {
  picks: "BY PICKS",
  top3: "BY WINRATE",
  rate: "BY 1ST RATE",
};

export { BAR_MAX_HEIGHT, BAR_MIN_HEIGHT, TOP3_RATE_COLOR, FIRST_RATE_COLOR, SORT_NOUN };
