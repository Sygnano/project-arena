"use client";

import type { PlacementStats, TeamSlotStats, TimePlayedStats } from "@arena/types";
import { Appear } from "@/components/appear";
import { StoryFact } from "@/features/recap/components/story-fact";
import { Em, StoryFrame, StoryKicker, StoryText, StoryTitle } from "@/features/recap/components/story-frame";
import { StoryStat } from "@/features/recap/components/story-stat";
import { SECTION_BACKGROUNDS } from "@/features/recap/utils/section-backgrounds";
import { teamIconUrl, teamName } from "@/features/recap/utils/team-crests";
import { formatDuration } from "@/utils/format";
import { PlacementBars } from "./components/placement-bars";
import { crestHighlights, finishHeadline, slotGames, slotWinRate } from "./utils";

type Props = {
  matchesPlayed: number;
  placements: PlacementStats;
  timePlayed: TimePlayedStats;
  teamSlot: TeamSlotStats;
};

const percent = (value: number) => `${Math.round(value)}%`;

/** Story slide: how the games ended. Winrate (top 3) and 1st rate, every
 * placement as a bar, and the season's streak, marathon and team crests. */
function StoryFinishes({ matchesPlayed, placements, timePlayed, teamSlot }: Props) {
  const rate = (count: number) => (matchesPlayed > 0 ? (count / matchesPlayed) * 100 : 0);
  const winRate = rate(placements.top3Finishes);
  const { mostPlayed, luckiest } = crestHighlights(teamSlot.byTeamId);

  return (
    <StoryFrame
      imageUrl={SECTION_BACKGROUNDS.positions}
      tone={["rgba(200,155,60,.38)", "rgba(185,138,221,.3)"]}
      labelledBy="story-finishes-title"
      className="justify-center"
    >
      <div className="grid items-end gap-[clamp(20px,4vh,48px)] lg:grid-cols-[1fr_auto] lg:gap-16">
        <div>
          <StoryKicker>HOW YOU FINISHED</StoryKicker>
          <StoryTitle id="story-finishes-title">{finishHeadline(winRate)}</StoryTitle>
          <div className="mt-[clamp(16px,4vh,40px)] flex gap-[clamp(28px,5vw,72px)]">
            <StoryStat value={winRate} format={percent} label="WINRATE" tone="win" size="xl" delay={0.5} />
            <StoryStat
              value={rate(placements.top1Finishes)}
              format={percent}
              label="1ST RATE"
              tone="first"
              size="xl"
              delay={0.7}
            />
          </div>
          <StoryText delay={0.9}>
            <Em>{placements.top3Finishes.toLocaleString("en-US")}</Em> games in the top 3,{" "}
            <Em>{placements.top1Finishes.toLocaleString("en-US")}</Em> of them in 1st, for an average finish of{" "}
            <Em>{placements.avgPlacement.toFixed(1)}</Em>.
          </StoryText>
        </div>
        <Appear delay={0.6} className="justify-self-start lg:justify-self-end">
          <PlacementBars byPlacement={placements.byPlacement} delay={0.8} />
        </Appear>
      </div>

      <div className="mt-[clamp(20px,5vh,48px)] grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-4">
        <StoryFact label="LONGEST WIN STREAK" delay={1.6}>
          {placements.longestWinStreak} {placements.longestWinStreak === 1 ? "win" : "wins in a row"}
        </StoryFact>
        <StoryFact label="LONGEST GAME" delay={1.75}>
          {formatDuration(timePlayed.longestGameSeconds)}
        </StoryFact>
        {mostPlayed ? (
          <StoryFact label="USUAL CREST" iconUrl={teamIconUrl(mostPlayed.teamId)} delay={1.9}>
            {teamName(mostPlayed.teamId)} · {slotGames(mostPlayed)} games
          </StoryFact>
        ) : null}
        {luckiest ? (
          <StoryFact label="LUCKY CREST" iconUrl={teamIconUrl(luckiest.teamId)} delay={2.05}>
            {teamName(luckiest.teamId)} · {percent(slotWinRate(luckiest))} wins
          </StoryFact>
        ) : null}
      </div>
    </StoryFrame>
  );
}

export { StoryFinishes };
