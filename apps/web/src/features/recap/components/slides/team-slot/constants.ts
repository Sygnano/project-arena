import { TIER_STYLE } from "@/utils/tier-bars";

// Percent of the chart's bar track the tallest column fills, leaving room
// for its total label above. Percent (not px) so the chart follows the
// panel's real height instead of overflowing it on shorter screens.
const BAR_MAX_PERCENT = 78;

/**
 * Same three rarity tiers `HextechBarChart`'s KDA columns use for their top
 * 3 ranks, applied here by FIXED meaning instead of rank: every team's 1st
 * segment is Prismatic, 2nd-3rd is Gold, and the rest is Silver, regardless
 * of which team has the most of each. Both read `TIER_STYLE`
 * (`utils/tier-bars.ts`), so their colors can't drift apart.
 */
const SEGMENT_TIER = {
  top1: TIER_STYLE.prismatic,
  top3: TIER_STYLE.gold,
  remaining: TIER_STYLE.silver,
};

export { BAR_MAX_PERCENT, SEGMENT_TIER };
