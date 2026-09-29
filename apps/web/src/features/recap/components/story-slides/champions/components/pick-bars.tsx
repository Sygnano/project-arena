"use client";

import type { ChampionPickBreakdown } from "@arena/types";
import { motion } from "motion/react";
import { cn } from "cn";
import { championIconUrl } from "@/utils/riot";
import { TIER_STYLE, tierForRank } from "@/utils/tier-bars";
import { useChampionName } from "@/features/recap/stores/champion-names";

type Props = {
  picks: ChampionPickBreakdown[];
  delay?: number;
};

/** The most played champions as ranked horizontal bars, sliding in one by one. */
function PickBars({ picks, delay = 0.8 }: Props) {
  const championName = useChampionName();
  const max = Math.max(1, ...picks.map((pick) => pick.timesPicked));

  return (
    <ol className="flex flex-col gap-[clamp(6px,1.2vh,12px)]">
      {picks.map((pick, i) => {
        const tier = TIER_STYLE[tierForRank(i)];
        return (
          <motion.li
            key={pick.championId}
            className="flex items-center gap-3"
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: delay + i * 0.14, duration: 0.5 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={championIconUrl(pick.championName)}
              alt=""
              width={40}
              height={40}
              className="size-[clamp(28px,4.4vh,40px)] flex-none border border-[rgba(200,170,110,.45)] object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3 text-[13px] sm:text-sm">
                <span className="truncate text-lol-gold-50">{championName(pick.championName)}</span>
                <span className="text-lol-text-muted tabular-nums">{pick.timesPicked}</span>
              </div>
              <div className="mt-1 h-1.5 bg-white/[.06]">
                <motion.div
                  className={cn("h-full origin-left", tier.fillClass)}
                  style={{ width: `${(pick.timesPicked / max) * 100}%`, boxShadow: tier.glow }}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: delay + 0.2 + i * 0.14, duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
                />
              </div>
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}

export { PickBars };
