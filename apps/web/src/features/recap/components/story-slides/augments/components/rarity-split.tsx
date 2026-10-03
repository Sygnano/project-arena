"use client";

import { cn } from "cn";
import { motion } from "motion/react";
import { RARITIES } from "@/features/recap/components/story-slides/augments/constants";

type Props = {
  /** Picks per rarity, in `RARITIES` order. */
  counts: number[];
  delay?: number;
};

/** One bar split by rarity, each share growing in after the one before. */
function RaritySplit({ counts, delay = 0.9 }: Props) {
  const total = Math.max(
    1,
    counts.reduce((sum, count) => sum + count, 0),
  );

  return (
    <div className="w-full max-w-md">
      <div className="flex h-3 gap-[3px] overflow-hidden">
        {RARITIES.map(({ rarity, fillClass }, i) =>
          counts[i] > 0 ? (
            <motion.div
              key={rarity}
              className={cn("h-full origin-left", fillClass)}
              style={{ width: `${(counts[i] / total) * 100}%` }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: delay + i * 0.35, duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
            />
          ) : null,
        )}
      </div>
      <div className="mt-2.5 flex justify-between gap-3 text-[10px] tracking-[.26em] text-lol-text-muted">
        {RARITIES.map(({ rarity, label }, i) => (
          <span key={rarity}>
            <span className="font-display text-base tracking-normal text-lol-gold-50">
              {Math.round((counts[i] / total) * 100)}%
            </span>{" "}
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

export { RaritySplit };
