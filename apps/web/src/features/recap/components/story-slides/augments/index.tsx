"use client";

import type { AugmentPicksStats, AugmentsStats } from "@arena/types";
import { cn } from "cn";
import { Appear } from "@/components/appear";
import { Em, StoryFrame, StoryKicker, StoryText, StoryTitle } from "@/features/recap/components/story-frame";
import { StoryComb } from "@/features/recap/components/story-comb";
import { SECTION_BACKGROUNDS } from "@/features/recap/utils/section-backgrounds";
import { RaritySplit } from "./components/rarity-split";
import { FRAME_CLASS } from "./constants";
import { rarityCounts, winningAugmentCells } from "./utils";

type Props = {
  augments: AugmentsStats;
  augmentPicks: AugmentPicksStats;
};

/** Story slide: every augment picked, by rarity, the signature pick, and a
 * honeycomb of each augment that was part of a win. */
function StoryAugments({ augments, augmentPicks }: Props) {
  const { counts, total } = rarityCounts(augments);
  const favorite = augmentPicks.augments[0];
  const favoriteInfo = favorite ? augments.augments.find((augment) => augment.augmentId === favorite.augmentId) : null;
  const winners = winningAugmentCells(augments, augmentPicks);

  return (
    <StoryFrame
      imageUrl={SECTION_BACKGROUNDS.augmentPicks}
      tone={["rgba(217,163,207,.32)", "rgba(159,189,232,.34)"]}
      labelledBy="story-augments-title"
      className="justify-center"
    >
      <div className="grid min-h-0 flex-1 items-center gap-[clamp(16px,3vh,40px)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-14">
        <div>
          <StoryKicker>AUGMENTS</StoryKicker>
          <StoryTitle id="story-augments-title">{total.toLocaleString("en-US")} augments picked.</StoryTitle>
          <StoryText>
            {winners.length > 0 ? (
              <>
                <Em>{winners.length}</Em> different ones were there for a win: every hexagon here took you to the top 3.
              </>
            ) : (
              "None of them has carried you to a top 3 yet. The next draft might."
            )}
          </StoryText>
          <Appear delay={0.8} className="mt-[clamp(16px,3.5vh,36px)]">
            <RaritySplit counts={counts} delay={1} />
          </Appear>
          {favorite && favoriteInfo ? (
            <Appear delay={1.6} from="left" className="mt-[clamp(16px,3.5vh,32px)] flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={favoriteInfo.iconUrl}
                alt=""
                width={64}
                height={64}
                className={cn(
                  "augment-frame size-[clamp(48px,7vh,64px)] rounded-lg p-1",
                  FRAME_CLASS[favoriteInfo.rarity] ?? "augment-frame-silver",
                )}
              />
              <div>
                <div className="text-[10px] tracking-[.34em] text-lol-text-muted">YOUR SIGNATURE</div>
                <div className="mt-1 font-display text-[clamp(18px,2vw,26px)] text-lol-gold-50">
                  {favorite.augmentName}
                </div>
                <div className="text-sm text-lol-text-secondary">Picked {favorite.timesPicked} times</div>
              </div>
            </Appear>
          ) : null}
        </div>
        {winners.length > 0 ? (
          <StoryComb
            cells={winners}
            imageClassName="scale-[1.18]"
            className="h-[clamp(130px,28vh,560px)] w-full lg:h-full lg:max-h-[66vh]"
          />
        ) : null}
      </div>
    </StoryFrame>
  );
}

export { StoryAugments };
