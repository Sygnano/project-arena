"use client";

import { useEffect, useRef, useState } from "react";
import type { MetaAugmentsStats } from "@arena/types";
import { CategorySection } from "@/components/category-section";
import { HextechPanel } from "@/components/hextech-panel";
import { AugmentFramedCard } from "@/components/augment-framed-card";
import { SECTION_BACKGROUNDS } from "@/lib/section-backgrounds";

/** The card's base size (flow layout, and before the deck measure). Deck
 * grows it by setting its width — never CSS `zoom`, which would also thicken
 * the frame art's border (see `AugmentFramedCard`). */
const CARD_WIDTH = 230;
const CARD_HEIGHT = (CARD_WIDTH * 256) / 155;
const CARD_GAP = 24;
/** Room kept around the row for the frame's outer glow (`TIER_STYLE` blur is
 * 20px). The row is `overflow-visible` in deck so the glow is never clipped. */
const GLOW_MARGIN = 24;
const DECK_QUERY = "(min-width: 1280px) and (min-height: 860px)";

/**
 * Scale factor that grows the row of cards until it hits either the width or
 * the height of the space it has — whichever comes first. Deck layout only:
 * in `flow` the panel's height follows its content, so there is no height
 * limit to measure against and the cards keep their designed size and wrap.
 * `null` until measured (server render keeps the CSS fallback).
 */
function useFitZoom<T extends HTMLElement>(count: number) {
  const ref = useRef<T>(null);
  const [zoom, setZoom] = useState<number | null>(null);

  useEffect(() => {
    const box = ref.current;
    if (!box || count === 0) return;
    const deck = window.matchMedia(DECK_QUERY);
    const measure = () => {
      if (!deck.matches) {
        setZoom(1);
        return;
      }
      const width =
        (box.clientWidth - 2 * GLOW_MARGIN - (count - 1) * CARD_GAP) / count;
      const byWidth = width / CARD_WIDTH;
      const byHeight = (box.clientHeight - 2 * GLOW_MARGIN) / CARD_HEIGHT;
      if (byWidth <= 0 || byHeight <= 0) return;
      setZoom(Math.floor(Math.min(byWidth, byHeight) * 100) / 100);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    deck.addEventListener("change", measure);
    return () => {
      observer.disconnect();
      deck.removeEventListener("change", measure);
    };
  }, [count]);

  return [ref, zoom] as const;
}

type Props = {
  metaAugments: MetaAugmentsStats;
};

/**
 * Arena's augment-crafting mechanic — 5 draft picks that spend a slot on
 * something other than a normal augment offer (gain a Prismatic Stat Anvil,
 * gain an augment slot, gain a plain Stat Anvil, "level" an existing
 * augment, replace one) instead of a champion-exclusive Guest of Honor line.
 * Excluded from the normal catalog/picks panels (`AugmentHallOfFame`/
 * `AugmentPicks`) for the same reason as Guest of Honor — not part of the
 * normal 3-augment offer pool — but genuinely picked in real match data
 * (see `apps/api/src/leagueData/augments/augmentGroups.ts`'s `META_AUGMENT_API_NAMES`), so it gets the
 * same "full panel, no sidebar" real treatment right after Guest of Honor:
 * one card per augment, no filter/sort (there are only 5), each bordered by
 * the same Silver/Gold/Prismatic performance tier as every other augment
 * card on the page.
 *
 * The five cards sit flat in one row (wrapping on narrow screens). They used
 * to live in the Collection section's coverflow, which is built for 60+
 * cards: with only five, it dimmed and turned away cards that fit side by
 * side anyway, and captured the mouse wheel.
 */
const MetaAugments = ({ metaAugments }: Props) => {
  const augments = metaAugments.augments;
  const [fitRef, zoom] = useFitZoom<HTMLDivElement>(augments.length);


  return (
    <CategorySection
      imageUrl={SECTION_BACKGROUNDS.metaAugments}
      title="AUGMENT CRAFTING"
      quote="I put the scheme in schematic!"
    >
      <HextechPanel bodyClassName="p-8">
        <div className="mb-4 flex flex-none flex-wrap items-center gap-x-6 gap-y-3">
          <div className="text-[11px] tracking-[.28em] text-lol-text-muted">
            {augments.length.toLocaleString()} AUGMENTS
          </div>
        </div>

        {augments.length === 0 ? (
          <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-lol-text-muted">
            No tracked matches yet.
          </div>
        ) : (
          <div ref={fitRef} className="flex flex-1 flex-col deck:min-h-0">
            <ul
              aria-label="Augment crafting picks"
              className="flex flex-1 flex-wrap content-center items-center justify-center py-6 deck:min-h-0 deck:flex-nowrap deck:py-0"
              style={{ gap: CARD_GAP }}
            >
              {augments.map((augment) => (
                <li
                  key={augment.augmentId}
                  className="flex-none"
                  style={{ width: Math.floor(CARD_WIDTH * (zoom ?? 1)) }}
                >
                  <AugmentFramedCard
                    augment={augment}
                    className="h-auto w-full"
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
      </HextechPanel>
    </CategorySection>
  );
};

export { MetaAugments };
