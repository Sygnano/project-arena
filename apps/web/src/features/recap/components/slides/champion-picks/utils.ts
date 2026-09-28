import type { ChampionPickBreakdown } from "@arena/types";
import { sortByRate } from "@/features/recap/utils/sample";
import { SORT_NOUN } from "./constants";
import type { SortMode } from "./types";

function rankLabel(rank: number, total: number, sort: SortMode): string {
  return `#${rank} OF ${total} ${SORT_NOUN[sort]}`;
}

/** Share of a champion's games that count toward the active rate sort. */
function championRate(row: ChampionPickBreakdown, sort: Exclude<SortMode, "picks">): number {
  const hits = sort === "top3" ? row.top1 + row.top3ExclTop1 : row.top1;
  return row.timesPicked > 0 ? hits / row.timesPicked : 0;
}

/**
 * Ranks champions by the active sort mode. Bar HEIGHT follows the sort: total
 * picks under "BY PICKS", the rate itself under the two rate sorts.
 */
function sortChampions(rows: ChampionPickBreakdown[], sort: SortMode, mixLowSample = false): ChampionPickBreakdown[] {
  if (sort === "picks") return [...rows].sort((a, b) => b.timesPicked - a.timesPicked);
  // Rates only rank rows with enough games; the rest follow, dimmed (see
  // lib/sample.ts). A 1-for-1 pick used to top "BY 1ST RATE" at 100%.
  return sortByRate(
    rows,
    (row) => championRate(row, sort),
    (row) => row.timesPicked,
    "desc",
    mixLowSample ? "mixed" : "after",
  );
}

export { rankLabel, championRate, sortChampions };
