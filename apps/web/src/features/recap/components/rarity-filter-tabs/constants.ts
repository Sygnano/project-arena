import type { AugmentRarityFilter } from "@/features/recap/utils/augment-rarity";

const TABS: readonly { key: AugmentRarityFilter; label: string }[] = [
  { key: "all", label: "ALL" },
  { key: "silver", label: "SILVER" },
  { key: "gold", label: "GOLD" },
  { key: "prismatic", label: "PRISMATIC" },
];

export { TABS };
