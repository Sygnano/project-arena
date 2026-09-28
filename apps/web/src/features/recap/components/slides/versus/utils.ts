import type { VersusChampionStats } from "@arena/types";
import { sortByRate } from "@/features/recap/utils/sample";
import type { SortMode } from "./types";

function duels(row: VersusChampionStats): number {
  return row.duelsWon + row.duelsLost;
}

/** Share of duels against this champion that the summoner's team won (0-1). */
function winShare(row: VersusChampionStats): number {
  const total = duels(row);
  return total > 0 ? row.duelsWon / total : 0;
}

function pct(share: number): string {
  return `${(share * 100).toFixed(0)}%`;
}

function sortChampions(rows: VersusChampionStats[], sort: SortMode, mixLowSample: boolean): VersusChampionStats[] {
  if (sort === "fought") return [...rows].sort((a, b) => duels(b) - duels(a));
  return sortByRate(
    rows,
    (row) => (sort === "best" ? winShare(row) : 1 - winShare(row)),
    duels,
    "desc",
    mixLowSample ? "mixed" : "after",
  );
}

export { duels, winShare, pct, sortChampions };
