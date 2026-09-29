"use client";

import type { ChampionStats, KdaStats } from "@arena/types";
import { AnimatedNumber } from "@/components/animated-number";
import { Em, StoryFrame, StoryKicker, StoryText, StoryTitle } from "@/features/recap/components/story-frame";
import { StoryPortrait } from "@/features/recap/components/story-portrait";
import { StoryStat } from "@/features/recap/components/story-stat";
import { useChampionName } from "@/features/recap/stores/champion-names";
import { SECTION_BACKGROUNDS } from "@/features/recap/utils/section-backgrounds";
import { topChampion } from "@/features/recap/utils/top-champion";
import { MultikillBanner } from "./components/multikill-banner";
import { multikillHeroes } from "./utils";

type Props = {
  kda: KdaStats;
  champions: Record<number, ChampionStats>;
};

const PORTRAIT_HEIGHT = "h-[clamp(150px,24vh,240px)] lg:h-[clamp(200px,42vh,440px)]";

/** Story slide: the body count. Kills in the title, assists, deaths and KDA,
 * the portraits of the champion with the most kills and of the deadliest
 * single game, and the pentakills with who scored them. */
function StoryCombat({ kda, champions }: Props) {
  const championName = useChampionName();
  const executioner = topChampion(champions, (champion) => champion.kda.totalKills);
  const deadliest = topChampion(champions, (champion) => champion.kda.mostKills);

  return (
    <StoryFrame
      imageUrl={SECTION_BACKGROUNDS.kills}
      tone={["rgba(232,64,87,.38)", "rgba(110,16,34,.55)"]}
      labelledBy="story-combat-title"
      className="justify-center"
    >
      <div className="grid items-center gap-[clamp(16px,3vh,40px)] lg:grid-cols-[1fr_auto] lg:gap-14">
        <div className="min-w-0">
          <StoryKicker>COMBAT</StoryKicker>
          <StoryTitle id="story-combat-title">
            You took down <AnimatedNumber value={kda.kills} className="text-[#ffb3bd]" durationMs={1600} /> enemies.
          </StoryTitle>
          <div className="mt-[clamp(14px,3.5vh,36px)] flex flex-wrap gap-x-[clamp(24px,4.5vw,64px)] gap-y-4">
            <StoryStat value={kda.assists} label="ASSISTS" tone="accent" size="md" delay={0.5} />
            <StoryStat value={kda.deaths} label="DEATHS" tone="danger" size="md" delay={0.65} />
            <StoryStat value={kda.kda} decimals={2} label="KDA" size="md" delay={0.8} />
          </div>
          <StoryText delay={1}>
            Your cleanest game ended with a <Em>{kda.bestKda.toFixed(1)}</Em> KDA. The deaths? It happens to the best.
          </StoryText>
        </div>

        <div className="flex gap-[clamp(10px,1.6vw,20px)]">
          {executioner ? (
            <StoryPortrait
              championName={executioner.championName}
              label="EXECUTIONER"
              name={championName(executioner.championName)}
              stat={`${executioner.kda.totalKills.toLocaleString("en-US")} kills`}
              glow="232,64,87"
              delay={0.9}
              className={PORTRAIT_HEIGHT}
            />
          ) : null}
          {deadliest ? (
            <StoryPortrait
              championName={deadliest.championName}
              label="DEADLIEST GAME"
              name={championName(deadliest.championName)}
              stat={`${deadliest.kda.mostKills} kills in one game`}
              glow="232,64,87"
              delay={1.1}
              className={PORTRAIT_HEIGHT}
            />
          ) : null}
        </div>
      </div>

      <div className="mt-[clamp(16px,3.5vh,36px)]">
        <MultikillBanner heroes={multikillHeroes(champions)} delay={1.5} />
      </div>
    </StoryFrame>
  );
}

export { StoryCombat };
