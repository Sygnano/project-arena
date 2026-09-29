"use client";

import type { ChampionPickBreakdown, ChampionStats } from "@arena/types";
import { championIconUrl } from "@/utils/riot";
import { useChampionName } from "@/features/recap/stores/champion-names";
import { HoverStatCard, HoverCardSection, HoverCardRows } from "@/features/recap/components/hover-stat-card";
import { formatCompact, formatDuration } from "@/utils/format";
import { isLowSample } from "@/features/recap/utils/sample";

/** Hover card for one Picks column: the champion's name (the chart shows only
 * an icon) and its average COMBAT line. Complements the sidebar, which
 * carries the results for whichever champion is pinned. */
function PicksHoverCard({
  pick,
  stats,
  rank,
  total,
  sortNoun,
}: {
  pick: ChampionPickBreakdown;
  stats: ChampionStats | undefined;
  rank: number;
  total: number;
  sortNoun: string;
}) {
  const displayName = useChampionName();
  const games = pick.timesPicked;
  const perGame = (value: number) => (games > 0 ? value / games : 0);
  const kda = stats?.kda;
  const damage = stats ? stats.damage.total.physical + stats.damage.total.magical + stats.damage.total.trueDamage : 0;
  return (
    <HoverStatCard
      title={
        <span className="flex items-center gap-2.5">
          <img
            src={championIconUrl(pick.championName)}
            alt=""
            className="size-8 flex-none border border-[rgba(200,170,110,.4)]"
          />
          {displayName(pick.championName)}
        </span>
      }
      meta={`${games.toLocaleString()} game${games === 1 ? "" : "s"}`}
      subtitle={
        <span className="mt-1.5 block">
          #{rank} of {total} {sortNoun.toLowerCase()}
          {isLowSample(games) ? " · few games" : ""}
        </span>
      }
    >
      {kda && stats ? (
        <HoverCardSection label="AVERAGE GAME">
          <HoverCardRows
            rows={[
              {
                label: "K / D / A",
                value: `${perGame(kda.totalKills).toFixed(1)} / ${perGame(kda.totalDeaths).toFixed(1)} / ${perGame(kda.totalAssists).toFixed(1)}`,
              },
              {
                label: "KDA",
                value: ((kda.totalKills + kda.totalAssists) / Math.max(1, kda.totalDeaths)).toFixed(2),
              },
              { label: "DAMAGE", value: formatCompact(perGame(damage)) },
              { label: "GAME LENGTH", value: formatDuration(perGame(stats.timePlayedSeconds)) },
            ]}
          />
        </HoverCardSection>
      ) : null}
      <div className="mt-2.5 text-[10px] tracking-[.2em] text-lol-text-muted/70">CLICK TO PIN IN THE SIDEBAR</div>
    </HoverStatCard>
  );
}

export { PicksHoverCard };
