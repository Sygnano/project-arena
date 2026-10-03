import type { CalendarDayStats } from "@arena/types";
import { cn } from "cn";
import type { CSSProperties } from "react";
import { MONTH } from "@/features/recap/components/story-slides/season/constants";
import { seasonWeeks } from "@/features/recap/components/story-slides/season/utils";
import { TIER_STYLE, tierForDayBestPlacement } from "@/utils/tier-bars";

type Props = {
  days: CalendarDayStats[];
  /** Seconds before the first column pops in. */
  delay?: number;
};

const LEGEND = [
  { label: "PLAYED", fillClass: TIER_STYLE.silver.fillClass },
  { label: "WIN", fillClass: TIER_STYLE.gold.fillClass },
  { label: "1ST", fillClass: TIER_STYLE.prismatic.fillClass },
] as const;

/**
 * The season at a glance: one column per week, one square per day, lit by
 * that day's best finish (silver when played, gold on a win, prismatic on a
 * 1st: the full stats calendar's PLACEMENT view). Columns pop in left to
 * right. The pop runs on a wrapper: a prismatic fill has an animation of its
 * own, which would replace the pop on the same element.
 */
function SeasonHeatmap({ days, delay = 0.7 }: Props) {
  const weeks = seasonWeeks(days);
  if (weeks.length === 0) return null;
  const stepMs = Math.min(40, 1400 / weeks.length);

  // Cells up to 40px, less on short screens: 7 rows must leave room below.
  return (
    <div className="w-full" style={{ maxWidth: `min(${weeks.length * 40}px, ${weeks.length * 4.4}vh)` }}>
      <div aria-hidden className="relative mb-1.5 h-4 text-[10px] tracking-[.2em] text-lol-text-muted">
        {weeks.map((week, i) =>
          week.monthStart !== null ? (
            <span key={i} className="absolute" style={{ left: `${(i / weeks.length) * 100}%` }}>
              {MONTH.format(new Date(Date.UTC(2000, week.monthStart, 1))).toUpperCase()}
            </span>
          ) : null,
        )}
      </div>
      <div
        role="img"
        aria-label={`Days played: ${days.length} over ${weeks.length} weeks`}
        className="grid grid-flow-col gap-[3px]"
        style={{ gridTemplateRows: "repeat(7, auto)", gridAutoColumns: "minmax(0, 1fr)" }}
      >
        {weeks.flatMap((week, column) =>
          week.days.map((day, row) => (
            <span
              key={`${column}-${row}`}
              className="story-pop aspect-square"
              style={{ animationDelay: `${delay * 1000 + column * stepMs}ms` } as CSSProperties}
            >
              <span
                className={cn(
                  "tier-compact block size-full rounded-[2px]",
                  day === undefined
                    ? "bg-transparent"
                    : day
                      ? TIER_STYLE[tierForDayBestPlacement(day.bestPlacement)].fillClass
                      : "bg-white/[.07]",
                )}
              />
            </span>
          )),
        )}
      </div>
      <div aria-hidden className="mt-2.5 flex gap-4 text-[10px] tracking-[.24em] text-lol-text-muted">
        {LEGEND.map(({ label, fillClass }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={cn("tier-compact inline-block size-2.5 rounded-[1px]", fillClass)} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

export { SeasonHeatmap };
