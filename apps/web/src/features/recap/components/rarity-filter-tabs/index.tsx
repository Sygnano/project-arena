"use client";

import { DiamondTabs } from "@/components/diamond-tabs";
import type { AugmentRarityFilter } from "@/features/recap/utils/augment-rarity";
import { TABS } from "./constants";

type Props = {
  active: AugmentRarityFilter;
  onChange: (filter: AugmentRarityFilter) => void;
};

/**
 * The ALL/SILVER/GOLD/PRISMATIC augment-rarity filter row shared by
 * `AugmentPicks` and `AugmentHallOfFame` — same `DiamondTabs` chrome as
 * every other mode switcher in the app, just filtering the augment list by
 * its own `AugmentStats.rarity` instead of a sort mode.
 */
function RarityFilterTabs({ active, onChange }: Props) {
  return <DiamondTabs tabs={TABS} active={active} onChange={onChange} />;
}

export { RarityFilterTabs };
