import { ResponsiveBar } from "@nivo/bar";
import { ChampionIconTick } from "@/components/champion-icon-tick";
import { STAT_COLOR, type KdaChartDatum, type Stat } from "./index";

type Props = {
  /** Header above this chart, e.g. "Total" or "Best" — the two charts a KDA
   * carousel slide renders side by side for the same `stat`. */
  title: string;
  chartData: KdaChartDatum[];
  chartInnerHeight: number;
  stat: Stat;
};

const KillChart = ({ title, chartData, chartInnerHeight, stat }: Props) => {
  return (
    <div className="flex h-full min-w-0 flex-1 flex-col gap-2">
      <div className="text-center font-body text-sm tracking-wide text-lol-text-muted uppercase">
        {title}
      </div>
      {/* Outer div is the scroll viewport (capped height); inner div is
        sized to fit every bar at ROW_HEIGHT so none get squeezed. */}
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
        <div style={{ height: chartInnerHeight }}>
          <ResponsiveBar
            data={chartData}
            keys={["value"]}
            indexBy="stat"
            layout="horizontal"
            margin={{ top: 10, right: 20, bottom: 10, left: 70 }}
            padding={0.25}
            valueFormat={stat === "kda" ? (v) => v.toFixed(2) : undefined}
            colors={[STAT_COLOR[stat]]}
            borderRadius={2}
            axisBottom={null}
            axisLeft={{
              tickSize: 5,
              tickPadding: 5,
              renderTick: ChampionIconTick,
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
    </div>
  );
};

export { KillChart };
