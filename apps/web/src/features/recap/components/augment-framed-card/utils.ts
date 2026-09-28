import { type Tier, tierForBestFinish } from "@/utils/tier-bars";
import type { AugmentFramedCardStats } from "./types";

/** Same "best finish while holding this augment" performance tier logic
 * every augment-card module on the page uses — these augments (Guest of
 * Honor lines, augment-crafting picks) have no Silver/Gold/Prismatic rarity
 * of their own (Community Dragon lists every one as `rarity: 4`), so the
 * card border is entirely about how well the summoner has done with it. */
function tierForAugmentCard(augment: AugmentFramedCardStats): Tier | null {
  return augment.timesPicked === 0 ? null : tierForBestFinish(augment);
}

export { tierForAugmentCard };
