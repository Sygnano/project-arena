"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { ResponsiveBar } from "@nivo/bar";
import { ResponsivePie } from "@nivo/pie";
import { AnimatedNumber } from "@/components/animated-number";
import { CategorySection } from "@/components/category-section";
import { ChampionIconTick } from "@/components/champion-icon-tick";
import { Button } from "@/components/ui/button";

type BreakdownCategory<TKey extends string> = {
  key: TKey;
  label: string;
  color: string;
};

type ChampionBreakdownEntry<TKey extends string> = {
  championId: number;
  championName: string;
  total: Record<TKey, number>;
  maxGame: Record<TKey, number>;
};

type Props<TKey extends string> = {
  /** CategorySection title, e.g. "Damage" or "Ability Casts". */
  categoryTitle: string;
  /** Label above the total-breakdown pie, e.g. "Total Damage". */
  totalLabel: string;
  /** Label above the best-single-game pie, e.g. "Max Damage (1 Game)". */
  maxGameLabel: string;
  categories: readonly BreakdownCategory<TKey>[];
  stats: { total: Record<TKey, number>; maxGame: Record<TKey, number> };
  champions: ChampionBreakdownEntry<TKey>[];
  /** Optional extra page-wide numbers shown above the chart, for a metric
   * that doesn't fit the category breakdown itself (e.g. skillshots hit
   * isn't a cast type, but belongs conceptually with ability-usage stats). */
  summaryStats?: readonly { label: string; value: number }[];
};

const ROW_HEIGHT = 26;
const MIN_CHART_HEIGHT = 200;

const PIE_THEME = {
  text: { fill: "var(--color-lol-text-secondary)", fontSize: 12 },
  labels: { text: { fill: "var(--color-lol-navy-950)", fontSize: 11, fontWeight: 600 } },
  tooltip: {
    container: {
      background: "var(--color-lol-navy-900)",
      color: "var(--color-lol-text)",
    },
  },
};

/**
 * Shared layout for any "champion stat breakdown" category: a compact
 * stacked horizontal bar chart (one key per category, champion icon as
 * label) on the left, and two pie charts sharing the rest of the width —
 * total composition and the breakdown of the single highest match. Both
 * pies default to the page-wide totals; clicking a bar swaps them to that
 * champion's own totals/best game instead (the X button clears the
 * selection back to the page-wide view). Generic over the breakdown's key
 * set so it fits damage (physical/magical/true), ability casts (q/w/e/r),
 * or any future category with the same "stacked total + best game" shape.
 */
function ChampionBreakdownPanel<TKey extends string>({
  categoryTitle,
  totalLabel,
  maxGameLabel,
  categories,
  stats,
  champions,
  summaryStats,
}: Props<TKey>) {
  const [selectedChampionId, setSelectedChampionId] = useState<number | null>(null);

  const colorByKey = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.key, c.color])) as Record<TKey, string>,
    [categories],
  );

  const barData = useMemo(
    () =>
      champions
        .map((champion) => ({
          champion: champion.championName,
          championId: champion.championId,
          ...champion.total,
        }))
        // Ascending, matching KDA/BannedChampions' champion charts — Nivo's
        // horizontal bar layout renders the last data item at the top.
        .sort((a, b) => {
          const totalA = categories.reduce((sum, c) => sum + a[c.key], 0);
          const totalB = categories.reduce((sum, c) => sum + b[c.key], 0);
          return totalA - totalB;
        }),
    [champions, categories],
  );

  const barChartHeight = Math.max(barData.length * ROW_HEIGHT, MIN_CHART_HEIGHT);

  const selectedChampion =
    selectedChampionId != null
      ? champions.find((champion) => champion.championId === selectedChampionId)
      : null;

  const toPieData = (breakdown: Record<TKey, number>) =>
    categories.map((c) => ({ id: c.label, value: breakdown[c.key], color: c.color }));

  const totalPieData = toPieData(selectedChampion ? selectedChampion.total : stats.total);
  const maxGamePieData = toPieData(selectedChampion ? selectedChampion.maxGame : stats.maxGame);
  const suffix = selectedChampion ? ` — ${selectedChampion.championName}` : "";

  return (
    <CategorySection title={categoryTitle}>
      <div className="relative flex h-[70vh] w-full max-w-6xl flex-col items-center gap-4">
        {selectedChampion && (
          <Button
            variant="outline"
            size="icon"
            aria-label={`Back to page-wide ${totalLabel.toLowerCase()}`}
            onClick={() => setSelectedChampionId(null)}
            className="absolute top-0 right-0 z-10"
          >
            <X />
          </Button>
        )}

        {summaryStats && summaryStats.length > 0 && (
          <div className="flex shrink-0 gap-12">
            {summaryStats.map((stat) => (
              <div key={stat.label} className="flex flex-col items-center gap-1">
                <span className="text-sm text-lol-text-muted">{stat.label}</span>
                <AnimatedNumber
                  value={stat.value}
                  className="font-display text-2xl font-semibold text-lol-gold-50"
                />
              </div>
            ))}
          </div>
        )}

        <div className="flex min-h-0 w-full flex-1 items-stretch gap-6">
          <div className="w-56 shrink-0 overflow-x-hidden overflow-y-auto">
            <div style={{ height: barChartHeight }}>
              <ResponsiveBar
                data={barData}
                keys={categories.map((c) => c.key)}
                indexBy="champion"
                layout="horizontal"
                margin={{ top: 10, right: 16, bottom: 10, left: 60 }}
                padding={0.3}
                colors={(d) => colorByKey[d.id as TKey]}
                borderRadius={2}
                enableLabel={false}
                axisTop={null}
                axisBottom={null}
                axisLeft={{
                  tickSize: 5,
                  tickPadding: 5,
                  renderTick: ChampionIconTick,
                }}
                enableGridY={false}
                onClick={(bar) => setSelectedChampionId(bar.data.championId as number)}
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

          <div className="flex min-w-0 flex-1 flex-col items-center gap-2 py-2">
            <span className="text-sm text-lol-text-muted">
              {totalLabel}
              {suffix}
            </span>
            <div className="min-h-0 w-full flex-1">
              <ResponsivePie
                data={totalPieData}
                colors={{ datum: "data.color" }}
                margin={{ top: 10, right: 60, bottom: 10, left: 60 }}
                innerRadius={0.5}
                padAngle={1}
                cornerRadius={2}
                activeOuterRadiusOffset={4}
                valueFormat={(v) => v.toLocaleString("en-US")}
                arcLabelsTextColor={{ theme: "labels.text.fill" }}
                arcLinkLabelsTextColor="var(--color-lol-text-secondary)"
                arcLinkLabelsColor={{ from: "color" }}
                theme={PIE_THEME}
              />
            </div>
          </div>

          <div className="w-px shrink-0 self-stretch bg-lol-border-muted" />

          <div className="flex min-w-0 flex-1 flex-col items-center gap-2 py-2">
            <span className="text-sm text-lol-text-muted">
              {maxGameLabel}
              {suffix}
            </span>
            <div className="min-h-0 w-full flex-1">
              <ResponsivePie
                data={maxGamePieData}
                colors={{ datum: "data.color" }}
                margin={{ top: 10, right: 60, bottom: 10, left: 60 }}
                innerRadius={0.5}
                padAngle={1}
                cornerRadius={2}
                activeOuterRadiusOffset={4}
                valueFormat={(v) => v.toLocaleString("en-US")}
                arcLabelsTextColor={{ theme: "labels.text.fill" }}
                arcLinkLabelsTextColor="var(--color-lol-text-secondary)"
                arcLinkLabelsColor={{ from: "color" }}
                theme={PIE_THEME}
              />
            </div>
          </div>
        </div>
      </div>
    </CategorySection>
  );
}

export { ChampionBreakdownPanel };
