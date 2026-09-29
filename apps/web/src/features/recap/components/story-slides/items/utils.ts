import type { PrismaticItemPicksStats, PrismaticItemsStats } from "@arena/types";
import type { HexCombCell } from "@/components/hex-comb";
import { tierForBestFinish } from "@/utils/tier-bars";

/** Every Prismatic item held in a win (a top 3), most wins first, as comb
 * cells rimmed by their best finish. */
function winningPrismaticCells(items: PrismaticItemsStats, picks: PrismaticItemPicksStats): HexCombCell[] {
  const byId = new Map(items.items.map((item) => [item.itemId, item]));
  return picks.items
    .filter((pick) => pick.top1 + pick.top3ExclTop1 > 0)
    .sort((a, b) => b.top1 + b.top3ExclTop1 - (a.top1 + a.top3ExclTop1) || a.itemId - b.itemId)
    .map((pick) => ({
      id: pick.itemId,
      name: pick.itemName,
      iconUrl: byId.get(pick.itemId)?.iconUrl ?? "",
      tier: tierForBestFinish(pick),
      interactive: false,
    }));
}

export { winningPrismaticCells };
