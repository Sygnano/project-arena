"use client";

import type { CalendarStats, TimePlayedStats } from "@arena/types";
import { AnimatedNumber } from "@/components/animated-number";
import { Appear } from "@/components/appear";
import { formatHoursMinutes } from "@/utils/format";
import { Em, StoryFrame, StoryKicker, StoryText, StoryTitle } from "@/features/recap/components/story-frame";
import { StoryFact } from "@/features/recap/components/story-fact";
import { SECTION_BACKGROUNDS } from "@/features/recap/utils/section-backgrounds";
import { useUtcOffsetHours } from "@/hooks/use-utc-offset-hours";
import { utcOffsetLabel } from "@/utils/time-zone";
import { HourClock } from "./components/hour-clock";
import { SeasonHeatmap } from "./components/season-heatmap";
import { playtimeComparison } from "./utils";

type Props = {
  matchesPlayed: number;
  timePlayed: TimePlayedStats;
  calendar: CalendarStats;
};

/** Story slide: how much Arena this season was: games, hours, the calendar
 * lighting up day by day, and the hour of the day it all happened (the
 * viewer's own time zone). */
function StorySeason({ matchesPlayed, timePlayed, calendar }: Props) {
  const hours = Math.round(timePlayed.timePlayedSeconds / 3600);
  const zone = utcOffsetLabel(useUtcOffsetHours());

  return (
    <StoryFrame
      imageUrl={SECTION_BACKGROUNDS.timePlayed}
      tone={["rgba(10,200,185,.32)", "rgba(0,90,130,.5)"]}
      labelledBy="story-season-title"
      className="justify-center"
    >
      <StoryKicker>THE GRIND</StoryKicker>
      <StoryTitle id="story-season-title">
        You queued into the Arena{" "}
        <AnimatedNumber value={matchesPlayed} className="text-lol-blue-100" durationMs={1600} /> times.
      </StoryTitle>
      <StoryText>
        That&apos;s{" "}
        <Em>
          {hours > 0 ? `${hours.toLocaleString("en-US")} hours` : formatHoursMinutes(timePlayed.timePlayedSeconds)}
        </Em>{" "}
        on the Rings of Wrath: {playtimeComparison(timePlayed.timePlayedSeconds)} of rounds, shops and augments.
      </StoryText>

      <div className="mt-[clamp(18px,4.5vh,48px)] grid grid-cols-[auto_1fr] items-center gap-x-[clamp(12px,5vw,80px)] gap-y-[clamp(14px,3.5vh,40px)] [grid-template-areas:'heat_heat''clock_facts'] sm:grid-cols-[1fr_auto] sm:[grid-template-areas:'heat_clock''facts_facts']">
        <Appear delay={0.6} className="min-w-0 [grid-area:heat]">
          <SeasonHeatmap days={calendar.days} delay={0.8} />
        </Appear>
        <Appear
          delay={0.8}
          from="scale"
          className="[grid-area:clock] max-sm:[zoom:.6] [@media(max-height:760px)]:[zoom:.8]"
        >
          <HourClock gamesByHour={calendar.gamesByHour} zone={zone} delay={1.1} />
        </Appear>
        <div className="grid gap-2.5 [grid-area:facts] sm:grid-cols-3 sm:gap-4">
          <StoryFact label="LONGEST STREAK" delay={1.6}>
            {timePlayed.longestStreakDays} {timePlayed.longestStreakDays === 1 ? "day" : "days in a row"}
          </StoryFact>
          <StoryFact label="BUSIEST DAY" delay={1.8}>
            {timePlayed.mostGamesInADay} {timePlayed.mostGamesInADay === 1 ? "game" : "games"}
          </StoryFact>
          {timePlayed.favoriteDayOfWeek ? (
            <StoryFact label="FAVORITE DAY" delay={2}>
              {timePlayed.favoriteDayOfWeek}s
            </StoryFact>
          ) : null}
        </div>
      </div>
    </StoryFrame>
  );
}

export { StorySeason };
