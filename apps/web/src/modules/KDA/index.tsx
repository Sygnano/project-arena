"use client";

import { useMemo } from "react";
import type { ChampionKdaStats, ChampionStats } from "@arena/types";
import { AnimatedNumber } from "@/components/animated-number";
import { CategorySection } from "@/components/category-section";
import { CarouselItem } from "@/components/ui/carousel";
import {
  CategoryLayout,
  SidebarHeadline,
  SidebarStatGrid,
} from "@/components/layout";
import { KillChart } from "./Chart";

type Props = {
  kills: number;
  deaths: number;
  assists: number;
  mostKills: number;
  mostDeaths: number;
  mostAssists: number;
  kda: number;
  bestKda: number;
  champions: Record<number, ChampionStats>;
};

const ROW_HEIGHT = 44;
const MIN_CHART_HEIGHT = 200;

export type Metric = "total" | "best";
export type Stat = "kills" | "deaths" | "assists" | "kda";
export type KdaChartDatum = { stat: string; value: number };

// One carousel slide per stat — replaces the old Kills/Deaths/Assists/KDA
// toggle group. Each slide shows both metrics side by side (see KillChart
// usage below), so the Total/Best toggle group is gone too.
const STATS: Stat[] = ["kills", "deaths", "assists", "kda"];

const STAT_LABEL: Record<Stat, string> = {
  kills: "Kills",
  deaths: "Deaths",
  assists: "Assists",
  kda: "KDA",
};

const STAT_FIELD: Record<
  Metric,
  Partial<Record<Stat, keyof ChampionKdaStats>>
> = {
  total: {
    kills: "totalKills",
    deaths: "totalDeaths",
    assists: "totalAssists",
  },
  best: {
    kills: "mostKills",
    deaths: "mostDeaths",
    assists: "mostAssists",
    kda: "bestKda",
  },
};

export const STAT_COLOR: Record<Stat, string> = {
  kills: "var(--color-lol-blue-300)",
  deaths: "var(--color-lol-damage)",
  assists: "var(--color-lol-heal)",
  kda: "var(--color-lol-gold-300)",
};

/** `total`+`kda` isn't a stored column (see `ChampionKdaStats`) — it's the
 * same average-KDA formula as the page's overall `kda` stat, just derived
 * from this one champion's totals instead of the summoner's. Every other
 * metric/stat combination reads straight off a `ChampionKdaStats` field. */
function championStatValue(
  kda: ChampionKdaStats,
  metric: Metric,
  stat: Stat,
): number {
  if (stat === "kda" && metric === "total") {
    return kda.totalDeaths === 0
      ? kda.totalKills + kda.totalAssists
      : (kda.totalKills + kda.totalAssists) / kda.totalDeaths;
  }
  return kda[STAT_FIELD[metric][stat]!];
}

const KDA = ({
  kills,
  deaths,
  assists,
  kda,
  mostKills,
  mostDeaths,
  mostAssists,
  bestKda,
  champions,
}: Props) => {
  // Total and Best datasets for every stat, computed up front — each
  // carousel slide (one per stat) renders both side by side rather than
  // switching between them via a toggle. `stat` (the object field below,
  // unrelated to the outer `Stat` key) is the champion name and doubles as
  // the indexBy key — the icon itself is looked up from that same name
  // inside ChampionIconTick.
  const chartDataByStat = useMemo(() => {
    const championList = Object.values(champions);
    return Object.fromEntries(
      STATS.map((stat) => [
        stat,
        {
          total: championList
            .map((champion) => ({
              stat: champion.championName,
              value: championStatValue(champion.kda, "total", stat),
            }))
            .sort((a, b) => a.value - b.value),
          best: championList
            .map((champion) => ({
              stat: champion.championName,
              value: championStatValue(champion.kda, "best", stat),
            }))
            .sort((a, b) => a.value - b.value),
        },
      ]),
    ) as Record<Stat, { total: KdaChartDatum[]; best: KdaChartDatum[] }>;
  }, [champions]);

  // Each bar needs a fixed pixel height to stay readable — ResponsiveBar
  // fills 100% of its immediate parent, so that parent is sized by row
  // count (not the outer, viewport-capped scroll container) and the
  // overflow on the outer one is what makes it scrollable. Every stat has
  // the same number of rows (one per champion), so this is computed once.
  const chartInnerHeight = Math.max(
    Object.keys(champions).length * ROW_HEIGHT,
    MIN_CHART_HEIGHT,
  );

  return (
    <CategorySection title="KDA" quote="The KDA is the KDA.">
      <CategoryLayout
        sidebar={
          <>
            <SidebarHeadline label="KDA">
              <AnimatedNumber
                value={kda}
                decimals={2}
                className="font-display text-6xl font-semibold text-lol-gold-50"
              />
            </SidebarHeadline>

            <SidebarStatGrid>
              <span className="font-body text-sm text-lol-text-muted">
                Kills
              </span>
              <div className="flex items-baseline justify-self-end gap-1">
                <AnimatedNumber
                  value={kills}
                  className="font-display text-2xl font-semibold text-lol-gold-50"
                />
                <span></span>
              </div>

              <span className="font-body text-sm text-lol-text-muted">
                Deaths
              </span>
              <div className="flex items-baseline justify-self-end gap-1">
                <AnimatedNumber
                  value={deaths}
                  className="font-display text-2xl font-semibold text-lol-gold-50"
                />
                <span></span>
              </div>

              <span className="font-body text-sm text-lol-text-muted">
                Assists
              </span>
              <div className="flex items-baseline justify-self-end gap-1">
                <AnimatedNumber
                  value={assists}
                  className="font-display text-2xl font-semibold text-lol-gold-50"
                />
              </div>
            </SidebarStatGrid>
          </>
        }
      >
        {STATS.map((stat) => (
          <CarouselItem key={stat} className="h-full">
            <div className="flex h-full min-w-0 flex-1 flex-col">
              <div className="mb-4 text-center font-display text-2xl font-semibold text-lol-gold-50">
                {STAT_LABEL[stat]}
              </div>
              <div className="flex h-full min-h-0 flex-1 gap-8">
                <KillChart
                  title="Total"
                  chartData={chartDataByStat[stat].total}
                  chartInnerHeight={chartInnerHeight}
                  stat={stat}
                />
                <KillChart
                  title="Best"
                  chartData={chartDataByStat[stat].best}
                  chartInnerHeight={chartInnerHeight}
                  stat={stat}
                />
              </div>
            </div>
          </CarouselItem>
        ))}
      </CategoryLayout>
    </CategorySection>
  );
};

export { KDA };
