import type { SortMode } from "./types";

// Percentages of the chart's own bar track (`HextechBarChart`'s
// `heightUnit="percent"`), not px — same as `ChampionPicks`/`AugmentPicks`.
const BAR_MAX_HEIGHT = 70;

const BAR_MIN_HEIGHT = 5;

const TOP3_RATE_COLOR = "#e0b563";

const FIRST_RATE_COLOR = "var(--color-augment-prismatic)";

const SORT_NOUN: Record<SortMode, string> = {
  held: "BY TIMES HELD",
  top3: "BY WINRATE",
  rate: "BY 1ST RATE",
};

export { BAR_MAX_HEIGHT, BAR_MIN_HEIGHT, TOP3_RATE_COLOR, FIRST_RATE_COLOR, SORT_NOUN };
