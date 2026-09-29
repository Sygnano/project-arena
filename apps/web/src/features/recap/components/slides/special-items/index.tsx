"use client";

import type { ItemOutcomeStats } from "@arena/types";
import { CategorySection } from "@/features/recap/components/category-section";
import { SECTION_BACKGROUNDS } from "@/features/recap/utils/section-backgrounds";
import { ItemCard } from "./components/item-card";
import type { Baseline } from "./types";

type Props = {
  specialItems: ItemOutcomeStats[];
  baseline: Baseline;
};

/**
 * Special Items — Arena's granted upgrade items (The Golden Spatula,
 * Wooglet's Witchcap, Void Immolation) as three equal reliquary cards, full
 * width with no identity column: how many matches the summoner ended holding
 * each, and how those matches finished.
 */
const SpecialItems = ({ specialItems, baseline }: Props) => {
  return (
    <CategorySection
      title="SPECIAL ITEMS"
      quote="I got two guns. One's for what's in front of me, and one's for what's chasin'."
      imageUrl={SECTION_BACKGROUNDS.specialItems}
    >
      {/* The inner scroller is a phone-only fallback (three full-height cards
        stacked in one column). From `md` up the cards sit side by side and
        size themselves to the slide, so the section fits one screen with no
        scrollbar of its own. */}
      <div className="grid min-h-0 grid-cols-1 gap-8 overflow-y-auto pt-4 md:grid-cols-3 md:gap-12 md:overflow-visible">
        {specialItems.map((item) => (
          <ItemCard key={item.itemId} item={item} baseline={baseline} />
        ))}
      </div>
    </CategorySection>
  );
};

export { SpecialItems };
