"use client";

import type { GuestOfHonorChampionStats } from "@arena/types";
import { useFitScale } from "@/features/recap/components/slides/guest-of-honor/hooks";
import { CompactAugmentCard } from "./components/compact-augment-card";

/** A champion's augment set inside an expanded accordion panel: the same
 * compact card for every champion, whatever the size of their set, scaled down
 * as a whole until it fits the panel (no inner scrollbar). Wrapping alone
 * isn't enough: a 3x3 grid is too tall for a short deck-mode panel at any column count, and squeezing the cards' own
 * type sizes per row count would mean re-tuning them against one screen. */
function ChampionAugments({ champion }: { champion: GuestOfHonorChampionStats }) {
  const { outerRef, innerRef, scale } = useFitScale<HTMLDivElement, HTMLDivElement>();

  return (
    <div
      ref={outerRef}
      className="flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden px-7 pt-4 pb-7"
    >
      <div
        ref={innerRef}
        className="flex w-full flex-col gap-3"
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        {champion.rows.map((row) => (
          <div
            key={row.key}
            // Compact cards wrap instead of scrolling sideways, so a long
            // single-row set (Vayne's 7) folds into readable rows.
            className="flex flex-none flex-wrap items-stretch justify-center gap-3"
          >
            {row.augments.map((augment) => (
              <CompactAugmentCard key={augment.augmentId} augment={augment} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export { ChampionAugments };
