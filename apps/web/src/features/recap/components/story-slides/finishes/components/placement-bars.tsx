"use client";

import { motion } from "motion/react";
import { cn } from "cn";
import { TIER_STYLE } from "@/utils/tier-bars";
import { ordinal } from "@/utils/format";
import { placementTier } from "@/features/recap/components/story-slides/finishes/utils";

type Props = {
  /** Games per placement, keyed by placement (only those that occurred). */
  byPlacement: Record<number, number>;
  delay?: number;
};

/** One bar per finishing place, growing up one after the other, 1st to last.
 * The tallest fills 85% of the track, leaving room for its count. */
function PlacementBars({ byPlacement, delay = 0.7 }: Props) {
  const rows = Object.entries(byPlacement)
    .map(([placement, games]) => ({ placement: Number(placement), games }))
    .sort((a, b) => a.placement - b.placement);
  const max = Math.max(1, ...rows.map((row) => row.games));

  return (
    <div className="flex h-[clamp(120px,24vh,300px)] lg:h-[clamp(180px,38vh,400px)] items-end gap-[clamp(8px,1.4vw,18px)]">
      {rows.map((row, i) => {
        const tier = TIER_STYLE[placementTier(row.placement)];
        return (
          <div key={row.placement} className="flex h-full w-[clamp(30px,4.6vw,68px)] flex-col items-center">
            <div className="flex w-full flex-1 flex-col items-center justify-end">
              <motion.span
                className="mb-1.5 text-[12px] text-lol-gold-50 tabular-nums sm:text-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: delay + 0.5 + i * 0.12 }}
              >
                {row.games}
              </motion.span>
              <motion.div
                className={cn("w-full origin-bottom", tier.fillClass)}
                style={{ height: `${Math.max(1, (row.games / max) * 85)}%`, boxShadow: tier.glow }}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ delay: delay + i * 0.12, duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
              />
            </div>
            <span className="mt-2 text-[11px] tracking-[.12em] text-lol-text-muted">
              {ordinal(row.placement).toUpperCase()}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export { PlacementBars };
