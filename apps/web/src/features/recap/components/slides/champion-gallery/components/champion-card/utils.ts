import type { ChampionPickBreakdown } from "@arena/types";
import { type Tier, tierForBestFinish } from "@/utils/tier-bars";

/**
 * The same "best finish on this champion" tier ladder every framed card on
 * the page uses (see `augment-framed-card.tsx`'s `tierForAugmentCard`), so
 * a Prismatic frame means the identical thing here as it does on an augment
 * card: a 1st place. `null` is never returned for a gallery card — the
 * gallery only shows champions the summoner has actually picked — but the
 * signature keeps the never-picked case explicit for callers that reuse it.
 */
function tierForChampionCard(champion: ChampionPickBreakdown): Tier | null {
  return champion.timesPicked === 0 ? null : tierForBestFinish(champion);
}

export { tierForChampionCard };
