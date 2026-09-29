import type { AbilityCastBreakdown, ChampionStats } from "@arena/types";
import { ABILITY_KEYS } from "@/features/recap/utils/ability-colors";

/** The single most pressed ability across every champion: whose, which key,
 * how many casts. Null before any cast. */
function favoriteButton(champions: Record<number, ChampionStats>) {
  let best: { championName: string; key: keyof AbilityCastBreakdown; casts: number } | null = null;
  for (const champion of Object.values(champions)) {
    for (const key of ABILITY_KEYS) {
      const casts = champion.ability.total[key];
      if (casts > (best?.casts ?? 0)) best = { championName: champion.championName, key, casts };
    }
  }
  return best;
}

function sumCasts(breakdown: AbilityCastBreakdown): number {
  return ABILITY_KEYS.reduce((sum, key) => sum + breakdown[key], 0);
}

export { favoriteButton, sumCasts };
