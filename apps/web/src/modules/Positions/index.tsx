"use client";

import { AnimatedNumber } from "@/components/animated-number";

import type { PlacementStats } from "@arena/types";
import { CategorySection } from "@/components/category-section";
import { CarouselItem } from "@/components/ui/carousel";
import {
  CategoryLayout,
  SidebarHeadline,
  SidebarStatGrid,
} from "@/components/layout";
import { PositionsChart } from "./Chart";
import { PositionsFunnel } from "./Funnel";

type Props = {
  gamesPlayed: number;
  placements: PlacementStats;
};

export type PlacementChartDatum = {
  placement: string;
  order: number;
  count: number;
};

function ordinal(n: number): string {
  const remainder = n % 100;
  if (remainder >= 11 && remainder <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** Vertical bar chart of how many tracked matches finished at each
 * placement. Built from whatever placements are actually present in
 * `byPlacement` rather than a hardcoded 1..6 range — Arena's team count (and
 * therefore its range of possible placements) has changed before, see
 * CLAUDE.md §2. */
const Positions = ({ placements, gamesPlayed }: Props) => {
  const chartData: PlacementChartDatum[] = Object.entries(
    placements.byPlacement,
  )
    .map(([placement, count]) => ({
      placement: ordinal(Number(placement)),
      order: Number(placement),
      count,
    }))
    .sort((a, b) => a.order - b.order);

  const top1Rate =
    gamesPlayed > 0 ? (placements.top1Finishes / gamesPlayed) * 100 : 0;
  const top3Rate =
    gamesPlayed > 0 ? (placements.top3Finishes / gamesPlayed) * 100 : 0;

  return (
    <CategorySection
      title="Placement Distribution"
      quote="If you're not first, you're last."
    >
      <CategoryLayout
        sidebar={
          <>
            <SidebarHeadline label="Games Played">
              <AnimatedNumber
                value={gamesPlayed}
                className="font-display text-6xl font-semibold text-lol-gold-50"
              />
            </SidebarHeadline>

            <SidebarStatGrid>
              <span className="font-body text-sm text-lol-text-muted">
                Top 1s
              </span>
              <div className="flex items-baseline justify-self-end gap-1">
                <AnimatedNumber
                  value={top1Rate}
                  decimals={1}
                  className="font-display text-2xl font-semibold text-lol-gold-50"
                />
                <span>%</span>
              </div>

              <span className="font-body text-sm text-lol-text-muted">
                Top 3s
              </span>
              <div className="flex items-baseline justify-self-end gap-1">
                <AnimatedNumber
                  value={top3Rate}
                  decimals={1}
                  className="font-display text-2xl font-semibold text-lol-gold-50"
                />
                <span>%</span>
              </div>

              <span className="font-body text-sm text-lol-text-muted">
                Longest Winstreak
              </span>
              <div className="flex items-baseline justify-self-end gap-1">
                <AnimatedNumber
                  value={placements.longestWinStreak}
                  className="font-display text-2xl font-semibold text-lol-gold-50"
                />
                <span>games</span>
              </div>

              <span className="font-body text-sm text-lol-text-muted">
                Longest Top1 Streak
              </span>
              <div className="flex items-baseline justify-self-end gap-1">
                <AnimatedNumber
                  value={placements.longestTop1Streak}
                  className="font-display text-2xl font-semibold text-lol-gold-50"
                />
                <span>games</span>
              </div>
            </SidebarStatGrid>
          </>
        }
      >
        <CarouselItem className="h-full">
          <PositionsChart chartData={chartData} />
        </CarouselItem>
        <CarouselItem className="h-full">
          <PositionsFunnel data={chartData} />
        </CarouselItem>
      </CategoryLayout>
    </CategorySection>
  );
};

export { Positions };
