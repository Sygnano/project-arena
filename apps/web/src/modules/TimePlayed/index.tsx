import { useState } from "react";
import { cn } from "cn";
import type { CalendarStats, TimePlayedStats } from "@arena/types";
import { AnimatedNumber } from "@/components/animated-number";
import { CategorySection } from "@/components/category-section";
import { Dial } from "@/components/dial";
import { Calendar } from "./Calendar";
import { HextechPanel } from "@/components/hextech-panel";
import { DetailBand } from "@/components/detail-band";

type SortMode = "games" | "wins" | "hour";

const SORT_MODES: { key: SortMode; label: string }[] = [
  { key: "games", label: "BY GAMES" },
  { key: "wins", label: "BY WINS" },
  { key: "hour", label: "BY HOUR" },
];

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

  const hours = Math.floor(timePlayed.timePlayedSeconds / 3600);
  const minutes = Math.floor((timePlayed.timePlayedSeconds % 3600) / 60);

  const avgMinutes = Math.floor(timePlayed.averageGameSeconds / 60);
  const avgSeconds = Math.floor(timePlayed.averageGameSeconds % 60);

  const longestMinutes = Math.floor(timePlayed.longestGameSeconds / 60);
  const longestSeconds = Math.floor(timePlayed.longestGameSeconds % 60);

  const totalHours = +(timePlayed.timePlayedSeconds / 3600).toFixed(1);

  return (
    <CategorySection
      title="Time"
      quote="It's not about how much time you have, it's about how you spend it."
      imageUrl="/images/kda-bg.jpg"
      nextSectionLabel="TEAMS"
      sidebar={
        <>
          <Dial
            value={totalHours}
            label="HOURS"
            formatValue={(v) => v.toFixed(1)}
          />

          <div className="mt-auto flex flex-col gap-0.5">
            <SidebarStatRow label="TIME PLAYED">
              <div className="font-display text-[22px] text-lol-gold-50">
                <AnimatedNumber value={hours} />h{" "}
                <AnimatedNumber value={minutes} />m
              </div>
            </SidebarStatRow>

            <SidebarStatRow label="GAMES PLAYED">
              <div className="font-display text-[22px] text-lol-gold-50">
                <AnimatedNumber value={gamesPlayed} />
              </div>
            </SidebarStatRow>

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
      <HextechPanel title="Calendar">
        <div className="mb-5 flex items-center gap-2 border px-1 py-0.5" style={{ borderColor: "rgba(200,170,110,.22)" }}>
          {SORT_MODES.map(({ key, label }) => {
            const active = sortMode === key;
            return (
              <div
                key={key}
                onClick={() => setSortMode(key)}
                className={cn(
                  "cursor-pointer px-3 py-1.25 text-xs tracking-[.24em] transition-colors duration-150",
                  active
                    ? "bg-[rgba(200,170,110,.16)] text-lol-gold-50"
                    : "text-[#8a8578] hover:bg-[rgba(200,170,110,.08)] hover:text-lol-gold-100",
                )}
              >
                {label}
              </div>
            );
          })}
        </div>
        <Calendar calendar={calendar} />
        <DetailBand
          icon={null}
          title="SEP 17"
          stats={[
            {
              label: "TIME PLAYED",
              value: "44",
              highlight: true,
              bordered: false,
            },
            {
              label: "GAMES",
              value: "4",
            },
            {
              label: "BEST PLACEMENT",
              value: "1st PLACE",
            },
          ]}
        />
      </HextechPanel>
    </CategorySection>
  );
};

export { TimePlayed };
