"use client";

import { useEffect, useMemo, useRef } from "react";
import { useReducedMotion } from "motion/react";
import { ResponsiveTimeRange, type ColorScale } from "@/vendor/nivo-calendar";
import type { CalendarStats } from "@arena/types";
import { tierForDayBestPlacement, tierForDayGames, type Tier } from "@/lib/tier-bars";
import { DayHoverCard } from "./HoverCards";

type Mode = "games" | "wins";

type Props = {
  calendar: CalendarStats;
  /** "games" colors each day by how many matches were played that day
   * (silver from 1, gold from 3, prismatic from 5); "wins" colors by that
   * day's best finish (silver if played, gold on a win, prismatic on a 1st)
   * — see `tierForDayGames`/`tierForDayBestPlacement`. */
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
 * Uses our vendored copy of nivo's TimeRange (`src/vendor/nivo-calendar`,
 * see its README) rather than the published `@nivo/calendar`: upstream's
 * TimeRange silently ignores the `align` prop (unlike its own Calendar
 * chart, which honors it via alignBox), always rendering the day grid
 * flush top-left, which left visibly uncentered dead space whenever
 * `square` cell sizing ended up bound by one axis. The copy's
 * `computeOrigin` step (compute/timeRange.ts) makes `align` (default
 * "center") actually center the grid.
 *
 * Each day is one flat rarity tier (silver/gold/prismatic), no gradient
 * between them. Nivo sets a cell's color as an inline `style.fill`, so the
 * color scale returns `url(#…)` for each tier, pointing at the SVG gradients
 * rendered beside the chart (`TierFillDefs`); globals.css matches that fill to
 * add the glow. `value` is the tier's index in `TIER_ORDER`, and the scale
 * is a plain `(value) => color` function (the vendored `ColorScale` escape
 * hatch); `.ticks` is stubbed since no legend is rendered here.
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
const PRISMATIC_FILL_ID = "calendar-prismatic-fill";
const GOLD_FILL_ID = "calendar-gold-fill";
const SILVER_FILL_ID = "calendar-silver-fill";

const TIER_ORDER: Tier[] = ["silver", "gold", "prismatic"];

const TIER_FILL: Record<Tier, string> = {
  silver: `url(#${SILVER_FILL_ID})`,
  gold: `url(#${GOLD_FILL_ID})`,
  prismatic: `url(#${PRISMATIC_FILL_ID})`,
};

/** The tier cell fills. Gold and Silver bake `.tier-bar-gold`/`-silver`'s
 * metal ramp and top-lit shade into one gradient each, run corner to corner
 * like Prismatic (SVG has no
 * layered backgrounds); Prismatic uses the same muted iridescent stops as
 * `.tier-bar-prismatic`, drifting slowly across each cell. */
function TierFillDefs({ animate }: { animate: boolean }) {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden>
      <defs>
        <linearGradient id={GOLD_FILL_ID} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#dbb77a" />
          <stop offset="40%" stopColor="#cca057" />
          <stop offset="100%" stopColor="#a57b38" />
        </linearGradient>
        <linearGradient id={SILVER_FILL_ID} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#d5dcde" />
          <stop offset="40%" stopColor="#bec7cb" />
          <stop offset="100%" stopColor="#919b9f" />
        </linearGradient>
        <linearGradient id={PRISMATIC_FILL_ID} x1="0" y1="0" x2="1" y2="1" spreadMethod="reflect">
          <stop offset="0%" stopColor="#d9a3cf" />
          <stop offset="33%" stopColor="#b99be0" />
          <stop offset="66%" stopColor="#9fbde8" />
          <stop offset="100%" stopColor="#a3d6c6" />
          {animate && (
            <animateTransform
              attributeName="gradientTransform"
              type="translate"
              values="0 0; 1 1; 0 0"
              dur="10s"
              repeatCount="indefinite"
            />
          )}
        </linearGradient>
      </defs>
    </svg>
  );
}

/** The staggered entrance the day grid plays on mount and again whenever
 * `mode` recolors it — without it the calendar is the one chart on the page
 * that simply appears (HourStrip's bars grow in), and a recolor swapped every
 * cell's fill at once with nothing to draw the eye across the change.
 *
 * Driven from an effect over the real `<rect>`s rather than from React,
 * because Nivo owns that subtree: it renders the cells itself, so there is no
 * per-cell element here to hang a `motion` component or a `key` off. For the
 * same reason this uses the Web Animations API instead of a CSS class — the
 * `animation` property on these rects is already taken by the Prismatic glow
 * (see globals.css), and a second CSS animation would have to either lose to
 * it on specificity or clobber it; `element.animate()` composes with it
 * instead. Cells are staggered by grid position (column first, so the wave
 * reads left-to-right like the timeline the calendar is), which needs the
 * laid-out `x`/`y` attributes — hence reading them off the DOM.
 */
const ENTRANCE_MS = 600;
const COLUMN_STAGGER_MS = 15;
const ROW_STAGGER_MS = 8;

function useCellEntrance(enabled: boolean, replayKey: string) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) return;
    const root = containerRef.current;
    if (!root) return;

    let frame = 0;
    // ResponsiveTimeRange measures its container before it draws anything, so
    // on a cold mount the first commit has no cells yet — retry for a few
    // frames rather than silently skipping the animation.
    let attemptsLeft = 20;

    const run = () => {
      const cells = Array.from(root.querySelectorAll<SVGRectElement>("svg rect"));
      if (cells.length === 0) {
        if (attemptsLeft-- > 0) frame = requestAnimationFrame(run);
        return;
      }

      const columns = [...new Set(cells.map((c) => Number(c.getAttribute("x"))))].sort((a, b) => a - b);
      const rows = [...new Set(cells.map((c) => Number(c.getAttribute("y"))))].sort((a, b) => a - b);

      for (const cell of cells) {
        const column = columns.indexOf(Number(cell.getAttribute("x")));
        const row = rows.indexOf(Number(cell.getAttribute("y")));
        cell.animate(
          [
            { opacity: 0, transform: "scale(0.4)" },
            { opacity: 1, transform: "scale(1)" },
          ],
          {
            duration: ENTRANCE_MS,
            delay: column * COLUMN_STAGGER_MS + row * ROW_STAGGER_MS,
            easing: "cubic-bezier(0, 0, 0.58, 1)",
            fill: "backwards",
          },
        );
      }
    };

    frame = requestAnimationFrame(run);
    return () => cancelAnimationFrame(frame);
  }, [enabled, replayKey]);

  return containerRef;
}

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
