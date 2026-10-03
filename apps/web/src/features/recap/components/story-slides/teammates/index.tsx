"use client";

import type { TeammateStats, TeammatesStats } from "@arena/types";
import { Em, StoryFrame, StoryKicker, StoryText, StoryTitle } from "@/features/recap/components/story-frame";
import { StoryStat } from "@/features/recap/components/story-stat";
import { SECTION_BACKGROUNDS } from "@/features/recap/utils/section-backgrounds";
import { TeammateBars } from "./components/teammate-bars";

type Props = {
  teammates: TeammatesStats;
};

/** Teammates in the bars, the best one included. */
const LISTED = 6;

function winRate(teammate: TeammateStats): number {
  return ((teammate.top1 + teammate.top3ExclTop1) / teammate.gamesPlayed) * 100;
}

const percent = (value: number) => `${Math.round(value)}%`;

/**
 * Story slide: the squad. The teammate shared the most games with, how those
 * went, and the regulars as bars. `totalTeammates` counts everyone who was
 * ever on the summoner's team, once is enough (mostly matchmade strangers);
 * `teammates` lists only those met at least twice.
 */
function StoryTeammates({ teammates }: Props) {
  const regulars = teammates.teammates;
  const [partner] = regulars;

  return (
    <StoryFrame
      imageUrl={SECTION_BACKGROUNDS.teammates}
      tone={["rgba(70,201,151,.32)", "rgba(10,200,185,.24)"]}
      labelledBy="story-teammates-title"
      className="justify-center"
    >
      {partner ? (
        <div className="grid items-center gap-[clamp(18px,4vh,40px)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16">
          <div className="min-w-0">
            <StoryKicker>YOUR SQUAD</StoryKicker>
            <StoryTitle id="story-teammates-title">
              <span className="text-[#9fe8c9]">{partner.riotIdGameName}</span>
              <span className="ml-2 text-[.5em] text-lol-text-muted">#{partner.riotIdTagline}</span>
              <br />
              had your back.
            </StoryTitle>
            <div className="mt-[clamp(14px,3.5vh,36px)] flex gap-[clamp(28px,5vw,72px)]">
              <StoryStat value={partner.gamesPlayed} label="GAMES TOGETHER" delay={0.6} />
              <StoryStat value={winRate(partner)} format={percent} label="WINRATE TOGETHER" tone="win" delay={0.8} />
            </div>
            <StoryText delay={1}>
              <Em>{teammates.totalTeammates.toLocaleString("en-US")}</Em> different players shared your team this
              season. Only <Em>{regulars.length.toLocaleString("en-US")}</Em> of them came back for more.
            </StoryText>
          </div>
          <TeammateBars teammates={regulars.slice(0, LISTED)} delay={1.2} />
        </div>
      ) : (
        <>
          <StoryKicker>YOUR SQUAD</StoryKicker>
          <StoryTitle id="story-teammates-title">A lone wolf.</StoryTitle>
          <StoryStat value={teammates.totalTeammates} label="DIFFERENT TEAMMATES" delay={0.6} className="mt-8" />
          <StoryText delay={1}>Never the same teammate twice. The Arena kept shuffling your squad.</StoryText>
        </>
      )}
    </StoryFrame>
  );
}

export { StoryTeammates };
