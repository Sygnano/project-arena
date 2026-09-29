import type { AugmentPicksStats, AugmentsStats } from "@arena/types";
import type { HexCombCell } from "@/components/hex-comb";
import { tierForBestFinish } from "@/utils/tier-bars";
import { RARITIES } from "./constants";

/** Augments picked per rarity, and in total. */
function rarityCounts(augments: AugmentsStats) {
  const counts = RARITIES.map(({ rarity }) =>
    augments.augments
      .filter((augment) => augment.rarity === rarity)
      .reduce((sum, augment) => sum + augment.timesPicked, 0),
  );
  return { counts, total: counts.reduce((sum, count) => sum + count, 0) };
}

/** Every augment that was part of a win (a top 3), most wins first, as comb
 * cells rimmed by their best finish. */
function winningAugmentCells(augments: AugmentsStats, picks: AugmentPicksStats): HexCombCell[] {
  const byId = new Map(augments.augments.map((augment) => [augment.augmentId, augment]));
  return picks.augments
    .filter((pick) => pick.top1 + pick.top3ExclTop1 > 0)
    .sort((a, b) => b.top1 + b.top3ExclTop1 - (a.top1 + a.top3ExclTop1) || a.augmentId - b.augmentId)
    .map((pick) => ({
      id: pick.augmentId,
      name: pick.augmentName,
      iconUrl: byId.get(pick.augmentId)?.iconUrl ?? "",
      tier: tierForBestFinish(pick),
      interactive: false,
    }));
}

export { rarityCounts, winningAugmentCells };
