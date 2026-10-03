import type { AugmentPickBreakdown } from "@arena/types";
import { sortByRate } from "@/features/recap/utils/sample";
import type { SortMode } from "./types";

function rankLabel(rank: number, total: number): string {
  return `#${rank} OF ${total} PICKED`;
}

/** Share of games that count toward the active rate sort. */
function pickRate(row: AugmentPickBreakdown, sort: Exclude<SortMode, "picks">): number {
  const hits = sort === "top3" ? row.top1 + row.top3ExclTop1 : row.top1;
  return row.timesPicked > 0 ? hits / row.timesPicked : 0;
}

/** Same split as `ChampionPicks`' own `sortChampions` — bar HEIGHT follows the
 * sort: total picks under "BY PICKS", the rate itself under the two rate
 * sorts, so a rate sort reads highest-to-lowest left to right. */
function sortAugments(rows: AugmentPickBreakdown[], sort: SortMode, mixLowSample = false): AugmentPickBreakdown[] {
  if (sort === "picks") return [...rows].sort((a, b) => b.timesPicked - a.timesPicked);
  // Rates only rank rows with enough games; the rest follow, dimmed (see
  // lib/sample.ts). A 1-for-1 pick used to top "BY 1ST RATE" at 100%.
  return sortByRate(
    rows,
    (row) => pickRate(row, sort),
    (row) => row.timesPicked,
    "desc",
    mixLowSample ? "mixed" : "after",
  );
}

export { pickRate, rankLabel, sortAugments };
