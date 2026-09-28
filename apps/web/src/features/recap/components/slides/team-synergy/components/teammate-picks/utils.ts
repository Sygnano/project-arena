import type { TeammateChampionStats } from "@arena/types";

function top3RateOf(row: TeammateChampionStats): number {
  return ((row.top1 + row.top3ExclTop1) / row.games) * 100;
}

export { top3RateOf };
