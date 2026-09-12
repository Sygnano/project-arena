"use client";

import { useMemo } from "react";
import type { PlacementStats } from "@arena/types";
import { CategorySection } from "@/components/category-section";
import { HextechPanel } from "@/components/hextech-panel";
import {
  HextechBarChart,
  type BarColumn,
} from "@/components/hextech-bar-chart";
import { FadingRule } from "@/components/fading-rule";
import { Dial } from "@/components/dial";
import { SidebarStatRows } from "@/components/sidebar-stat-row";
import { TIER_STYLE, tierForRank } from "@/lib/tier-bars";
import { ordinal } from "@/lib/format";

type Props = {
  gamesPlayed: number;
  placements: PlacementStats;
  nextSectionLabel?: string;
};

const BAR_MAX_HEIGHT = 330;
const COLUMN_WIDTH = 108;
const COLUMN_GAP = 48;

/**
 * Placement distribution — merges the repo's old two-slide carousel (a bar
 * chart, then a separate cumulative funnel) into one figure: the bars are
 * each placement's own count. Built from whichever placements are actually
 * present in `byPlacement` rather than a hardcoded 1..8 — Arena's team count
 * (and therefore its range of possible placements) has changed before, see
 * CLAUDE.md §2.
 */
const Positions = ({
  gamesPlayed,
  placements,
  nextSectionLabel = "TIME",
}: Props) => {
  const ranked = useMemo(
    () =>
      Object.entries(placements.byPlacement)
        .map(([placement, count]) => ({ order: Number(placement), count }))
        .sort((a, b) => a.order - b.order),
    [placements],
  );

  const maxCount = Math.max(1, ...ranked.map((row) => row.count));

  const columns: BarColumn[] = ranked.map((row, index) => {
    const tier = TIER_STYLE[tierForRank(index)];
    const height = Math.max(
      2,
      Math.round((row.count / maxCount) * BAR_MAX_HEIGHT),
    );
    return {
      id: row.order,
      topLabel: row.count.toLocaleString(),
      segments: [
        {
          key: "count",
          height,
          fillClassName: tier.fillClass,
          borderColor: tier.edge,
          boxShadow: tier.glow,
        },
      ],
      icon: (
        // The rotated diamond needs an un-rotated outer box bigger than its
        // own footprint to show fully — `HextechBarChart`'s icon slot
        // shrink-wraps (with `overflow-hidden`) to whatever `icon` measures
        // BEFORE the `rotate-45` transform is applied (a transform doesn't
        // change layout size), so wrapping the diamond directly in that slot
        // at its own 50px size clips its rotated tips down to just 4 corner
        // brackets. This outer box (76px, comfortably past the diamond's
        // ~70.7px rotated diagonal) gives the diamond room to render whole.
        <div className="flex h-19 w-19 items-center justify-center">
          <div
            className="flex h-12.5 w-12.5 rotate-45 items-center justify-center border"
            style={{
              borderColor: tier.edge,
              boxShadow: tier.glow,
              background: "rgba(5,14,22,.75)",
            }}
          >
            <div className="font-display -rotate-45 text-[15px] tracking-[.04em] text-lol-gold-50">
              {ordinal(row.order)}
            </div>
          </div>
        </div>
      ),
    };
  });

  const top1Rate = gamesPlayed > 0 ? (placements.top1Finishes / gamesPlayed) * 100 : 0;
  const winRate = gamesPlayed > 0 ? (placements.top3Finishes / gamesPlayed) * 100 : 0;

  return (
    <CategorySection
      title="PLACEMENT"
      quote="If you're not first, you're last."
      imageUrl="/images/kda-bg.jpg"
      nextSectionLabel={nextSectionLabel}
      sidebar={
        <>
          <Dial
            value={gamesPlayed}
            label="GAMES PLAYED"
            formatValue={(v) => Math.round(v).toLocaleString()}
          />

          <div className="mt-auto">
            <SidebarStatRows
              rows={[
                { label: "TOP 1 %", value: `${top1Rate.toFixed(0)}%` },
                { label: "WINRATE %", value: `${winRate.toFixed(0)}%` },
                {
                  label: "TOP 1 STREAK",
                  value: placements.longestTop1Streak.toLocaleString(),
                },
                {
                  label: "WINRATE STREAK",
                  value: placements.longestWinStreak.toLocaleString(),
                },
              ]}
            />
          </div>
        </>
      }
    >
      <HextechPanel>
        <div className="mb-3.5 flex items-center gap-6">
          <FadingRule />
          <div className="text-[11px] tracking-[.28em] text-lol-text-muted">
            MATCHES BY FINISHING PLACE
          </div>
        </div>

        {ranked.length === 0 ? (
          <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-lol-text-muted">
            No tracked matches yet.
          </div>
        ) : (
          <HextechBarChart
            columns={columns}
            center
            columnWidth={COLUMN_WIDTH}
            gap={COLUMN_GAP}
            topLabelColor={() => "var(--color-lol-text-secondary)"}
          />
        )}
      </HextechPanel>
    </CategorySection>
  );
};

export { Positions };
