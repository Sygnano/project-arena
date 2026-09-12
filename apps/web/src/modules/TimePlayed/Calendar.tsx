"use client";

import { useMemo } from "react";
import { ResponsiveTimeRange, type ColorScale } from "@nivo/calendar";
import type { CalendarStats } from "@arena/types";
import {
  tierGradient,
  gamesTierPosition,
  placementTierPosition,
} from "@/lib/tier-bars";

type Mode = "games" | "wins";

type Props = {
  calendar: CalendarStats;
  /** "games" colors each day by how many matches were played that day
   * (silver from 1, gold at 5, prismatic from 10+); "wins" colors by that
   * day's average placement instead (prismatic at 1st, gold at 3rd, silver
   * from 6th) — see `gamesTierPosition`/`placementTierPosition`. */
  mode: Mode;
  onSelectDate: (date: string) => void;
};

/**
 * Day-by-day activity calendar via Nivo's Time Range chart
 * (https://nivo.rocks/time-range/) rather than its plain Calendar chart —
 * Calendar always renders full Jan-to-Dec year(s) spanning `from`/`to` (it
 * only uses those to pick which years to include), which left most of the
 * grid empty for a summoner tracked for less than a year. TimeRange instead
 * lays out exactly the `from`-to-`to` window, so the grid genuinely starts
 * at the week of the summoner's earliest tracked match instead of padding
 * back to January.
 *
 * Uses our fork of `@nivo/calendar` (vendor/nivo, packed into
 * apps/web/package.json's `file:*.tgz` dependency) rather than the published
 * npm package — upstream's TimeRange chart silently ignored the `align`
 * prop entirely (unlike its own Calendar chart, which honors it via
 * alignBox), always rendering the day grid flush top-left plus the weekday
 * label offset. That left visibly uncentered dead space whenever `square`
 * cell sizing ended up bound by one axis instead of filling both. The fork
 * adds a computeOrigin step (vendor/nivo/packages/calendar/src/compute/
 * timeRange.ts) mirroring Calendar's own alignBox usage, so `align`
 * (default "center") now actually centers the grid the way the upstream
 * Calendar chart already did.
 *
 * The per-day color is a genuinely continuous gradient along the app's
 * silver/gold/prismatic rarity scale (`tierGradient`) rather than Nivo's
 * default 3-band quantize scale — passing a plain `(value) => color`
 * function as `colorScale` (a documented escape hatch already exported by
 * the fork's `types.ts`, `ScaleQuantize<string> | ColorScale`) gets this for
 * free with no further nivo changes; `.ticks` is stubbed since no legend is
 * rendered here.
 *
 * Nivo's color scale only maps a single numeric `value` per day, so `value`
 * carries whatever `mode` needs (games played, or average placement) — the
 * tooltip and the `DetailBand` below need more than that one number, so
 * both close over `statsByDay` and look the day back up by date rather than
 * trying to thread extra fields through Nivo's datum.
 *
 * Lives alongside TimePlayed (its only consumer, as a carousel slide) rather
 * than as its own top-level module/CategorySection — no wrapper here, the
 * parent supplies that.
 */
const Calendar = ({ calendar, mode, onSelectDate }: Props) => {
  const today = new Date().toISOString().slice(0, 10);

  const statsByDay = new Map(calendar.days.map((day) => [day.date, day]));

  const earliestDay = calendar.days.reduce<string | null>(
    (min, day) => (min === null || day.date < min ? day.date : min),
    null,
  );

  const data = calendar.days
    .filter((day) => day.gamesPlayed > 0)
    .map((day) => ({
      day: day.date,
      value: mode === "games" ? day.gamesPlayed : day.avgPlacement,
    }));

  const colorScale = useMemo(
    () =>
      Object.assign(
        (value: number | { valueOf(): number }) =>
          tierGradient(
            mode === "games"
              ? gamesTierPosition(Number(value))
              : placementTierPosition(Number(value)),
          ),
        // No legend is rendered here, so `.ticks` (required by `ColorScale`
        // for legend tick generation) is never actually called.
        { ticks: (): number[] => [] },
      ) satisfies ColorScale,
    [mode],
  );

  function CalendarTooltip({ day }: { day: string }) {
    const dayStats = statsByDay.get(day);
    const games = dayStats?.gamesPlayed ?? 0;
    const rate = dayStats?.top3Rate ?? 0;
    const avgPlacement = dayStats?.avgPlacement ?? 0;
    return (
      <div className="border-frame-subtle bg-lol-navy-900 rounded-sm border px-2.5 py-1.5 text-xs whitespace-nowrap">
        <div className="font-display font-semibold text-lol-gold-50">{day}</div>
        <div className="text-lol-text-muted">
          {games} game{games === 1 ? "" : "s"} · avg place{" "}
          {avgPlacement.toFixed(1)} · {rate.toFixed(0)}% top 3
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full">
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
        maxValue={1}
        dayBorderWidth={2}
        dayBorderColor="var(--color-lol-navy-900)"
        firstWeekday="monday"
        weekdays={["D", "M", "T", "W", "T", "F", "S"]}
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
