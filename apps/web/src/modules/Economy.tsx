"use client";

import { ResponsivePie } from "@nivo/pie";
import type { EconomyStats } from "@arena/types";
import { CategorySection } from "@/components/category-section";
import { StatGrid } from "@/components/stat-grid";

type Props = {
  economy: EconomyStats;
};

const ANVIL_COLORS = {
  stat: "var(--color-lol-blue-300)",
  legendary: "var(--color-lol-gold-300)",
  prismatic: "var(--color-lol-mythic)",
} as const;

const Economy = ({ economy }: Props) => {
  const anvilPieData = [
    { id: "Stat", value: economy.anvils.stat, color: ANVIL_COLORS.stat },
    { id: "Legendary", value: economy.anvils.legendary, color: ANVIL_COLORS.legendary },
    { id: "Prismatic", value: economy.anvils.prismatic, color: ANVIL_COLORS.prismatic },
  ];

  return (
    <CategorySection title="Economy">
      <div className="flex w-full max-w-4xl items-stretch gap-10">
        <StatGrid
          className="gap-x-8 gap-y-5"
          stats={[
            ["Total Gold Earned", economy.totalGoldEarned],
            ["Most Gold (1 Game)", economy.mostGoldInOneGame],
            ["Items Purchased", economy.itemsPurchased],
            ["Consumables Purchased", economy.consumablesPurchased],
          ]}
        />

        <div className="w-px shrink-0 self-stretch bg-lol-border-muted" />

        <div className="flex min-w-0 flex-1 flex-col items-center gap-2 py-2">
          <span className="text-sm text-lol-text-muted">Anvils Bought</span>
          <div className="h-96 min-h-0 w-full">
            <ResponsivePie
              data={anvilPieData}
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
              theme={{
                text: { fill: "var(--color-lol-text-secondary)", fontSize: 12 },
                labels: {
                  text: { fill: "var(--color-lol-navy-950)", fontSize: 11, fontWeight: 600 },
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
      </div>
    </CategorySection>
  );
};

export { Economy };
