/** Rarity id (Community Dragon) -> name and tier fill, in offer order. */
const RARITIES = [
  { rarity: 0, label: "SILVER", fillClass: "tier-bar-silver" },
  { rarity: 1, label: "GOLD", fillClass: "tier-bar-gold" },
  { rarity: 2, label: "PRISMATIC", fillClass: "tier-bar-prismatic" },
] as const;

const FRAME_CLASS: Record<number, string> = {
  0: "augment-frame-silver",
  1: "augment-frame-gold",
  2: "augment-frame-prismatic",
};

export { FRAME_CLASS, RARITIES };
