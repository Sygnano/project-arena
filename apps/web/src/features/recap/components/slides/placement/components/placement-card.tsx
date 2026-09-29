"use client";

import type { PlacementDetail } from "@arena/types";
import { HoverStatCard, HoverCardSection, HoverCardRows } from "@/features/recap/components/hover-stat-card";
import { TIER_STYLE } from "@/utils/tier-bars";
import { formatDuration, formatCompact, ordinal } from "@/utils/format";
import { championIconUrl } from "@/utils/riot";
import { useChampionName } from "@/features/recap/stores/champion-names";
import { placementTier } from "@/features/recap/components/slides/placement/utils";

function PlacementCard({
  placement,
  count,
  totalGames,
  cumulative,
  detail,
}: {
  placement: number;
  count: number;
  totalGames: number;
  cumulative: number;
  detail: PlacementDetail | undefined;
}) {
  const championName = useChampionName();
  const tier = TIER_STYLE[placementTier(placement)];
  const share = totalGames > 0 ? (count / totalGames) * 100 : 0;
  const orBetter = totalGames > 0 ? (cumulative / totalGames) * 100 : 0;
  const rows = detail
    ? [
        { label: "GAME LENGTH", value: formatDuration(detail.avgGameSeconds) },
        { label: "KDA", value: detail.kda.toFixed(2) },
        { label: "DAMAGE", value: formatCompact(detail.avgDamage) },
        { label: "AUGMENTS", value: detail.avgAugments.toFixed(1) },
      ]
    : [];

  return (
    <HoverStatCard
      title={`${ordinal(placement).toUpperCase()} PLACE`}
      meta={`${count.toLocaleString()} game${count === 1 ? "" : "s"}`}
      subtitle={`${share.toFixed(0)}% of games${placement > 1 ? ` · ${orBetter.toFixed(0)}% ${ordinal(placement)} or better` : ""}`}
      edgeColor={tier.edge}
    >
      {detail ? (
        <>
          <HoverCardSection label="AVERAGE GAME">
            <HoverCardRows rows={rows} />
          </HoverCardSection>
          {detail.topChampion ? (
            <HoverCardSection>
              <div className="flex items-center gap-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={championIconUrl(detail.topChampion.championName)}
                  alt=""
                  className="size-8 border border-[rgba(200,170,110,.4)]"
                />
                <div className="min-w-0">
                  <div className="text-[10px] tracking-[.22em] text-lol-text-muted">
                    MOST OFTEN {ordinal(placement).toUpperCase()}
                  </div>
                  <div className="truncate font-display text-lol-gold-50">
                    {championName(detail.topChampion.championName)}
                  </div>
                  <div className="text-lol-text-muted">
                    {detail.topChampion.games} of {detail.topChampion.totalGames} games ·{" "}
                    {Math.round((detail.topChampion.games / detail.topChampion.totalGames) * 100)}%
                  </div>
                </div>
              </div>
            </HoverCardSection>
          ) : null}
        </>
      ) : null}
    </HoverStatCard>
  );
}

export { PlacementCard };
