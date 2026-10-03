import type { Metric } from "./types";

const METRICS: Metric[] = ["kills", "deaths", "assists", "kda"];

const METRIC_LABEL: Record<Metric, string> = {
  kills: "KILLS",
  deaths: "DEATHS",
  assists: "ASSISTS",
  kda: "KDA",
};

// Percentages of the chart's own bar track (`HextechBarChart`'s
// `heightUnit="percent"`), not px — the leader bar is deliberately capped
// below 100% rather than always touching the track's top edge, leaving
// headroom above the tallest column.
const BAR_MIN_HEIGHT = 5;

const BAR_MAX_HEIGHT = 70;

export { BAR_MAX_HEIGHT, BAR_MIN_HEIGHT, METRIC_LABEL, METRICS };
