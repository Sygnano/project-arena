"use client";

import type { TeammateStats } from "@arena/types";
import { motion } from "motion/react";
import { cn } from "cn";
import { TIER_STYLE } from "@/utils/tier-bars";

type Props = {
  teammates: TeammateStats[];
  delay?: number;
};

const LEGEND = [
  { label: "1ST", fillClass: TIER_STYLE.prismatic.fillClass },
  { label: "WIN", fillClass: TIER_STYLE.gold.fillClass },
  { label: "PLAYED", fillClass: TIER_STYLE.silver.fillClass },
] as const;

/**
 * The regulars, one bar each: its length is the games shared, split into
 * 1sts (prismatic), other wins (gold) and the rest (silver). Rows slide in
 * one after the other, bars growing from the left.
 */
function TeammateBars({ teammates, delay = 1.2 }: Props) {
  const max = Math.max(1, ...teammates.map((teammate) => teammate.gamesPlayed));

  return (
    <div>
      <ol className="flex flex-col gap-[clamp(8px,1.6vh,16px)]">
        {teammates.map((teammate, i) => {
          const wins = teammate.top1 + teammate.top3ExclTop1;
          const segments = [
            { key: "top1", count: teammate.top1, fillClass: TIER_STYLE.prismatic.fillClass },
            { key: "top3", count: teammate.top3ExclTop1, fillClass: TIER_STYLE.gold.fillClass },
            { key: "rest", count: teammate.remaining, fillClass: TIER_STYLE.silver.fillClass },
          ];
          return (
            <motion.li
              key={teammate.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: delay + i * 0.12, duration: 0.45 }}
            >
              <div className="flex items-baseline justify-between gap-4">
                <span className="min-w-0 truncate text-[clamp(13px,1.3vw,16px)] text-lol-gold-50">
                  {teammate.riotIdGameName}
                  <span className="ml-1 text-[.8em] text-lol-text-muted">#{teammate.riotIdTagline}</span>
                </span>
                <span className="flex-none text-[12px] text-lol-text-secondary tabular-nums">
                  {teammate.gamesPlayed} games ·{" "}
                  <span className="text-[#e6c27a]">
                    {wins} {wins === 1 ? "win" : "wins"}
                  </span>
                  {teammate.top1 > 0 ? <span className="text-[#d9b8f0]"> · {teammate.top1} 1st</span> : null}
                </span>
              </div>
              <motion.div
                className="mt-1.5 flex h-[clamp(8px,1.4vh,12px)] origin-left gap-px overflow-hidden"
                style={{ width: `${(teammate.gamesPlayed / max) * 100}%` }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: delay + 0.15 + i * 0.12, duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
              >
                {segments.map((segment) =>
                  segment.count > 0 ? (
                    <span
                      key={segment.key}
                      className={cn("tier-compact h-full", segment.fillClass)}
                      style={{ flexGrow: segment.count, flexBasis: 0 }}
                    />
                  ) : null,
                )}
              </motion.div>
            </motion.li>
          );
        })}
      </ol>
      <div aria-hidden className="mt-3 flex gap-4 text-[10px] tracking-[.24em] text-lol-text-muted">
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

export { TeammateBars };
