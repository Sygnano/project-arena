import { ResponsiveBar } from "@nivo/bar";
import {
  GoldGradientDef,
  goldGradientFill,
  PrismaticGradientDef,
  prismaticGradientFill,
  SilverGradientDef,
  silverGradientFill,
} from "@/components/augment-gradients";
import type { PlacementChartDatum } from "./index";

type Props = {
  chartData: PlacementChartDatum[];
};

const PRISMATIC_GRADIENT_ID = "positions-chart-prismatic-fill";
const GOLD_GRADIENT_ID = "positions-chart-gold-fill";
const SILVER_GRADIENT_ID = "positions-chart-silver-fill";

// 1st place gets the animated Prismatic fill, 2nd-3rd (the other "top3"
// placements) get Gold, the rest get Silver — reusing the same augment
// rarity tokens/technique as the augment icon borders (globals.css /
// Augments.tsx) rather than inventing a second color system.
function barColor(bar: { data: PlacementChartDatum }): string {
  const { order } = bar.data;
  if (order === 1) return prismaticGradientFill(PRISMATIC_GRADIENT_ID);
  if (order === 2 || order === 3) return goldGradientFill(GOLD_GRADIENT_ID);
  return silverGradientFill(SILVER_GRADIENT_ID);
}

const PositionsChart = ({ chartData }: Props) => {
  if (chartData.length === 0) {
    return null;
  }

  return (
    <div className="h-full w-[50%] flex justify-center">
      {/* Referenced by `barColor` above — SVG gradient defs are addressable
       * by id from anywhere in the document, so these don't need to live
       * inside nivo's own <svg>. At most 3 bars ever use these (unlike the
       * 57 simultaneous augment icons), so none of them need the same
       * repaint-at-scale workaround documented on `.augment-frame-prismatic`
       * in globals.css. */}
      <PrismaticGradientDef id={PRISMATIC_GRADIENT_ID} />
      <GoldGradientDef id={GOLD_GRADIENT_ID} glow />
      <SilverGradientDef id={SILVER_GRADIENT_ID} glow />
      <ResponsiveBar
        data={chartData}
        keys={["count"]}
        indexBy="placement"
        margin={{ top: 10, right: 20, bottom: 40, left: 50 }}
        padding={0.4}
        colors={barColor}
        borderRadius={2}
        enableGridY={false}
        axisLeft={null}
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
  );
};

export { PositionsChart };
