import type { ChampionStats } from "@arena/types";
import type { MultikillKey } from "@/features/recap/components/slides/kills/types";

/** Streaks that stopped at exactly this tier for one champion — Riot's
 * per-champion counters are cumulative like the page-wide ones (a penta also
 * counts as a quadra, triple and double), so the next tier up is subtracted. */
function exactMultikills(champion: ChampionStats, key: MultikillKey): number {
  const { doubleKills, tripleKills, quadraKills, pentaKills } = champion.combat;
  const exact = {
    double: doubleKills - tripleKills,
    triple: tripleKills - quadraKills,
    quadra: quadraKills - pentaKills,
    penta: pentaKills,
  }[key];
  return Math.max(0, exact);
}

export { exactMultikills };
