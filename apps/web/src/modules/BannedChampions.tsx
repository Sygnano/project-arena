"use client";

import { ResponsiveBar } from "@nivo/bar";
import { ResponsiveScatterPlot } from "@nivo/scatterplot";
import type { BannedChampionsStats } from "@arena/types";
import { CategorySection } from "@/components/category-section";
import { ChampionIconTick } from "@/components/champion-icon-tick";
import { championIconUrl } from "@/lib/riot";

type Props = {
  bannedChampions: BannedChampionsStats;
};

const ROW_HEIGHT = 26;
const MIN_CHART_HEIGHT = 200;

interface ScatterDatum {
  x: number;
  y: number;
  championName: string;
}

function ScatterTooltip({ node }: { node: { data: ScatterDatum } }) {
  const { championName, x, y } = node.data;
  return (
    <div className="border-frame-subtle bg-lol-navy-900 flex items-center gap-2 whitespace-nowrap rounded-sm border px-2.5 py-1.5 text-xs">
      <img
        src={championIconUrl(championName)}
        alt={championName}
        width={22}
        height={22}
        className="rounded-sm"
      />
      <div>
        <div className="font-display font-semibold text-lol-gold-50">
          {championName}
        </div>
        <div className="text-lol-text-muted">
          Banned {x.toFixed(1)}% · Win rate {y.toFixed(1)}%
        </div>
      </div>
    </div>
  );
}

/**
 * Two panels: a compact horizontal bar chart of how often each champion
 * gets banned, and a large scatterplot of ban rate (x) against the
 * summoner's win rate in the matches where that champion was NOT banned
 * (y) — https://nivo.rocks/scatterplot/. The scatterplot does the heavy
 * lifting here (correlation is easier to read from point placement than
 * from a scrolling list), so it gets most of the section's width; the bar
 * chart stays narrow and keeps its own scroll for the full champion list.
 */
const BannedChampions = ({ bannedChampions }: Props) => {
  // Ascending, matching KDA's champion chart — Nivo's horizontal bar layout
  // renders the last data item at the top, so ascending order here puts the
  // most-banned champion at the top of the (scrolled-to-top) chart.
  const sorted = [...bannedChampions.champions].sort(
    (a, b) => a.banRate - b.banRate,
  );

  const banRateData = sorted.map((champion) => ({
    champion: champion.championName,
    value: champion.banRate,
  }));

  const scatterData = [
    {
      id: "champions",
      // Champions banned in every tracked match have no "not banned"
      // matches to sample a win rate from (see
      // BannedChampionStats.winRateWhenNotBanned's doc comment) — excluded
      // here rather than plotted at a misleading 0.
      data: sorted
        .filter((champion) => champion.winRateWhenNotBanned != null)
        .map((champion) => ({
          x: champion.banRate,
          y: champion.winRateWhenNotBanned as number,
          championName: champion.championName,
        })),
    },
  ];

  const barChartHeight = Math.max(sorted.length * ROW_HEIGHT, MIN_CHART_HEIGHT);

  return (
    <CategorySection title="Banned Champions">
      <div className="flex h-[75vh] w-full max-w-6xl items-stretch gap-6">
        <div className="w-56 shrink-0 overflow-x-hidden overflow-y-auto">
          <div style={{ height: barChartHeight }}>
            <ResponsiveBar
              data={banRateData}
              keys={["value"]}
              indexBy="champion"
              layout="horizontal"
              margin={{ top: 10, right: 16, bottom: 10, left: 60 }}
              padding={0.3}
              valueFormat={(v) => `${v.toFixed(0)}%`}
              colors={["var(--color-lol-blue-300)"]}
              borderRadius={2}
              axisTop={null}
              axisBottom={null}
              axisLeft={{
                tickSize: 5,
                tickPadding: 5,
                renderTick: ChampionIconTick,
              }}
              enableGridY={false}
              theme={{
                text: { fill: "var(--color-lol-text-secondary)", fontSize: 11 },
                axis: {
                  ticks: { text: { fill: "var(--color-lol-text-muted)" } },
                },
                tooltip: {
                  container: {
                    background: "var(--color-lol-navy-900)",
                    color: "var(--color-lol-text)",
                  },
                },
              }}
            />
          </div>
        </div>

        <div className="w-px shrink-0 self-stretch bg-lol-border-muted" />

        <div className="min-w-0 flex-1">
          <ResponsiveScatterPlot
            data={scatterData}
            margin={{ top: 20, right: 30, bottom: 60, left: 70 }}
            xScale={{ type: "linear", min: 0, max: "auto" }}
            yScale={{ type: "linear", min: 40, max: 60 }}
            colors={["var(--color-lol-blue-300)"]}
            nodeSize={9}
            useMesh
            tooltip={ScatterTooltip}
            axisBottom={{
              tickSize: 5,
              tickPadding: 5,
              legend: "Ban rate (%)",
              legendPosition: "middle",
              legendOffset: 40,
            }}
            axisLeft={{
              tickSize: 5,
              tickPadding: 5,
              legend: "Win rate when not banned (%)",
              legendPosition: "middle",
              legendOffset: -55,
            }}
            theme={{
              text: { fill: "var(--color-lol-text-secondary)", fontSize: 12 },
              axis: {
                ticks: { text: { fill: "var(--color-lol-text-muted)" } },
                legend: { text: { fill: "var(--color-lol-text-secondary)" } },
              },
              grid: { line: { stroke: "var(--color-lol-border-muted)" } },
            }}
          />
        </div>
      </div>
    </CategorySection>
  );
};

export { BannedChampions };
