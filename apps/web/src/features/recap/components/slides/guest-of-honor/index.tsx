"use client";

import type { GuestOfHonorStats } from "@arena/types";
import { useMemo } from "react";
import { FadingRule } from "@/components/fading-rule";
import { HextechPanel } from "@/components/hextech-panel";
import { CategorySection } from "@/features/recap/components/category-section";
import { SECTION_BACKGROUNDS } from "@/features/recap/utils/section-backgrounds";
import { championSplashUrl } from "@/utils/riot";
import { AccordionGallery, type AccordionGalleryItem } from "./components/accordion-gallery";
import { ChampionAugments } from "./components/champion-augments";
import { ChampionCrest } from "./components/champion-crest";
import { iconName } from "./utils";

type Props = {
  guestOfHonor: GuestOfHonorStats;
};

/**
 * A handful of champions (Tahm Kench, Vayne, Kindred, Yone) grant a teammate
 * a champion-exclusive augment line instead of a normal draft pick — Riot's
 * own "Guest of Honor" mechanic (see `apps/api/src/leagueData/augments/augmentGroups.ts`'s
 * `GUEST_OF_HONOR_CHAMPIONS`). These augments are excluded from the normal
 * catalog/picks panels (`AugmentHallOfFame`/`AugmentPicks`) since they're not
 * part of the normal offer pool, so they get their own full-size panel right
 * after Augment God.
 *
 * Presented as an accordion gallery (`components/accordion-gallery`)
 * rather than the carousel this used to be: every champion stays on screen as
 * its own panel of splash art, and hovering one opens it. A carousel showed
 * exactly one champion and hid the rest behind a timer, which for a set this
 * small (four champions) meant waiting to see something that could simply
 * have been visible.
 */
const GuestOfHonor = ({ guestOfHonor }: Props) => {
  const champions = guestOfHonor.champions;

  const items = useMemo<AccordionGalleryItem[]>(
    () =>
      champions.map((champion) => ({
        key: champion.championId,
        imageUrl: championSplashUrl(iconName(champion.championName)),
        label: champion.championName.toUpperCase(),
        badge: <ChampionCrest championName={champion.championName} />,
        content: <ChampionAugments champion={champion} />,
      })),
    [champions],
  );

  return (
    <CategorySection
      imageUrl={SECTION_BACKGROUNDS.guestOfHonor}
      title="GUESTS OF HONOR"
      quote="What can they do to me that they have not done?"
    >
      <HextechPanel bodyClassName="p-8">
        <div className="mb-4 flex flex-none flex-wrap items-center gap-x-6 gap-y-3">
          <div className="text-[11px] tracking-[.28em] text-lol-gold-300">{champions.length} CHAMPIONS</div>
          <FadingRule />
          <div className="text-[11px] tracking-[.28em] text-lol-text-muted sm:whitespace-nowrap">
            SELECT A CHAMPION TO OPEN THEIR LINE
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          {champions.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-sm text-lol-text-muted">
              No tracked matches yet.
            </div>
          ) : (
            <AccordionGallery
              ariaLabel="Guest of Honor champions"
              items={items}
              trigger="click"
              // Champion splash art puts the character's face above the
              // middle of the frame, so a centred crop of a wide panel tends
              // to cut it; bias the crop upward.
              imagePosition="50% 30%"
            />
          )}
        </div>
      </HextechPanel>
    </CategorySection>
  );
};

export { GuestOfHonor };
