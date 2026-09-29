"use client";

import type { ChampionPicksStats } from "@arena/types";
import { Em, StoryFrame, StoryKicker, StoryText, StoryTitle } from "@/features/recap/components/story-frame";
import { StoryPortrait } from "@/features/recap/components/story-portrait";
import { useChampionName } from "@/features/recap/stores/champion-names";
import { SECTION_BACKGROUNDS } from "@/features/recap/utils/section-backgrounds";
import { PickBars } from "./components/pick-bars";
import { TOP_PICKS } from "./constants";

type Props = {
  championPicks: ChampionPicksStats;
  matchesPlayed: number;
};

/** Story slide: the roster. How many champions, the one played most (its
 * full portrait, as tall as the screen allows) and the top five as bars. */
function StoryChampions({ championPicks, matchesPlayed }: Props) {
  const championName = useChampionName();
  const picks = championPicks.champions;
  const main = picks[0];
  if (!main) return null;
  const mainName = championName(main.championName);
  const mainWinRate = Math.round(((main.top1 + main.top3ExclTop1) / main.timesPicked) * 100);
  const mainShare = matchesPlayed > 0 ? Math.round((main.timesPicked / matchesPlayed) * 100) : 0;

  return (
    <StoryFrame
      imageUrl={SECTION_BACKGROUNDS.championPicks}
      tone={["rgba(185,138,221,.38)", "rgba(10,200,185,.22)"]}
      labelledBy="story-champions-title"
      className="justify-center"
    >
      <div className="grid items-center gap-[clamp(16px,3.5vh,40px)] md:grid-cols-[auto_1fr] md:gap-[clamp(32px,6vw,96px)]">
        <StoryPortrait
          championName={main.championName}
          label="YOUR #1"
          name={mainName}
          stat={`${main.timesPicked} games`}
          glow="185,138,221"
          className="h-[clamp(150px,27vh,260px)] md:h-[clamp(240px,64vh,680px)]"
        />
        <div className="min-w-0">
          <StoryKicker>YOUR CHAMPIONS</StoryKicker>
          <StoryTitle id="story-champions-title">
            {picks.length} {picks.length === 1 ? "champion" : "champions"} answered your call.
          </StoryTitle>
          <StoryText>
            But <Em>{mainName}</Em> was the one: {main.timesPicked} games ({mainShare}% of your season),{" "}
            <Em className="text-[#e6c27a]">{mainWinRate}%</Em> of them wins.
          </StoryText>
          <div className="mt-[clamp(16px,4vh,40px)] max-w-xl">
            <PickBars picks={picks.slice(0, TOP_PICKS)} delay={1} />
          </div>
        </div>
      </div>
    </StoryFrame>
  );
}

export { StoryChampions };
