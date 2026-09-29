import type { ChampionStats } from "@arena/types";

/** The champion scoring highest on `score`, or null when none scores above 0.
 * Ties go to the first one met (the lowest champion id). */
function topChampion(
  champions: Record<number, ChampionStats>,
  score: (champion: ChampionStats) => number,
): ChampionStats | null {
  let best: ChampionStats | null = null;
  for (const champion of Object.values(champions)) {
    if (best === null || score(champion) > score(best)) best = champion;
  }
  return best && score(best) > 0 ? best : null;
}

export { topChampion };
