"use client";

import { ResponsiveBar } from "@nivo/bar";
import type { PingsStats } from "@arena/types";
import { CategorySection } from "@/components/category-section";
import { RecordColumn } from "@/components/record-column";

type Props = {
  pings: PingsStats;
  totalFistBumps: number;
  totalPings: number;
  totalSkillshotsDodged: number;
};

/** "allIn" -> "All In", "onMyWay" -> "On My Way", etc. — Riot's 14 ping
 * counters are already meaningful camelCase, no lookup table needed. */
function humanize(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

/** Horizontal bar chart of every ping type, summed across every tracked
 * match — no champion dimension (pings aren't a champion-specific stat),
 * sorted so the most-used ping type is at the top. */
const Pings = ({
  pings,
  totalFistBumps,
  totalPings,
  totalSkillshotsDodged,
}: Props) => {
  const chartData = Object.entries(pings.pings)
    .map(([type, count]) => ({ type: humanize(type), count }))
    // Ascending — Nivo's horizontal bar layout renders the last data item
    // at the top, same convention as the champion breakdown charts.
    .sort((a, b) => a.count - b.count);

  return (
    <CategorySection title="Pings">
      <div className="h-[32rem] w-full max-w-2xl">
        <ResponsiveBar
          data={chartData}
          keys={["count"]}
          indexBy="type"
          layout="horizontal"
          margin={{ top: 10, right: 20, bottom: 10, left: 110 }}
          padding={0.3}
          colors={["var(--color-lol-blue-300)"]}
          borderRadius={2}
          axisTop={null}
          axisBottom={null}
          axisLeft={{ tickSize: 5, tickPadding: 5 }}
          enableGridY={false}
          theme={{
            text: { fill: "var(--color-lol-text-secondary)", fontSize: 12 },
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

      <div
        className="flex justify-center pt-6"
        style={{ borderTop: "1px solid rgba(200,170,110,.28)" }}
      >
        <RecordColumn
          heading="FOR THE RECORD"
          headingColor="var(--color-lol-blue-300)"
          rows={[
            ["FIST BUMPS", totalFistBumps],
            ["PINGS", totalPings],
            ["SKILLSHOTS DODGED", totalSkillshotsDodged],
          ]}
        />
      </div>
    </CategorySection>
  );
};

export { Pings };
