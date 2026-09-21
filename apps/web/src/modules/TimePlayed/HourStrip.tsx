"use client";

import { motion } from "motion/react";
import type { CalendarStats } from "@arena/types";
import { cn } from "cn";
import { CursorTooltip } from "@/components/cursor-tooltip";
import { useChartHover } from "@/hooks/use-chart-hover";
import { HourHoverCard } from "./HoverCards";
import { TIER_STYLE, type TierStyle } from "@/lib/tier-bars";
import { barHeight } from "@/lib/bar-scale";

type Props = {
  /** The full calendar stats, for the hover card's per-hour extras. */
  calendar: CalendarStats;
  /** 24 entries, index 0 = matches starting 00:00-00:59 UTC. */
  gamesByHour: number[];
  /** 24 entries, 1st-place finishes per hour. */
  top1ByHour: number[];
  /** 24 entries, top 3 finishes (1st included) per hour. */
  top3ByHour: number[];
  selectedHour: number;
  /** Called with the clicked hour (0-23), driving the detail band. */
  onSelectHour?: (hour: number) => void;
};

type Segment = { key: string; count: number; tier: TierStyle };

/** Below this share of the track a segment can't fit its count legibly; the
 * count stays reachable through the column's title and the detail band. */
const MIN_LABEL_PERCENT = 7;

function pad(hour: number) {
  return String(hour).padStart(2, "0");
}

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/**
 * "BY HOUR" view: one stacked column per UTC hour. Total height = games
 * started in that hour (linear from zero, `lib/bar-scale.ts`), split into the
 * same fixed-meaning tier stack as TeamSlot: Prismatic = 1st, Gold = 2nd-3rd,
 * Silver = everything lower. So both "when do we play" and the exact 1st /
 * top 3 counts per hour read straight off the bars.
 */
function HourStrip({
  calendar,
  gamesByHour,
  top1ByHour,
  top3ByHour,
  selectedHour,
  onSelectHour,
}: Props) {
  const maxGames = Math.max(0, ...gamesByHour);

  const { hover, setHover, containerRef: stripRef } = useChartHover<number>();

  return (
    <div
      ref={stripRef}
      className="flex h-full min-h-64 w-full flex-col gap-3 pt-2"
    >
      <div className="flex min-h-0 flex-1 items-stretch gap-0.75 sm:gap-1.5">
        {gamesByHour.map((games, hour) => {
          const top1 = top1ByHour[hour] ?? 0;
          const top3 = top3ByHour[hour] ?? 0;
          const selected = hour === selectedHour;
          const height = barHeight(games, maxGames, 100, games > 0 ? 1.5 : 0);
          // Top-to-bottom, like TeamSlot: 1st sits on top of the stack.
          const segments: Segment[] = [
            { key: "top1", count: top1, tier: TIER_STYLE.prismatic },
            { key: "top3", count: top3 - top1, tier: TIER_STYLE.gold },
            { key: "rest", count: games - top3, tier: TIER_STYLE.silver },
          ];
          const summary = `${pad(hour)}:00 UTC · ${plural(games, "game")} · ${top1} 1st · ${top3} wins`;

          return (
            <button
              key={hour}
              type="button"
              onClick={() => onSelectHour?.(hour)}
              aria-pressed={selected}
              aria-label={summary}
              onPointerEnter={(event) =>
                setHover({
                  id: hour,
                  point: { x: event.clientX, y: event.clientY },
                })
              }
              onPointerMove={(event) =>
                setHover({
                  id: hour,
                  point: { x: event.clientX, y: event.clientY },
                })
              }
              onPointerLeave={(event) => {
                if (event.pointerType !== "touch") setHover(null);
              }}
              onFocus={(event) => {
                // Keyboard focus only; a click keeps the card on the pointer.
                if (!event.currentTarget.matches(":focus-visible")) return;
                const rect = event.currentTarget.getBoundingClientRect();
                setHover({
                  id: hour,
                  point: { x: rect.left + rect.width / 2, y: rect.top },
                });
              }}
              onBlur={() => setHover(null)}
              className={cn(
                "group relative flex min-w-0 flex-1 cursor-pointer flex-col justify-end rounded-sm outline-none",
                "focus-visible:ring-1 focus-visible:ring-lol-blue-300",
                selected ? "bg-lol-blue-300/6" : "hover:bg-lol-gold-50/3",
              )}
            >
              <span
                className={cn(
                  "mb-1 hidden text-center font-display text-[11px] tabular-nums transition-colors md:block",
                  selected ? "text-lol-blue-100" : "text-lol-text-muted",
                  games === 0 && "invisible",
                )}
              >
                {games}
              </span>
              <motion.div
                className={cn(
                  "mx-auto flex w-full max-w-9 origin-bottom flex-col overflow-hidden rounded-t-xs transition-[filter,box-shadow]",
                  hover?.id === hour
                    ? "brightness-125"
                    : selected
                      ? "brightness-110"
                      : "brightness-80 group-hover:brightness-100",
                )}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.6, delay: hour * 0.015, ease: "easeOut" }}
                style={{
                  height: `${height}%`,
                  boxShadow:
                    games === 0
                      ? undefined
                      : hover?.id === hour
                        ? "0 0 22px rgba(10,200,185,.5), 0 0 6px rgba(10,200,185,.4)"
                        : selected
                          ? "0 0 18px rgba(10,200,185,.35)"
                          : undefined,
                }}
              >
                {segments.map((segment) =>
                  segment.count > 0 ? (
                    <div
                      key={segment.key}
                      className={cn(
                        "flex min-h-px items-center justify-center border-t",
                        segment.tier.fillClass,
                      )}
                      style={{
                        flexGrow: segment.count,
                        flexBasis: 0,
                        borderTopColor: segment.tier.edge,
                      }}
                    >
                      {(segment.count / maxGames) * 100 >= MIN_LABEL_PERCENT && (
                        <span
                          className="font-display text-[11px] leading-none text-[#040c14]"
                          style={{ textShadow: "0 0 3px rgba(240,230,210,.9), 0 0 3px rgba(240,230,210,.9)" }}
                        >
                          {segment.count}
                        </span>
                      )}
                    </div>
                  ) : null,
                )}
              </motion.div>
              {selected && (
                <span
                  aria-hidden
                  className="absolute -bottom-1.25 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border border-lol-blue-300 bg-lol-navy-900"
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="h-px w-full bg-lol-gold-300/25" />

      <div className="flex gap-0.75 sm:gap-1.5">
        {gamesByHour.map((_, hour) => (
          <span
            key={hour}
            className={cn(
              "min-w-0 flex-1 text-center text-[10px] tabular-nums tracking-wider sm:text-[11px]",
              hour === selectedHour ? "text-lol-blue-100" : "text-lol-text-muted",
              hour % 3 !== 0 && hour !== selectedHour && "invisible lg:visible",
            )}
          >
            {pad(hour)}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2 text-[10px] tracking-[.2em] text-lol-text-muted">
        {(
          [
            [TIER_STYLE.prismatic, "1ST"],
            [TIER_STYLE.gold, "2ND–3RD"],
            [TIER_STYLE.silver, "4TH+"],
          ] as const
        ).map(([tier, label]) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={cn("inline-block h-2.5 w-2.5 rounded-[1px]", tier.fillClass)} />
            {label}
          </span>
        ))}
      </div>

      <CursorTooltip point={hover?.point ?? null}>
        {hover ? <HourHoverCard calendar={calendar} hour={hover.id} /> : null}
      </CursorTooltip>
    </div>
  );
}

export { HourStrip };
