"use client";

import { useMemo } from "react";
import { useReducedMotion } from "motion/react";
import { type ColorScale, ResponsiveTimeRange } from "@/vendor/nivo-calendar";
import type { CalendarStats } from "@arena/types";
import { tierForDayGames, tierForDayBestPlacement } from "@/utils/tier-bars";
import { DayHoverCard } from "./components/day-hover-card";
import { TierFillDefs } from "./components/tier-fill-defs";
import { TIER_FILL, TIER_ORDER } from "./constants";
import { useCellEntrance } from "./hooks";
import type { Mode } from "./types";

type Props = {
  calendar: CalendarStats;
  /** "games" colors each day by how many matches were played that day
   * (silver from 1, gold from 3, prismatic from 5); "wins" colors by that
   * day's best finish (silver if played, gold on a win, prismatic on a 1st)
   * — see `tierForDayGames`/`tierForDayBestPlacement`. */
  mode: Mode;
  onSelectDate: (date: string) => void;
};

const Calendar = ({ calendar, mode, onSelectDate }: Props) => {
  const today = new Date().toISOString().slice(0, 10);
  const reduceMotion = useReducedMotion();
  const gridRef = useCellEntrance(!reduceMotion, mode);

  const statsByDay = new Map(calendar.days.map((day) => [day.date, day]));

  const earliestDay = calendar.days.reduce<string | null>(
    (min, day) => (min === null || day.date < min ? day.date : min),
    null,
  );

  const data = calendar.days
    .filter((day) => day.gamesPlayed > 0)
    .map((day) => ({
      day: day.date,
      value: TIER_ORDER.indexOf(
        mode === "games" ? (tierForDayGames(day.gamesPlayed) ?? "silver") : tierForDayBestPlacement(day.bestPlacement),
      ),
    }));

  const colorScale = useMemo(
    () =>
      Object.assign(
        (value: number | { valueOf(): number }) => TIER_FILL[TIER_ORDER[Number(value)] ?? "silver"],
        // No legend is rendered here, so `.ticks` (required by `ColorScale`
        // for legend tick generation) is never actually called.
        { ticks: (): number[] => [] },
      ) satisfies ColorScale,
    [],
  );

  function CalendarTooltip({ day }: { day: string }) {
    const dayStats = statsByDay.get(day);
    return dayStats ? <DayHoverCard day={dayStats} /> : null;
  }

  return (
    <div ref={gridRef} className="calendar-time-range relative flex h-full w-full">
      <TierFillDefs animate={!reduceMotion} />
      <ResponsiveTimeRange
        data={data}
        from={earliestDay ?? today}
        to={today}
        square
        align="center"
        margin={{ top: 24, right: 8, bottom: 8, left: 8 }}
        emptyColor="var(--color-lol-surface)"
        colorScale={colorScale}
        minValue={0}
        maxValue={TIER_ORDER.length - 1}
        dayBorderWidth={2}
        dayBorderColor="var(--color-lol-navy-900)"
        firstWeekday="monday"
        weekdays={["S", "M", "T", "W", "T", "F", "S"]}
        weekdayTicks={[0, 1, 2, 3, 4, 5, 6]}
        onClick={(datum) => onSelectDate(datum.day)}
        tooltip={CalendarTooltip}
        theme={{
          text: { fill: "var(--color-lol-text-muted)", fontSize: 11 },
        }}
      />
    </div>
  );
};

export { Calendar };
