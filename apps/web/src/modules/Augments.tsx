import type { CSSProperties } from "react";
import type { AugmentsStats } from "@arena/types";
import { CategorySection } from "@/components/category-section";

type Props = {
  augments: AugmentsStats;
};

// Community Dragon's own numeric rarity tiers (see AugmentStats's doc
// comment) mapped to the matching `.augment-frame-*` gradient border
// (globals.css) sampled from the real in-game card frames.
const RARITY_BORDER: Record<number, string> = {
  0: "augment-frame augment-frame-silver",
  1: "augment-frame augment-frame-gold",
  2: "augment-frame augment-frame-prismatic",
};

/**
 * Every augment in the game (currently 225 — see CLAUDE.md §2), laid out as
 * a grid, dimmed when the summoner has never picked it. Basic premise for
 * now: just the catalog plus a pick-count badge; sorting/filtering by
 * rarity or win rate can come later.
 */
const Augments = ({ augments }: Props) => {
  const sorted = [...augments.augments].sort((a, b) => {
    if (a.rarity !== b.rarity) return a.rarity - b.rarity;
    return a.augmentName.localeCompare(b.augmentName);
  });

  return (
    <CategorySection title="Augments">
      <div className="grid h-[70vh] w-full max-w-6xl grid-cols-[repeat(auto-fill,minmax(64px,1fr))] content-start gap-3 overflow-y-auto p-1">
        {sorted.map((augment) => (
          <div
            key={augment.augmentId}
            title={augment.augmentName}
            className={`relative flex flex-col items-center gap-1 ${
              augment.timesPicked === 0 ? "opacity-30 grayscale" : ""
            }`}
          >
            <img
              src={augment.iconUrl}
              alt={augment.augmentName}
              width={48}
              height={48}
              style={
                {
                  "--augment-frame-fill": "var(--color-lol-navy-900)",
                } as CSSProperties
              }
              className={`size-12 rounded-full object-cover ${RARITY_BORDER[augment.rarity] ?? "border-2 border-lol-border-muted"}`}
            />
            {augment.timesPicked > 0 && (
              <span className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full bg-lol-gold-400 text-[10px] font-semibold text-lol-navy-950 ring-2 ring-lol-navy-950">
                {augment.timesPicked}
              </span>
            )}
          </div>
        ))}
      </div>
    </CategorySection>
  );
};

export { Augments };
