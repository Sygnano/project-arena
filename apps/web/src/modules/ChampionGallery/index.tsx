"use client";

import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import type { ChampionPicksStats, ChampionStats } from "@arena/types";
import { CategorySection } from "@/components/category-section";
import { HextechPanel } from "@/components/hextech-panel";
import { FadingRule } from "@/components/fading-rule";
import { CoverflowGallery } from "@/components/coverflow-gallery";
import { ChampionCard } from "./ChampionCard";
import { ChampionDossier } from "./ChampionDossier";
import { useChampionName } from "@/lib/champion-names";
import { useOpenDossierRequests } from "@/lib/champion-dossier";
import { SECTION_BACKGROUNDS } from "@/lib/section-backgrounds";

type Props = {
  championPicks: ChampionPicksStats;
  champions: Record<number, ChampionStats>;
};

/** Numeric form of `card-frame.tsx`'s `CARD_ASPECT_RATIO` (155 / 256). The
 * gallery sizes cards to fill the panel body's height from this. */
const CARD_ASPECT = 155 / 256;

/** Cross-fade between the gallery and a champion's dossier. Short and
 * opacity-led on purpose: the two views share the champion's card, so a
 * bigger positional transition would fight the impression that the card
 * simply stayed put while the stats arrived around it. */
const VIEW_TRANSITION = { duration: 0.24, ease: [0.4, 0, 0.2, 1] } as const;

/**
 * The champion gallery — every champion the summoner has actually picked, as
 * a horizontally scrolling pack of cards (`components/coverflow-gallery.tsx`
 * owns the depth/scroll behavior), ordered most-played first. Clicking a card
 * swaps the panel over to that champion's full dossier
 * (`ChampionDossier.tsx`).
 *
 * Sits right after Champion Picks and covers the other half of the same
 * question: Picks ranks champions against each other on one axis at a time,
 * this one lets you stop on a single champion and read everything about them.
 * A full-width panel with no sidebar, since the centered card already plays
 * the role the identity column plays in sidebar sections.
 */
const ChampionGallery = ({ championPicks, champions }: Props) => {
  // Most-played first — the same default ordering Champion Picks opens on,
  // so the first card here is the champion that section's tallest bar just
  // pointed at.
  const roster = useMemo(
    () =>
      [...championPicks.champions].sort(
        (a, b) => b.timesPicked - a.timesPicked,
      ),
    [championPicks.champions],
  );

  const [centeredIndex, setCenteredIndex] = useState(0);
  /** The champion whose dossier is open, or null while the gallery is
   * showing. Kept separate from `centeredIndex` so closing the dossier
   * returns to exactly the card the user left, and so scrolling the gallery
   * never re-opens anything. */
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // "FULL STATS" links elsewhere on the page land here with a champion id.
  useOpenDossierRequests(
    useCallback(
      (championId: number) => {
        const index = roster.findIndex(
          (champion) => champion.championId === championId,
        );
        if (index === -1) return;
        setCenteredIndex(index);
        setOpenIndex(index);
      },
      [roster],
    ),
  );

  const openChampion = openIndex == null ? null : roster[openIndex];
  const displayName = useChampionName();


  return (
    <CategorySection
      title="COLLECTION"
      quote="I seek only the strongest."
      imageUrl={SECTION_BACKGROUNDS.championGallery}
    >
      <HextechPanel bodyClassName="p-6">
        <div className="mb-6 flex flex-none flex-wrap items-center gap-x-6 gap-y-3">
          {openChampion ? (
            <button
              type="button"
              onClick={() => setOpenIndex(null)}
              className="group flex cursor-pointer items-center gap-2.5 transition-[filter] duration-150 hover:brightness-125"
            >
              <svg viewBox="0 0 18 8" className="block h-2 w-4.5 rotate-90">
                <path
                  d="M1 1 L9 7 L17 1"
                  fill="none"
                  stroke="var(--color-lol-gold-300)"
                  strokeWidth="1.4"
                  opacity=".75"
                />
              </svg>
              <span className="pl-[.2em] text-[11px] tracking-[.28em] text-lol-gold-300 transition-colors duration-150 group-hover:text-lol-gold-50">
                ALL CHAMPIONS
              </span>
            </button>
          ) : (
            <div className="text-[11px] tracking-[.28em] text-lol-gold-300">
              {roster.length} CHAMPIONS PLAYED
            </div>
          )}

          <FadingRule />

          <div className="text-[11px] tracking-[.28em] text-lol-text-muted sm:whitespace-nowrap">
            {openChampion
              ? displayName(openChampion.championName).toUpperCase()
              : "DRAG, ARROW KEYS OR TYPE A NAME · CLICK OR ENTER FOR FULL STATS"}
          </div>
        </div>

        {roster.length === 0 ? (
          <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-lol-text-muted">
            No tracked matches yet.
          </div>
        ) : (
          <MotionConfig reducedMotion="user">
            {/* `mode="wait"` so the outgoing view is gone before the incoming
              one mounts — the two views are very different shapes, and
              cross-dissolving them on top of each other reads as a smear
              rather than a transition. */}
            <AnimatePresence mode="wait" initial={false}>
              {openChampion ? (
                <motion.div
                  key="dossier"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={VIEW_TRANSITION}
                  className="flex min-h-0 flex-1"
                >
                  <ChampionDossier
                    pick={openChampion}
                    stats={champions[openChampion.championId]}
                    rank={openIndex! + 1}
                    totalChampions={roster.length}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="gallery"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={VIEW_TRANSITION}
                  className="flex min-h-0 flex-1"
                >
                  <CoverflowGallery
                    label="Champions played"
                    itemText={(champion) => displayName(champion.championName)}
                    items={roster}
                    itemKey={(champion) => champion.championId}
                    itemAspectRatio={CARD_ASPECT}
                    centeredIndex={centeredIndex}
                    onCenteredIndexChange={setCenteredIndex}
                    onActivate={(index) => {
                      setCenteredIndex(index);
                      setOpenIndex(index);
                    }}
                    renderItem={(champion) => (
                      <ChampionCard champion={champion} />
                    )}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </MotionConfig>
        )}
      </HextechPanel>
    </CategorySection>
  );
};

export { ChampionGallery };
