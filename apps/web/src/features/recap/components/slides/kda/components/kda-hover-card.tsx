"use client";

import type { ChampionStats } from "@arena/types";
import { ChampionResultsCard } from "@/features/recap/components/champion-results-card";
import { isLowSample } from "@/features/recap/utils/sample";

/** Hover card for one KDA column: the champion's name (the chart shows only
 * an icon) and how its games FINISHED. Complements the detail band below,
 * which carries the combat line for whichever champion is pinned. */
function KdaHoverCard({
  stats,
  rank,
  total,
  sortLabel,
  modeLabel,
}: {
  stats: ChampionStats;
  rank: number;
  total: number;
  sortLabel: string;
  modeLabel: string;
}) {
  return (
    <ChampionResultsCard
      stats={stats}
      subtitle={
        <span className="mt-1.5 block">
          #{rank} of {total} · {modeLabel.toLowerCase()} · by {sortLabel.toLowerCase()}
          {isLowSample(stats.matchesPlayed) ? " · few games" : ""}
        </span>
      }
      footer={<div className="mt-2.5 text-[10px] tracking-[.2em] text-lol-text-muted/70">CLICK TO PIN BELOW</div>}
    />
  );
}

export { KdaHoverCard };
