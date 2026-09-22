/**
 * Arena augments that aren't normal draft picks, identified by hand
 * against the full catalog and real match data. Two of these groups get
 * their own page instead (Guest of Honor, augment crafting), so they're
 * kept out of the normal augment stats without being dropped.
 */

/**
 * `apiName` prefixes that are never a normal draft offer:
 * - `GoH`: Guest of Honor, augment lines some champions grant a teammate
 *   (`GUEST_OF_HONOR_CHAMPIONS`).
 * - `Crafting`: augment crafting, a separate menu choice
 *   (`META_AUGMENT_API_NAMES`). These are picked often (`CraftingPrisStatAnvil`
 *   is in ~1 in 6 participant rows), just not from the normal offer.
 */
export const NON_DRAFT_API_NAME_PREFIXES = ["GoH", "Crafting"] as const;

/** Other non-draft entries: `GainStatAnvil`/`ReplaceAugment` are crafting
 * choices without the prefix, `NullAugment` a placeholder never used. */
export const NON_DRAFT_API_NAMES: ReadonlySet<string> = new Set(["GainStatAnvil", "ReplaceAugment", "NullAugment"]);

/**
 * Guest of Honor: 4 champions grant a teammate a champion-unique augment
 * line instead of a normal pick. All `GoH`-prefixed and `rarity: 4`; ids
 * checked against CommunityDragon (2026-09). Rows are in display order.
 *
 * Tahm Kench's is the one named "Guest of Honor" in-game: 3 tracks
 * (Power/Risk/Wealth), each Craving -> Compulsion -> Abstain. His
 * "Sacrifice: For Silver/Gold/Prismatic" (302-304), the one-time tier
 * choice made before those tracks, is deliberately left out.
 */
export const GUEST_OF_HONOR_CHAMPIONS = [
  {
    championId: 223,
    championName: "Tahm Kench",
    rows: [
      { key: "power", label: "POWER", augmentIds: [369, 372, 366] },
      { key: "risk", label: "RISK", augmentIds: [370, 373, 367] },
      { key: "wealth", label: "WEALTH", augmentIds: [368, 371, 365] },
    ],
  },
  {
    championId: 67,
    championName: "Vayne",
    rows: [{ key: "items", label: "ITEMS", augmentIds: [348, 347, 349, 350, 351, 354, 392] }],
  },
  {
    championId: 203,
    championName: "Kindred",
    rows: [{ key: "spirits", label: "SPIRITS", augmentIds: [359, 358] }],
  },
  {
    championId: 777,
    championName: "Yone",
    rows: [{ key: "allegiance", label: "ALLEGIANCE", augmentIds: [361, 362] }],
  },
] as const;

/**
 * Augment crafting: spending a pick on a Prismatic Stat Anvil, an extra
 * augment slot, a Stat Anvil, upgrading an augment, or replacing
 * one. In display order.
 */
export const META_AUGMENT_API_NAMES = [
  "CraftingPrisStatAnvil",
  "CraftingAugmentSlot",
  "GainStatAnvil",
  "CraftingSellAugment",
  "ReplaceAugment",
] as const;
