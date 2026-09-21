"use client";

import type { ReactNode } from "react";
import type { ChampionStats } from "@arena/types";
import { championIconUrl } from "@/lib/riot";
import { useChampionName } from "@/lib/champion-names";
import {
  HoverCardPlacementBars,
  HoverCardRows,
  HoverCardSection,
  HoverStatCard,
} from "@/components/hover-stat-card";

/** Hover card showing how one champion's games FINISHED: win rate, 1st
 * rate, average placement and the per-placement bars. Shared by KDA's chart
 * and the Arena God grid; `subtitle`/`footer` carry each caller's context. */
function ChampionResultsCard({
  stats,
  subtitle,
  footer,
}: {
  stats: ChampionStats;
  subtitle?: ReactNode;
  footer?: ReactNode;
}) {
  const displayName = useChampionName();
  const games = stats.matchesPlayed;
  const counts = stats.placementCounts ?? [];
  const wins = counts.slice(0, 3).reduce((sum, count) => sum + count, 0);
  const rate = (part: number) => `${games > 0 ? ((part / games) * 100).toFixed(0) : 0}%`;
  return (
    <HoverStatCard
      title={
        <span className="flex items-center gap-2.5">
          <img
            src={championIconUrl(stats.championName)}
            alt=""
            className="size-8 flex-none border border-[rgba(200,170,110,.4)]"
          />
          {displayName(stats.championName)}
        </span>
      }
      meta={`${games.toLocaleString()} game${games === 1 ? "" : "s"}`}
      subtitle={subtitle}
    >
      <HoverCardSection>
        <HoverCardRows
          rows={[
            { label: "WINRATE", value: rate(wins) },
            { label: "1ST RATE", value: rate(counts[0] ?? 0) },
            { label: "AVG PLACEMENT", value: stats.avgPlacement.toFixed(2) },
          ]}
        />
      </HoverCardSection>
      {counts.length > 0 ? (
        <HoverCardSection label="FINISHES">
          <HoverCardPlacementBars counts={counts} />
        </HoverCardSection>
      ) : null}
      {footer}
    </HoverStatCard>
  );
}

export { ChampionResultsCard };
