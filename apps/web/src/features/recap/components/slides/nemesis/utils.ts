import type { OpponentStats } from "@arena/types";
import type { SortMetric } from "./types";

function top3Rate(row: OpponentStats): number {
  return row.gamesFaced > 0 ? ((row.top1 + row.top3ExclTop1) / row.gamesFaced) * 100 : 0;
}

/** This opponent's win rate specifically AGAINST the summoner (their team
 * finishing ahead of the summoner's team) — the actual "nemesis" number,
 * distinct from `top3Rate` (their own overall placement record). */
function vsYouRate(row: OpponentStats): number {
  return row.gamesFaced > 0 ? (row.timesBeatenBy / row.gamesFaced) * 100 : 0;
}

/** The summoner's OWN win rate (top 3 finish) across the matches shared with
 * this opponent — mirrors `top3Rate` above, but for the summoner's team. */
function ownTop3Rate(row: OpponentStats): number {
  return row.gamesFaced > 0 ? ((row.ownTop1 + row.ownTop3ExclTop1) / row.gamesFaced) * 100 : 0;
}

/** The summoner's OWN 1st-place rate across the matches shared with this
 * opponent. */
function ownTop1Rate(row: OpponentStats): number {
  return row.gamesFaced > 0 ? (row.ownTop1 / row.gamesFaced) * 100 : 0;
}

function metricValue(row: OpponentStats, metric: SortMetric): number {
  switch (metric) {
    case "games":
      return row.gamesFaced;
    case "roundsWon":
      return row.roundsWon;
    case "roundsLost":
      return row.roundsLost;
    case "ownTop1":
      return ownTop1Rate(row);
    case "ownTop3":
      return ownTop3Rate(row);
    case "top3Rate":
      return top3Rate(row);
    default:
      return vsYouRate(row);
  }
}

export { top3Rate, vsYouRate, ownTop3Rate, ownTop1Rate, metricValue };
