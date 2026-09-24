/**
 * Community Dragon's own numeric rarity tiers for Arena augments (see
 * `AugmentStats.rarity`'s doc comment in `@arena/types`) — 0 = Silver,
 * 1 = Gold, 2 = Prismatic. A 4th value, 4, covers ~25 meta augments ("Gain
 * an Augment slot", "Replace Augment", ...) outside the normal in-game
 * offer pool; it has no dedicated filter tab of its own and only ever shows
 * up under "ALL". This is independent of the app's Silver/Gold/Prismatic
 * *performance* tiers (`@/lib/tier-bars`'s `Tier`) — an augment's rarity is
 * a fixed property of the augment itself, unrelated to how well the
 * summoner has done while holding it.
 */
export type AugmentRarityFilter = "all" | "silver" | "gold" | "prismatic";

const RARITY_TO_FILTER: Record<number, AugmentRarityFilter> = {
  0: "silver",
  1: "gold",
  2: "prismatic",
};

/** Whether an `AugmentStats.rarity` value belongs to `filter` — `"all"`
 * always matches. Shared by `AugmentPicks` and `AugmentHallOfFame` so both
 * panels' rarity filter behave identically. */
export function matchesRarityFilter(rarity: number, filter: AugmentRarityFilter): boolean {
  return filter === "all" || RARITY_TO_FILTER[rarity] === filter;
}

/** Small caps kicker for an augment's hover card, e.g. "PRISMATIC AUGMENT".
 * Undefined for the meta rarity (4), which has no in-game tier name. */
export const RARITY_KICKER: Record<number, string> = {
  0: "SILVER AUGMENT",
  1: "GOLD AUGMENT",
  2: "PRISMATIC AUGMENT",
};
