import type { CalendarStats, TimePlayedStats } from "@arena/types";
import { AnimatedNumber } from "@/components/animated-number";
import { CategorySection } from "@/components/category-section";
import { CarouselItem } from "@/components/ui/carousel";
import {
  CategoryLayout,
  SidebarHeadline,
  SidebarStatGrid,
} from "@/components/layout";
import { Calendar } from "./Calendar";

type Props = {
  timePlayed: TimePlayedStats;
  gamesPlayed: number;
  calendar: CalendarStats;
};

/** Renders a single count with a unit suffix, e.g. "5 days" or "12 games" —
 * the single-value counterpart to DurationStat below. */
function CountStat({ value, unit }: { value: number; unit: string }) {
  return (
    <div className="flex items-baseline justify-self-end gap-1">
      <AnimatedNumber
        value={value}
        className="font-display text-2xl font-semibold text-lol-gold-50"
      />
      <span className="font-display text-sm text-lol-text-muted">{unit}</span>
    </div>
  );
}

/** Renders a two-part duration like "3h 27m" or "18m 42s" as two
 * independently-animated numbers with unit suffixes. */
function DurationStat({
  major,
  majorUnit,
  minor,
  minorUnit,
}: {
  major: number;
  majorUnit: string;
  minor: number;
  minorUnit: string;
}) {
  return (
    <div className="flex items-baseline justify-self-end gap-1">
      <AnimatedNumber
        value={major}
        className="font-display text-2xl font-semibold text-lol-gold-50"
      />
      <span className="font-display text-sm text-lol-text-muted">
        {majorUnit}
      </span>
      <AnimatedNumber
        value={minor}
        className="font-display text-2xl font-semibold text-lol-gold-50"
      />
      <span className="font-display text-sm text-lol-text-muted">
        {minorUnit}
      </span>
    </div>
  );
}

/**
 * Time-played stats (fixed left panel) alongside a carousel (right side) —
 * currently just the activity calendar, but built to hold more slides later
 * without changing this layout.
 */
const TimePlayed = ({ timePlayed, gamesPlayed, calendar }: Props) => {
  const hours = Math.floor(timePlayed.timePlayedSeconds / 3600);
  const minutes = Math.floor((timePlayed.timePlayedSeconds % 3600) / 60);

  const avgMinutes = Math.floor(timePlayed.averageGameSeconds / 60);
  const avgSeconds = Math.floor(timePlayed.averageGameSeconds % 60);

  const longestMinutes = Math.floor(timePlayed.longestGameSeconds / 60);
  const longestSeconds = Math.floor(timePlayed.longestGameSeconds % 60);

  return (
    <CategorySection title="Your time in Arena">
      <CategoryLayout
        sidebar={
          <>
            <SidebarHeadline label="Time in Arena">
              <AnimatedNumber
                value={hours}
                className="font-display text-6xl font-semibold text-lol-gold-50"
              />
              <span className="font-display text-4xl text-lol-text-muted">
                h
              </span>
              <AnimatedNumber
                value={minutes}
                className="font-display text-6xl font-semibold text-lol-gold-50"
              />
              <span className="font-display text-4xl text-lol-text-muted">
                m
              </span>
            </SidebarHeadline>

            <SidebarStatGrid>
              <span className="self-center text-lol-text-muted">
                Average Game Time
              </span>
              <DurationStat
                major={avgMinutes}
                majorUnit="m"
                minor={avgSeconds}
                minorUnit="s"
              />

              <span className="self-center text-lol-text-muted">
                Longest Game
              </span>
              <DurationStat
                major={longestMinutes}
                majorUnit="m"
                minor={longestSeconds}
                minorUnit="s"
              />
              <span className="self-center text-lol-text-muted">
                Longest Streak
              </span>
              <CountStat
                value={timePlayed.longestStreakDays}
                unit={timePlayed.longestStreakDays === 1 ? "day" : "days"}
              />

              <span className="self-center text-lol-text-muted">
                Most Games in a Day
              </span>
              <CountStat
                value={timePlayed.mostGamesInADay}
                unit={timePlayed.mostGamesInADay === 1 ? "game" : "games"}
              />

              <span className="self-center text-lol-text-muted">
                Current Streak
              </span>
              <CountStat
                value={timePlayed.currentStreakDays}
                unit={timePlayed.currentStreakDays === 1 ? "day" : "days"}
              />

              <span className="self-center text-lol-text-muted">
                Favorite Day
              </span>
              <span className="justify-self-end font-display text-2xl font-semibold text-lol-gold-50">
                {timePlayed.favoriteDayOfWeek ?? "—"}
              </span>
            </SidebarStatGrid>
          </>
        }
      >
        <CarouselItem className="h-full">
          <Calendar calendar={calendar} />
        </CarouselItem>
      </CategoryLayout>
    </CategorySection>
  );
};

export { TimePlayed };
