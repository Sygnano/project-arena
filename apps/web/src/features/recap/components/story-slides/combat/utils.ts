import type { ChampionStats } from "@arena/types";
import type { MultikillHeroes } from "./types";

/**
 * The multikill to brag about, and who scored it: the pentakills, or the
 * quadrakills when there's no penta. Null with neither.
 */
function multikillHeroes(champions: Record<number, ChampionStats>): MultikillHeroes | null {
  for (const kind of ["PENTAKILL", "QUADRAKILL"] as const) {
    const count = (champion: ChampionStats) =>
      kind === "PENTAKILL" ? champion.combat.pentaKills : champion.combat.quadraKills;
    const scorers = Object.values(champions)
      .filter((champion) => count(champion) > 0)
      .sort((a, b) => count(b) - count(a) || a.championId - b.championId)
      .map((champion) => ({ championName: champion.championName, count: count(champion) }));
    if (scorers.length > 0) {
      return { kind, total: scorers.reduce((sum, scorer) => sum + scorer.count, 0), champions: scorers };
    }
  }
  return null;
}

export { multikillHeroes };
