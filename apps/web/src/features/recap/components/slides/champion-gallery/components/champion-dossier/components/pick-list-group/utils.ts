import type { PickEntry } from "@/features/recap/components/slides/champion-gallery/components/champion-dossier/types";
import type { PickSortKey } from "./types";

/** Orders a list by the chosen column; ties break toward more games.
 * Deliberately no small-sample handling here (no dimming, no pushing
 * low-game rows last): one champion's own games are often few, so on a
 * rarely played champion that rule would dim or demote nearly every row. */
function sortPicks(rows: readonly PickEntry[], key: PickSortKey, dir: "asc" | "desc"): PickEntry[] {
  const value =
    key === "games"
      ? (row: PickEntry) => row.games
      : key === "win"
        ? (row: PickEntry) => row.wins / Math.max(1, row.games)
        : (row: PickEntry) => row.firsts / Math.max(1, row.games);
  const sign = dir === "desc" ? 1 : -1;
  return [...rows].sort((a, b) => sign * (value(b) - value(a)) || b.games - a.games);
}

export { sortPicks };
