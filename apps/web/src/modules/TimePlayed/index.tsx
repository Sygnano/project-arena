"use client";

import { useMemo, useState } from "react";
import type { CalendarStats, TimePlayedStats } from "@arena/types";
import { AnimatedNumber } from "@/components/animated-number";
import { CategorySection } from "@/components/category-section";
import { Dial } from "@/components/dial";
import { Calendar } from "./Calendar";
import { HourStrip } from "./HourStrip";
import { HextechPanel } from "@/components/hextech-panel";
import { SidebarStatRow } from "@/components/sidebar-stat-row";
import { DetailBand } from "@/components/detail-band";
import { DiamondTabs } from "@/components/diamond-tabs";
import { PanelToolbar } from "@/components/panel-toolbar";
import { ordinal } from "@/lib/format";
import { isLowSample } from "@/lib/sample";
import { SECTION_BACKGROUNDS } from "@/lib/section-backgrounds";

type SortMode = "games" | "wins" | "hour";

const SORT_MODES: { key: SortMode; label: string }[] = [
  { key: "games", label: "GAMES" },
  { key: "wins", label: "PLACEMENT" },
  { key: "hour", label: "BY HOUR" },
];

/** What each view shows. These tabs change the coloring or the chart, not
 * an ordering, so the caption says so rather than "SORTED". Day and hour
 * buckets are UTC (see `CalendarDayStats`), and the caption says that too. */
const MODE_CAPTION: Record<SortMode, string> = {
  games: "DAYS COLORED BY GAMES PLAYED · UTC",
  wins: "DAYS COLORED BY BEST PLACEMENT · UTC",
  hour: "GAMES BY HOUR OF DAY · UTC",
};

const MONTH_ABBREV = new Intl.DateTimeFormat("en-US", {
  month: "short",
  timeZone: "UTC",
});

type Props = {
  timePlayed: TimePlayedStats;
  calendar: CalendarStats;
};

/** Renders a single count with a unit suffix, e.g. "5 days" or "12 games". */
function CountStat({ value, unit }: { value: number; unit: string }) {
  return (
    <div className="flex items-baseline justify-self-end gap-1">
      <AnimatedNumber value={value} className="font-display text-2xl font-semibold text-lol-gold-50" />
      <span className="font-display text-sm text-lol-text-muted">{unit}</span>
    </div>
  );
}

/** Renders a two-part duration like "3h 27m" or "18m 42s". */
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
      <AnimatedNumber value={major} className="font-display text-2xl font-semibold text-lol-gold-50" />
      <span className="font-display text-sm text-lol-text-muted">{majorUnit}</span>
      <AnimatedNumber value={minor} className="font-display text-2xl font-semibold text-lol-gold-50" />
      <span className="font-display text-sm text-lol-text-muted">{minorUnit}</span>
    </div>
  );
}

const TimePlayed = ({ timePlayed, calendar }: Props) => {
  const [sortMode, setSortMode] = useState<SortMode>("games");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  // Defaults to the busiest hour so the band has something to say at once.
  const [selectedHour, setSelectedHour] = useState<number>(() =>
    calendar.gamesByHour.reduce((best, games, hour, all) => (games > all[best] ? hour : best), 0),
  );
  const hourGames = calendar.gamesByHour[selectedHour] ?? 0;
  const hourAvg = calendar.avgPlacementByHour[selectedHour];
  const hourTop1 = calendar.top1ByHour[selectedHour] ?? 0;
  const hourTop3 = calendar.top3ByHour[selectedHour] ?? 0;
  const hourTop3Rate = hourGames > 0 ? ((calendar.top3ByHour[selectedHour] ?? 0) / hourGames) * 100 : null;
  const hourLabel = `${String(selectedHour).padStart(2, "0")}:00`;

  const avgMinutes = Math.floor(timePlayed.averageGameSeconds / 60);
  const avgSeconds = Math.floor(timePlayed.averageGameSeconds % 60);

  const longestMinutes = Math.floor(timePlayed.longestGameSeconds / 60);
  const longestSeconds = Math.floor(timePlayed.longestGameSeconds % 60);

  const totalHours = +(timePlayed.timePlayedSeconds / 3600).toFixed(1);

  const selectedDay = useMemo(
    () => (selectedDate ? (calendar.days.find((day) => day.date === selectedDate) ?? null) : null),
    [calendar.days, selectedDate],
  );

  const detailTitle = selectedDay ? (
    <div className="flex flex-col leading-none">
      <span className="text-[12px] tracking-[.24em] text-lol-text-muted uppercase">
        {MONTH_ABBREV.format(new Date(`${selectedDay.date}T00:00:00Z`))}
      </span>
      <span className="mt-1.5 text-[30px] text-lol-gold-50">{Number(selectedDay.date.slice(-2))}</span>
    </div>
  ) : (
    <span className="text-[15px] tracking-[.14em] text-lol-text-muted">SELECT A DATE</span>
  );

  const detailStats = [
    {
      label: "TIME PLAYED",
      value: selectedDay ? `${(selectedDay.timePlayedSeconds / 3600).toFixed(1)}h` : "—",
      highlight: true,
      bordered: false,
    },
    {
      label: "GAMES",
      value: selectedDay ? selectedDay.gamesPlayed.toLocaleString() : "—",
    },
    {
      label: "BEST PLACEMENT",
      value: selectedDay ? `${ordinal(selectedDay.bestPlacement)} PLACE` : "—",
    },
  ];

  return (
    <CategorySection
      title="TIME"
      quote="It's not about how much time you have, it's about how you spend it."
      imageUrl={SECTION_BACKGROUNDS.timePlayed}
      sidebar={
        <>
          <Dial value={totalHours} label="HOURS PLAYED" formatValue={(v) => v.toFixed(1)} />

          <div className="mt-auto flex flex-col gap-0.5">
            <SidebarStatRow label="AVG GAME TIME">
              <DurationStat major={avgMinutes} majorUnit="m" minor={avgSeconds} minorUnit="s" />
            </SidebarStatRow>

            <SidebarStatRow label="LONGEST GAME">
              <DurationStat major={longestMinutes} majorUnit="m" minor={longestSeconds} minorUnit="s" />
            </SidebarStatRow>

            <SidebarStatRow label="LONGEST DAY STREAK">
              <CountStat
                value={timePlayed.longestStreakDays}
                unit={timePlayed.longestStreakDays === 1 ? "day" : "days"}
              />
            </SidebarStatRow>

            <SidebarStatRow label="MOST GAMES IN A DAY">
              <CountStat
                value={timePlayed.mostGamesInADay}
                unit={timePlayed.mostGamesInADay === 1 ? "game" : "games"}
              />
            </SidebarStatRow>

            <SidebarStatRow label="FAVORITE DAY" last>
              {timePlayed.favoriteDayOfWeek?.toUpperCase() ?? "—"}
            </SidebarStatRow>
          </div>
        </>
      }
    >
      <HextechPanel>
        <PanelToolbar caption={MODE_CAPTION[sortMode]}>
          <DiamondTabs tabs={SORT_MODES} active={sortMode} onChange={setSortMode} />
        </PanelToolbar>

        {sortMode === "hour" ? (
          <>
            <div className="min-h-0 flex-1">
              <HourStrip
                calendar={calendar}
                gamesByHour={calendar.gamesByHour}
                top1ByHour={calendar.top1ByHour}
                top3ByHour={calendar.top3ByHour}
                selectedHour={selectedHour}
                onSelectHour={setSelectedHour}
              />
            </div>
            <DetailBand
              icon={
                <div
                  className="h-3 w-3 flex-none rotate-45 border"
                  style={{
                    borderColor: "rgba(10,200,185,.75)",
                    background: "rgba(5,14,22,.75)",
                  }}
                />
              }
              title={
                <div className="flex flex-col leading-none">
                  <span className="text-[12px] tracking-[.24em] text-lol-text-muted">
                    {isLowSample(hourGames) ? "FEW GAMES · UTC" : "UTC · CLICK AN HOUR"}
                  </span>
                  <span className="mt-1.5 text-[30px] text-lol-gold-50">{hourLabel}</span>
                </div>
              }
              stats={[
                {
                  label: "GAMES",
                  value: hourGames.toLocaleString(),
                  highlight: true,
                  bordered: false,
                },
                {
                  label: "1ST",
                  value: hourTop1.toLocaleString(),
                },
                {
                  label: "WINS",
                  value: hourTop3Rate == null ? "—" : `${hourTop3} · ${hourTop3Rate.toFixed(0)}%`,
                },
                {
                  label: "AVG PLACEMENT",
                  value: hourAvg == null ? "—" : hourAvg.toFixed(2),
                },
              ]}
            />
          </>
        ) : (
          <>
            <Calendar calendar={calendar} mode={sortMode} onSelectDate={setSelectedDate} />
            <DetailBand
              icon={
                <div
                  className="h-3 w-3 flex-none rotate-45 border"
                  style={{
                    borderColor: "rgba(10,200,185,.75)",
                    background: "rgba(5,14,22,.75)",
                  }}
                />
              }
              title={detailTitle}
              stats={detailStats}
            />
          </>
        )}
      </HextechPanel>
    </CategorySection>
  );
};

export { TimePlayed };
