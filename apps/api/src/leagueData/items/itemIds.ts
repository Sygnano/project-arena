/**
 * Arena item groups that no data source flags, so they're kept by hand.
 * Recheck after a patch (CLAUDE.md §2 has how each was established).
 * Arena's boots and anvil ids live in `@arena/db` (parseMatch needs them
 * without network access).
 */

/**
 * Arena's "Prismatic Item" tier, granted by the `220007` anvil. Nothing in
 * Riot's API or in CommunityDragon marks an item as Prismatic: the list is
 * the items sold in Arena at exactly 2750g, checked against every tracked
 * match (each is held, and held far more often than bought). Not an id
 * range: Goredrinker and Prowler's Claw are `22xxxx`, `443080` and `446693`
 * aren't in Arena, and `447111` is a 2500g Legendary.
 */
export const PRISMATIC_ITEM_IDS: readonly number[] = [
  226630, 226693, 443054, 443055, 443056, 443058, 443059, 443060, 443061, 443062, 443063, 443064, 443069, 443079,
  443081, 443083, 443090, 443193, 444636, 444637, 444644, 446632, 446656, 446667, 446671, 446691, 447100, 447101,
  447102, 447103, 447104, 447105, 447106, 447107, 447108, 447109, 447110, 447112, 447113, 447114, 447115, 447116,
  447118, 447119, 447120, 447121, 447122, 447123,
];

/**
 * The Shardblade ("increase the effectiveness of stat shards"). Granted, never
 * bought, so it has no ITEM_PURCHASED event: end-of-match `items` is its only trace.
 */
export const SHARDBLADE_ITEM_ID = 220012;

/**
 * Arena's special upgrade items: The Golden Spatula, Wooglet's Witchcap, Void
 * Immolation. Never bought (zero ITEM_PURCHASED events in every tracked
 * timeline): the game swaps them in (Void Immolation for a destroyed Sunfire
 * Aegis / Hollow Radiance, Wooglet's for Rabadon's), so end-of-match `items`
 * is the only source.
 */
export const SPECIAL_ITEM_IDS: readonly number[] = [224403, 228002, 223069];

/** The anvils (`220000`-`220007`) and the vouchers that redeem for them
 * (`220008`-`220011`): a shop mechanic, not part of a build. */
export const ANVIL_AND_VOUCHER_ITEM_IDS = { first: 220000, last: 220011 } as const;

/** Price from which an ordinary Arena item counts as Legendary. Legendaries
 * are 2500g, Prismatics 2750g, the special items 6000g, boots 500g. */
export const LEGENDARY_MIN_GOLD = 2000;
