import type { PrismaticItemPickBreakdown } from "@arena/types";
import { sortByRate } from "@/features/recap/utils/sample";
import type { SortMode } from "./types";

function rankLabel(rank: number, total: number): string {
  return `#${rank} OF ${total} HELD`;
}

/** Share of games that count toward the active rate sort. */
function pickRate(row: PrismaticItemPickBreakdown, sort: Exclude<SortMode, "held">): number {
  const hits = sort === "top3" ? row.top1 + row.top3ExclTop1 : row.top1;
  return row.timesHeld > 0 ? hits / row.timesHeld : 0;
}

/** Same split as `ChampionPicks`' own `sortChampions` — bar HEIGHT follows the
 * sort: total holds under "BY TIMES HELD", the rate itself under the two rate
 * sorts, so a rate sort reads highest-to-lowest left to right. */
function sortItems(
  rows: PrismaticItemPickBreakdown[],
  sort: SortMode,
  mixLowSample = false,
): PrismaticItemPickBreakdown[] {
  if (sort === "held") return [...rows].sort((a, b) => b.timesHeld - a.timesHeld);
  // Rates only rank rows with enough games; the rest follow, dimmed (see
  // lib/sample.ts). A 1-for-1 pick used to top "BY 1ST RATE" at 100%.
  return sortByRate(
    rows,
    (row) => pickRate(row, sort),
    (row) => row.timesHeld,
    "desc",
    mixLowSample ? "mixed" : "after",
  );
}

export { rankLabel, pickRate, sortItems };
