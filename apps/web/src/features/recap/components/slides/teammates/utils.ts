import type { TeammateStats } from "@arena/types";
import type { SortMetric } from "./types";

function top3Rate(row: TeammateStats): number {
  return row.gamesPlayed > 0 ? ((row.top1 + row.top3ExclTop1) / row.gamesPlayed) * 100 : 0;
}

function firstRate(row: TeammateStats): number {
  return row.gamesPlayed > 0 ? (row.top1 / row.gamesPlayed) * 100 : 0;
}

function metricValue(row: TeammateStats, metric: SortMetric): number {
  if (metric === "games") return row.gamesPlayed;
  if (metric === "top3Rate") return top3Rate(row);
  return firstRate(row);
}

export { firstRate, metricValue, top3Rate };
