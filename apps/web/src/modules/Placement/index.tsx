"use client";

import { useMemo } from "react";
import type { PlacementDetail, PlacementStats } from "@arena/types";
import { CategorySection } from "@/components/category-section";
import { HextechPanel } from "@/components/hextech-panel";
import { HextechBarChart, type BarColumn } from "@/components/hextech-bar-chart";
import { useChartHover } from "@/hooks/use-chart-hover";
import { CursorTooltip } from "@/components/cursor-tooltip";
import { HoverCardRows, HoverCardSection, HoverStatCard } from "@/components/hover-stat-card";
import { FadingRule } from "@/components/fading-rule";
import { Dial } from "@/components/dial";
import { SidebarStatRows } from "@/components/sidebar-stat-row";
import { TIER_STYLE, type Tier } from "@/lib/tier-bars";
import { formatCompact, formatDuration, ordinal } from "@/lib/format";
import { championIconUrl } from "@/lib/riot";
import { useChampionName } from "@/lib/champion-names";
import { SECTION_BACKGROUNDS } from "@/lib/section-backgrounds";

type Props = {
  gamesPlayed: number;
  placements: PlacementStats;
};

const BAR_MAX_HEIGHT = 330;
const COLUMN_WIDTH = 108;
const COLUMN_GAP = 48;

function placementTier(placement: number): Tier {
  if (placement === 1) return "prismatic";
  if (placement <= 3) return "gold";
  return "silver";
}

function PlacementCard({
  placement,
  count,
  totalGames,
  cumulative,
  detail,
}: {
  placement: number;
  count: number;
  totalGames: number;
  cumulative: number;
  detail: PlacementDetail | undefined;
}) {
  const championName = useChampionName();
  const tier = TIER_STYLE[placementTier(placement)];
  const share = totalGames > 0 ? (count / totalGames) * 100 : 0;
  const orBetter = totalGames > 0 ? (cumulative / totalGames) * 100 : 0;
  const rows = detail
    ? [
        { label: "GAME LENGTH", value: formatDuration(detail.avgGameSeconds) },
        { label: "KDA", value: detail.kda.toFixed(2) },
        { label: "DAMAGE", value: formatCompact(detail.avgDamage) },
        { label: "AUGMENTS", value: detail.avgAugments.toFixed(1) },
      ]
    : [];

  return (
    <HoverStatCard
      title={`${ordinal(placement).toUpperCase()} PLACE`}
      meta={`${count.toLocaleString()} game${count === 1 ? "" : "s"}`}
      subtitle={`${share.toFixed(0)}% of games${placement > 1 ? ` · ${orBetter.toFixed(0)}% ${ordinal(placement)} or better` : ""}`}
      edgeColor={tier.edge}
    >
      {detail ? (
        <>
          <HoverCardSection label="AVERAGE GAME">
            <HoverCardRows rows={rows} />
          </HoverCardSection>
          {detail.topChampion ? (
            <HoverCardSection>
              <div className="flex items-center gap-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={championIconUrl(detail.topChampion.championName)}
                  alt=""
                  className="size-8 border border-[rgba(200,170,110,.4)]"
                />
                <div className="min-w-0">
                  <div className="text-[10px] tracking-[.22em] text-lol-text-muted">
                    MOST OFTEN {ordinal(placement).toUpperCase()}
                  </div>
                  <div className="truncate font-display text-lol-gold-50">
                    {championName(detail.topChampion.championName)}
                  </div>
                  <div className="text-lol-text-muted">
                    {detail.topChampion.games} of {detail.topChampion.totalGames} games ·{" "}
                    {Math.round((detail.topChampion.games / detail.topChampion.totalGames) * 100)}%
                  </div>
                </div>
              </div>
            </HoverCardSection>
          ) : null}
        </>
      ) : null}
    </HoverStatCard>
  );
}

/**
 * Placement distribution — merges the repo's old two-slide carousel (a bar
 * chart, then a separate cumulative funnel) into one figure: the bars are
 * each placement's own count. Built from whichever placements are actually
 * present in `byPlacement` rather than a hardcoded 1..8 — Arena's team count
 * (and therefore its range of possible placements) has changed before, see
 * CLAUDE.md §2.
 */
const Placement = ({ gamesPlayed, placements }: Props) => {
  const ranked = useMemo(
    () =>
      Object.entries(placements.byPlacement)
        .map(([placement, count]) => ({ order: Number(placement), count }))
        .sort((a, b) => a.order - b.order),
    [placements],
  );

  const maxCount = Math.max(1, ...ranked.map((row) => row.count));

  const totalGames = ranked.reduce((sum, row) => sum + row.count, 0);

  const { hover, onHover, containerRef: chartRef } = useChartHover<number>();
  const hovered = hover ? ranked.find((row) => row.order === hover.id) : undefined;
  const hoveredCumulative = hovered
    ? ranked.filter((row) => row.order <= hovered.order).reduce((sum, row) => sum + row.count, 0)
    : 0;

  const columns: BarColumn[] = ranked.map((row) => {
    // By placement NUMBER, not column index: 1st is always prismatic, 2nd-3rd
    // gold, the rest silver — even for a summoner with no 1st places yet
    // (index-based tiering used to paint their 2nd-place bar prismatic).
    const tier = TIER_STYLE[placementTier(row.order)];
    const height = Math.max(2, Math.round((row.count / maxCount) * BAR_MAX_HEIGHT));
    return {
      id: row.order,
      ariaLabel: `${ordinal(row.order)} place, ${row.count} games`,
      topLabel: `${row.count.toLocaleString()} · ${totalGames > 0 ? Math.round((row.count / totalGames) * 100) : 0}%`,
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
      imageUrl={SECTION_BACKGROUNDS.positions}
      sidebar={
        <>
          <Dial
            value={placements.avgPlacement}
            label="AVG PLACEMENT"
            formatValue={(v) => (gamesPlayed > 0 ? v.toFixed(2) : "—")}
          />

          <div className="mt-auto">
            <SidebarStatRows
              rows={[
                { label: "GAMES", value: gamesPlayed.toLocaleString() },
                { label: "WINRATE", value: `${winRate.toFixed(0)}%` },
                { label: "1ST RATE", value: `${top1Rate.toFixed(0)}%` },
                {
                  label: "BEST WIN STREAK",
                  value: placements.longestWinStreak.toLocaleString(),
                },
                {
                  label: "BEST 1ST STREAK",
                  value: placements.longestTop1Streak.toLocaleString(),
                },
              ]}
            />
          </div>
        </>
      }
    >
      <HextechPanel>
        <div className="mb-3.5 flex flex-wrap items-center gap-x-6 gap-y-3">
          <FadingRule />
          <div className="text-[11px] tracking-[.28em] text-lol-text-muted">MATCHES BY FINISHING PLACE</div>
        </div>

        {ranked.length === 0 ? (
          <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-lol-text-muted">
            No tracked matches yet.
          </div>
        ) : (
          <div ref={chartRef} className="flex min-h-0 min-w-0 w-full flex-1 flex-col">
            <HextechBarChart
              columns={columns}
              center
              columnWidth={COLUMN_WIDTH}
              gap={COLUMN_GAP}
              topLabelColor={() => "var(--color-lol-text-secondary)"}
              onHover={onHover}
              highlightedId={hover?.id ?? null}
            />
          </div>
        )}
        <CursorTooltip point={hovered ? hover!.point : null}>
          {hovered ? (
            <PlacementCard
              placement={hovered.order}
              count={hovered.count}
              totalGames={totalGames}
              cumulative={hoveredCumulative}
              detail={placements.detailsByPlacement?.[hovered.order]}
            />
          ) : null}
        </CursorTooltip>
      </HextechPanel>
    </CategorySection>
  );
};

export { Placement };
