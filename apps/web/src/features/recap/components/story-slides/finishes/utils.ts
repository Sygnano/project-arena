import type { TeamSlotBreakdown } from "@arena/types";
import { isLowSample } from "@/features/recap/utils/sample";
import type { Tier } from "@/utils/tier-bars";

/** The headline for a winrate (top 3 finishes, 0-100). */
function finishHeadline(winRate: number): string {
  if (winRate >= 60) return "The podium was your second home.";
  if (winRate >= 50) return "More podiums than not.";
  if (winRate >= 40) return "A regular on the podium.";
  return "Every round, a lesson learned.";
}

/** A placement's tier: 1st prismatic, 2nd-3rd gold, the rest silver. */
function placementTier(placement: number): Tier {
  if (placement === 1) return "prismatic";
  return placement <= 3 ? "gold" : "silver";
}

function slotGames(slot: TeamSlotBreakdown): number {
  return slot.top1 + slot.top3ExclTop1 + slot.remaining;
}

function slotWinRate(slot: TeamSlotBreakdown): number {
  const games = slotGames(slot);
  return games > 0 ? ((slot.top1 + slot.top3ExclTop1) / games) * 100 : 0;
}

/** The lobby slot played most, and the one with the best winrate among slots
 * with a real sample (null when none has one, or it's the same slot). */
function crestHighlights(slots: TeamSlotBreakdown[]) {
  const mostPlayed = slots.reduce<TeamSlotBreakdown | null>(
    (best, slot) => (best === null || slotGames(slot) > slotGames(best) ? slot : best),
    null,
  );
  const luckiest = slots
    .filter((slot) => !isLowSample(slotGames(slot)))
    .reduce<TeamSlotBreakdown | null>(
      (best, slot) => (best === null || slotWinRate(slot) > slotWinRate(best) ? slot : best),
      null,
    );
  return { mostPlayed, luckiest: luckiest && luckiest.teamId !== mostPlayed?.teamId ? luckiest : null };
}

export { finishHeadline, placementTier, slotGames, slotWinRate, crestHighlights };
