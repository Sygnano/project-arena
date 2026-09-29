import { TIER_STYLE } from "@/utils/tier-bars";

function games(count: number) {
  return `${count.toLocaleString()} game${count === 1 ? "" : "s"}`;
}

/** Edge color by the best result the card covers, like the cells and bars. */
function edgeFor(top1: number, top3: number) {
  if (top1 > 0) return TIER_STYLE.prismatic.edge;
  if (top3 > 0) return TIER_STYLE.gold.edge;
  return TIER_STYLE.silver.edge;
}

export { edgeFor, games };
