"use client";

import { useMemo, useState } from "react";
import type { CalendarStats, TimePlayedStats } from "@arena/types";
import { AnimatedNumber } from "@/components/animated-number";
import { CategorySection } from "@/components/category-section";
import { Dial } from "@/components/dial";
import { Calendar } from "./Calendar";
import { HourRadial } from "./HourRadial";
import { HextechPanel } from "@/components/hextech-panel";
import { DetailBand } from "@/components/detail-band";
import { FadingRule } from "@/components/fading-rule";
import { DiamondTabs } from "@/components/diamond-tabs";
import { ordinal } from "@/lib/format";

type SortMode = "games" | "wins" | "hour";

const SORT_MODES: { key: SortMode; label: string }[] = [
  { key: "games", label: "BY GAMES" },
  { key: "wins", label: "BY WINS" },
  { key: "hour", label: "BY HOUR" },
];

const MONTH_ABBREV = new Intl.DateTimeFormat("en-US", {
  month: "short",
  timeZone: "UTC",
});

type Props = {
  timePlayed: TimePlayedStats;
  gamesPlayed: number;
  calendar: CalendarStats;
};

/** Renders a single count with a unit suffix, e.g. "5 days" or "12 games". */
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

/** A single row in the sidebar stat list — diamond bullet + label + value. */
function SidebarStatRow({
  label,
  children,
  last,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-3.5 px-1 py-3.25"
      style={{
        borderTop: "1px solid rgba(200,170,110,.14)",
        borderBottom: last ? "1px solid rgba(200,170,110,.14)" : undefined,
      }}
    >
      <div className="h-1.75 w-1.75 flex-none rotate-45 bg-lol-gold-300" />
      <div className="flex-1 text-sm tracking-[.12em] text-lol-text-secondary">
        {label}
      </div>
      {children}
    </div>
  );
}

const TimePlayed = ({ timePlayed, gamesPlayed, calendar }: Props) => {
  const [sortMode, setSortMode] = useState<SortMode>("games");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const hours = Math.floor(timePlayed.timePlayedSeconds / 3600);
  const minutes = Math.floor((timePlayed.timePlayedSeconds % 3600) / 60);

  const avgMinutes = Math.floor(timePlayed.averageGameSeconds / 60);
  const avgSeconds = Math.floor(timePlayed.averageGameSeconds % 60);

  const longestMinutes = Math.floor(timePlayed.longestGameSeconds / 60);
  const longestSeconds = Math.floor(timePlayed.longestGameSeconds % 60);

  const totalHours = +(timePlayed.timePlayedSeconds / 3600).toFixed(1);

  const selectedDay = useMemo(
    () =>
      selectedDate
        ? (calendar.days.find((day) => day.date === selectedDate) ?? null)
        : null,
    [calendar.days, selectedDate],
  );

  const detailTitle = selectedDay ? (
    <div className="flex flex-col leading-none">
      <span className="text-[12px] tracking-[.24em] text-lol-text-muted uppercase">
        {MONTH_ABBREV.format(new Date(`${selectedDay.date}T00:00:00Z`))}
      </span>
      <span className="mt-1.5 text-[30px] text-lol-gold-50">
        {Number(selectedDay.date.slice(-2))}
      </span>
    </div>
  ) : (
    <span className="text-[15px] tracking-[.14em] text-lol-text-muted">
      SELECT A DATE
    </span>
  );

  const detailStats = [
    {
      label: "TIME PLAYED",
      value: selectedDay
        ? `${(selectedDay.timePlayedSeconds / 3600).toFixed(1)}h`
        : "—",
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
      imageUrl="/images/kda-bg.jpg"
      nextSectionLabel="TEAMS"
      sidebar={
        <>
          <Dial
            value={totalHours}
            label="HOURS PLAYED"
            formatValue={(v) => v.toFixed(1)}
          />

          <div className="mt-auto flex flex-col gap-0.5">
            <SidebarStatRow label="AVG GAME TIME">
              <DurationStat
                major={avgMinutes}
                majorUnit="m"
                minor={avgSeconds}
                minorUnit="s"
              />
            </SidebarStatRow>

            <SidebarStatRow label="LONGEST GAME">
              <DurationStat
                major={longestMinutes}
                majorUnit="m"
                minor={longestSeconds}
                minorUnit="s"
              />
            </SidebarStatRow>

            <SidebarStatRow label="LONGEST STREAK" last>
              <CountStat
                value={timePlayed.longestStreakDays}
                unit={timePlayed.longestStreakDays === 1 ? "day" : "days"}
              />
            </SidebarStatRow>
          </div>
        </>
      }
    >
      <HextechPanel>
        <div className="mb-3.5 flex items-center gap-6">
          <DiamondTabs
            tabs={SORT_MODES}
            active={sortMode}
            onChange={setSortMode}
          />
          <FadingRule />
          <div className="text-[11px] tracking-[.28em] whitespace-nowrap text-lol-text-muted">
            MATCHES BY DATE · SORTED ·{" "}
            {SORT_MODES.find((m) => m.key === sortMode)?.label}
          </div>
        </div>

        {sortMode === "hour" ? (
          <HourRadial gamesByHour={calendar.gamesByHour} />
        ) : (
          <>
            <Calendar
              calendar={calendar}
              mode={sortMode}
              onSelectDate={setSelectedDate}
            />
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
