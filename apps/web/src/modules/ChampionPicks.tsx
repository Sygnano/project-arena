"use client";

import { ResponsiveBar } from "@nivo/bar";
import type { ChampionPicksStats } from "@arena/types";
import { CategorySection } from "@/components/category-section";
import { championIconUrl } from "@/lib/riot";
import {
  GoldGradientDef,
  goldGradientFill,
  PrismaticGradientDef,
  prismaticGradientFill,
  SilverGradientDef,
  silverGradientFill,
} from "@/components/augment-gradients";

type Props = {
  championPicks: ChampionPicksStats;
};

const CHAMPION_ICON_SIZE = 36;
// Floor on each bar's own width (icon + breathing room either side) — once
// enough champions are played that this times the champion count would
// exceed the section's actual width, the outer div scrolls horizontally
// instead of letting nivo squeeze every bar down to illegibility.
const MIN_BAR_WIDTH = 56;

const PRISMATIC_GRADIENT_ID = "champion-picks-prismatic-fill";
const GOLD_GRADIENT_ID = "champion-picks-gold-fill";
const SILVER_GRADIENT_ID = "champion-picks-silver-fill";

// Same augment-rarity mapping as TeamSlot's own stack — 1st place gets the
// animated Prismatic fill, 2nd-3rd get static Gold, the rest get static
// Silver. Keyed by `bar.id` (the stack key, e.g. "1st"), not champion data.
function stackColor(bar: { id: string | number }): string {
  if (bar.id === "1st") return prismaticGradientFill(PRISMATIC_GRADIENT_ID);
  if (bar.id === "2nd-3rd") return goldGradientFill(GOLD_GRADIENT_ID);
  return silverGradientFill(SILVER_GRADIENT_ID);
}

/** Custom x-axis tick: the champion's icon instead of plain text. Same
 * positioning as TeamSlot's own `renderTeamAxisTick`, minus the text
 * fallback — every bar here is a real, already-picked champion, always
 * resolvable via `championIconUrl`. */
function renderChampionAxisTick({
  value,
  x,
  y,
  textX,
  textY,
  lineX,
  lineY,
  opacity,
}: {
  value: string;
  x: number;
  y: number;
  textX: number;
  textY: number;
  lineX: number;
  lineY: number;
  opacity?: number;
}) {
  return (
    <g transform={`translate(${x},${y})`} style={{ opacity }}>
      <line
        x1={0}
        x2={lineX}
        y1={0}
        y2={lineY}
        stroke="var(--color-lol-border-muted)"
      />
      <image
        href={championIconUrl(value)}
        x={textX - CHAMPION_ICON_SIZE / 2}
        y={textY}
        width={CHAMPION_ICON_SIZE}
        height={CHAMPION_ICON_SIZE}
      >
        <title>{value}</title>
      </image>
    </g>
  );
}

/**
 * Stacked vertical bar chart, one bar per champion the summoner has ever
 * picked, sorted by total picks descending (most-picked on the left — the
 * API already returns `championPicks.champions` in that order). Each bar
 * stacks 1st-place finishes, 2nd-3rd finishes, and everything lower, same
 * shape and gradient treatment as TeamSlot's own stack.
 */
const ChampionPicks = ({ championPicks }: Props) => {
  const chartData = championPicks.champions.map((row) => ({
    championName: row.championName,
    "1st": row.top1,
    "2nd-3rd": row.top3ExclTop1,
    Remaining: row.remaining,
  }));
  const chartInnerWidth = chartData.length * MIN_BAR_WIDTH;

  return (
    <CategorySection
      title="Champion Picks"
      quote="Pick your poison."
    >
      {/* Outer div is the scroll viewport (capped to the section's actual
        width); inner div is sized so every bar gets at least MIN_BAR_WIDTH,
        same technique as KDA's KillChart but on the horizontal axis. */}
      <div className="h-full w-full overflow-x-auto overflow-y-hidden">
        <div className="h-full" style={{ minWidth: chartInnerWidth }}>
          {/* See TeamSlot's own copy of this comment for why these need a
           * unique id per chart rather than a shared default. */}
          <PrismaticGradientDef id={PRISMATIC_GRADIENT_ID} />
          <GoldGradientDef id={GOLD_GRADIENT_ID} />
          <SilverGradientDef id={SILVER_GRADIENT_ID} />
          <ResponsiveBar
            enableTotals={true}
            data={chartData}
            // nivo stacks vertical bars bottom-up in `keys` order, so
            // "Remaining" (4th-6th) goes first/bottom and "1st" goes
            // last/top.
            keys={["Remaining", "2nd-3rd", "1st"]}
            indexBy="championName"
            groupMode="stacked"
            margin={{ top: 40, right: 20, bottom: CHAMPION_ICON_SIZE + 25, left: 50 }}
            padding={0.3}
            colors={stackColor}
            axisLeft={null}
            borderRadius={2}
            axisBottom={{
              tickSize: 5,
              tickPadding: 5,
              renderTick: renderChampionAxisTick,
            }}
            enableGridY={false}
            theme={{
              text: { fill: "var(--color-lol-text-secondary)", fontSize: 12 },
              axis: {
                ticks: { text: { fill: "var(--color-lol-text-muted)" } },
                legend: { text: { fill: "var(--color-lol-text-secondary)" } },
              },
              grid: { line: { stroke: "var(--color-lol-border-muted)" } },
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
    </CategorySection>
  );
};

export { ChampionPicks };
