"use client";

import type { ChampionPickBreakdown } from "@arena/types";
import { TIER_STYLE } from "@/utils/tier-bars";

/** The three-way placement split as one bar — the same prismatic / gold /
 * silver tier fills (and therefore the same meaning) as Champion Picks'
 * stacked columns, just laid out horizontally to fit the identity column. */
function PlacementSplitBar({ champion }: { champion: ChampionPickBreakdown }) {
  const segments = [
    { key: "top1", value: champion.top1, tier: TIER_STYLE.prismatic },
    { key: "top3", value: champion.top3ExclTop1, tier: TIER_STYLE.gold },
    { key: "rest", value: champion.remaining, tier: TIER_STYLE.silver },
  ] as const;

  return (
    <div className="flex h-2.5 w-full overflow-hidden bg-[rgba(200,170,110,.1)]">
      {segments.map((segment) => (
        <div
          key={segment.key}
          className={segment.tier.fillClass}
          title={`${segment.value} game${segment.value === 1 ? "" : "s"}`}
          style={{
            width: champion.timesPicked > 0 ? `${(segment.value / champion.timesPicked) * 100}%` : "0%",
          }}
        />
      ))}
    </div>
  );
}

export { PlacementSplitBar };
