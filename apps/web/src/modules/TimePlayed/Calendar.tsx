"use client";

import { ResponsiveTimeRange } from "@nivo/calendar";
import type { CalendarStats } from "@arena/types";

type Props = {
  calendar: CalendarStats;
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
 * Uses our fork of `@nivo/calendar` (vendor/nivo, linked in via
 * apps/web/package.json's `link:` dependency) rather than the published
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
 * Nivo's color scale only maps a single numeric `value` per day, so `value`
 * carries top3Rate (the "how well" signal); games played isn't a second
 * visual encoding, just tooltip text — the tooltip render prop only gets
 * back `{ day, value, color, ... }` (already-formatted, no passthrough for
 * arbitrary per-datum fields), so the tooltip here closes over `statsByDay`
 * and looks the day back up rather than trying to thread extra data through
 * Nivo.
 *
 * Lives alongside TimePlayed (its only consumer, as a carousel slide) rather
 * than as its own top-level module/CategorySection — no wrapper here, the
 * parent supplies that.
 */
const Calendar = ({ calendar }: Props) => {
  const today = new Date().toISOString().slice(0, 10);

  const statsByDay = new Map(calendar.days.map((day) => [day.date, day]));

  const earliestDay = calendar.days.reduce<string | null>(
    (min, day) => (min === null || day.date < min ? day.date : min),
    null,
  );

  const data = calendar.days
    .filter((day) => day.gamesPlayed > 0)
    .map((day) => ({ day: day.date, value: day.top3Rate }));

  function CalendarTooltip({ day }: { day: string }) {
    const dayStats = statsByDay.get(day);
    const games = dayStats?.gamesPlayed ?? 0;
    const rate = dayStats?.top3Rate ?? 0;
    return (
      <div className="border-frame-subtle bg-lol-navy-900 rounded-sm border px-2.5 py-1.5 text-xs whitespace-nowrap">
        <div className="font-display font-semibold text-lol-gold-50">{day}</div>
        <div className="text-lol-text-muted">
          {games} game{games === 1 ? "" : "s"} · {rate.toFixed(0)}% top 3
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
        colors={[
          "var(--color-lol-danger)",
          "var(--color-lol-gold-400)",
          "var(--color-lol-success)",
        ]}
        minValue={0}
        maxValue={100}
        dayBorderWidth={2}
        dayBorderColor="var(--color-lol-navy-900)"
        tooltip={CalendarTooltip}
        theme={{
          text: { fill: "var(--color-lol-text-muted)", fontSize: 11 },
        }}
      />
    </div>
  );
};

export { Calendar };
