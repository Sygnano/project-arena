"use client";

import { useMemo, useState } from "react";
import type { ChampionPickBreakdown, ChampionPicksStats, ChampionStats } from "@arena/types";
import { CategorySection } from "@/components/category-section";
import { HextechPanel } from "@/components/hextech-panel";
import { HextechBarChart, type BarColumn } from "@/components/hextech-bar-chart";
import { RingFrame } from "@/components/dial";
import { DiamondTabs } from "@/components/diamond-tabs";
import { PanelToolbar } from "@/components/panel-toolbar";
import { LowSampleSwitch } from "@/components/low-sample-switch";
import { SidebarStatRows } from "@/components/sidebar-stat-row";
import { TIER_STYLE } from "@/lib/tier-bars";
import { championIconUrl } from "@/lib/riot";
import { barHeight } from "@/lib/bar-scale";
import { useChampionName } from "@/lib/champion-names";
import { DossierLink } from "@/lib/champion-dossier";
import { CursorTooltip } from "@/components/cursor-tooltip";
import { HoverCardRows, HoverCardSection, HoverStatCard } from "@/components/hover-stat-card";
import { formatCompact, formatDuration } from "@/lib/format";
import { useChartHover } from "@/hooks/use-chart-hover";
import { SECTION_BACKGROUNDS } from "@/lib/section-backgrounds";
import { MIN_SAMPLE, isLowSample, sortByRate } from "@/lib/sample";

type Props = {
  championPicks: ChampionPicksStats;
  /** Per-champion combat totals, for the hover card. */
  champions: Record<number, ChampionStats>;
};

type SortMode = "picks" | "top3" | "rate";

// Percentages of the chart's own bar track (`HextechBarChart`'s
// `heightUnit="percent"`), not px — the leader bar is deliberately capped
// below 100% rather than always touching the track's top edge, leaving
// headroom above the tallest column.
const BAR_MAX_HEIGHT = 70;
const BAR_MIN_HEIGHT = 5;

/**
 * The design's middle stack segment (`top3ExclTop1`, 2nd-3rd place — see
 * `ChampionPickBreakdown`) is labeled "TOP 4" in the original prototype's
 * legend/sidebar text, a leftover from an earlier Arena team-size era (see
 * CLAUDE.md §2 on why team size — and therefore what "top 4" even means —
 * isn't stable). Relabeled to "WINRATE" here to match what the field actually
 * counts and stay consistent with `PlacementStats.top3Finishes`'s "win"
 * definition used everywhere else in the app; no data or layout changed.
 */
const TOP3_RATE_COLOR = "#e0b563";
const FIRST_RATE_COLOR = "var(--color-augment-prismatic)";

const SORT_NOUN: Record<SortMode, string> = {
  picks: "BY PICKS",
  top3: "BY WINRATE",
  rate: "BY 1ST RATE",
};

function rankLabel(rank: number, total: number, sort: SortMode): string {
  return `#${rank} OF ${total} ${SORT_NOUN[sort]}`;
}

/** Share of a champion's games that count toward the active rate sort. */
function championRate(row: ChampionPickBreakdown, sort: Exclude<SortMode, "picks">): number {
  const hits = sort === "top3" ? row.top1 + row.top3ExclTop1 : row.top1;
  return row.timesPicked > 0 ? hits / row.timesPicked : 0;
}

/**
 * Ranks champions by the active sort mode. Bar HEIGHT follows the sort: total
 * picks under "BY PICKS", the rate itself under the two rate sorts.
 */
function sortChampions(rows: ChampionPickBreakdown[], sort: SortMode, mixLowSample = false): ChampionPickBreakdown[] {
  if (sort === "picks") return [...rows].sort((a, b) => b.timesPicked - a.timesPicked);
  // Rates only rank rows with enough games; the rest follow, dimmed (see
  // lib/sample.ts). A 1-for-1 pick used to top "BY 1ST RATE" at 100%.
  return sortByRate(
    rows,
    (row) => championRate(row, sort),
    (row) => row.timesPicked,
    "desc",
    mixLowSample ? "mixed" : "after",
  );
}

/** Hover card for one Picks column: the champion's name (the chart shows only
 * an icon) and its average COMBAT line. Complements the sidebar, which
 * carries the results for whichever champion is pinned. */
function PicksHoverCard({
  pick,
  stats,
  rank,
  total,
  sortNoun,
}: {
  pick: ChampionPickBreakdown;
  stats: ChampionStats | undefined;
  rank: number;
  total: number;
  sortNoun: string;
}) {
  const displayName = useChampionName();
  const games = pick.timesPicked;
  const perGame = (value: number) => (games > 0 ? value / games : 0);
  const kda = stats?.kda;
  const damage = stats ? stats.damage.total.physical + stats.damage.total.magical + stats.damage.total.trueDamage : 0;
  return (
    <HoverStatCard
      title={
        <span className="flex items-center gap-2.5">
          <img
            src={championIconUrl(pick.championName)}
            alt=""
            className="size-8 flex-none border border-[rgba(200,170,110,.4)]"
          />
          {displayName(pick.championName)}
        </span>
      }
      meta={`${games.toLocaleString()} game${games === 1 ? "" : "s"}`}
      subtitle={
        <span className="mt-1.5 block">
          #{rank} of {total} {sortNoun.toLowerCase()}
          {isLowSample(games) ? " · few games" : ""}
        </span>
      }
    >
      {kda && stats ? (
        <HoverCardSection label="AVERAGE GAME">
          <HoverCardRows
            rows={[
              {
                label: "K / D / A",
                value: `${perGame(kda.totalKills).toFixed(1)} / ${perGame(kda.totalDeaths).toFixed(1)} / ${perGame(kda.totalAssists).toFixed(1)}`,
              },
              {
                label: "KDA",
                value: ((kda.totalKills + kda.totalAssists) / Math.max(1, kda.totalDeaths)).toFixed(2),
              },
              { label: "DAMAGE", value: formatCompact(perGame(damage)) },
              { label: "GAME LENGTH", value: formatDuration(perGame(stats.timePlayedSeconds)) },
            ]}
          />
        </HoverCardSection>
      ) : null}
      <div className="mt-2.5 text-[10px] tracking-[.2em] text-lol-text-muted/70">CLICK TO PIN IN THE SIDEBAR</div>
    </HoverStatCard>
  );
}

const ChampionPicks = ({ championPicks, champions: championStats }: Props) => {
  const [sort, setSort] = useState<SortMode>("picks");
  // Rate sorts: rank rows under MIN_SAMPLE with the rest (still dimmed).
  const [mixLowSample, setMixLowSample] = useState(false);
  const champions = championPicks.champions;

  const sorted = useMemo(() => sortChampions(champions, sort, mixLowSample), [champions, sort, mixLowSample]);

  const [selectedChampionId, setSelectedChampionId] = useState<number | null>(() => sorted[0]?.championId ?? null);

  const maxPicks = Math.max(1, ...champions.map((c) => c.timesPicked));
  // Rate sorts scale against the best rate among rows with enough games, so a
  // 1-for-1 outlier can't flatten every real bar; mixed in, every row counts
  // (see lib/sample.ts). Outliers above the max clamp to the leader's height.
  const maxRate =
    sort === "picks"
      ? 0
      : Math.max(
          0,
          ...champions.filter((c) => mixLowSample || !isLowSample(c.timesPicked)).map((c) => championRate(c, sort)),
        );

  const displayName = useChampionName();
  const selected = sorted.find((c) => c.championId === selectedChampionId) ?? sorted[0] ?? null;
  const selectedRank = selected ? sorted.findIndex((c) => c.championId === selected.championId) + 1 : 0;

  const { hover, onHover, containerRef: hoverRef } = useChartHover<number>();
  const hoveredIndex = hover ? sorted.findIndex((c) => c.championId === hover.id) : -1;
  const hovered = hoveredIndex === -1 ? null : sorted[hoveredIndex];

  const columns: BarColumn[] = sorted.map((champion) => {
    const isSelected = champion.championId === selected?.championId;

    // Under a rate sort the stack holds only the placements that count toward
    // that rate (1st + 2nd-3rd for WINRATE, 1st for 1ST RATE), so its height
    // is the rate itself.
    const stack = (
      [
        ["1st", champion.top1, TIER_STYLE.prismatic],
        ["top3", champion.top3ExclTop1, TIER_STYLE.gold],
        ["rest", champion.remaining, TIER_STYLE.silver],
      ] as const
    ).filter(([key]) => sort === "picks" || key === "1st" || (sort === "top3" && key === "top3"));
    const stackCount = stack.reduce((sum, [, value]) => sum + value, 0);
    const total =
      sort === "picks"
        ? barHeight(champion.timesPicked, maxPicks, BAR_MAX_HEIGHT, BAR_MIN_HEIGHT)
        : barHeight(championRate(champion, sort), maxRate, BAR_MAX_HEIGHT, BAR_MIN_HEIGHT);

    // Segment heights are proportional shares of `total` (not independently
    // scaled), so a champion's stack always sums back to its own bar total.
    const scale = stackCount > 0 ? total / stackCount : 0;
    const segments = stack.map(([key, value, tier]) => ({
      key,
      height: key === "1st" ? Math.max(value > 0 ? 1 : 0, value * scale) : value * scale,
      label: value > 0 ? String(value) : undefined,
      fillClassName: tier.fillClass,
      borderColor: tier.edge,
      boxShadow: tier.glow,
    }));

    return {
      id: champion.championId,
      topLabel:
        sort === "picks"
          ? champion.timesPicked.toLocaleString()
          : `${(championRate(champion, sort) * 100).toFixed(0)}%`,
      isSelected,
      dimmed: sort !== "picks" && isLowSample(champion.timesPicked),
      ariaLabel: `${displayName(champion.championName)}: ${champion.timesPicked} games, ${champion.top1 + champion.top3ExclTop1} wins, ${champion.top1} first`,
      icon: (
        <img
          loading="lazy"
          decoding="async"
          src={championIconUrl(champion.championName)}
          alt=""
          width={36}
          height={36}
          style={{
            opacity: isSelected ? 1 : 0.72,
          }}
        />
      ),
      segments,
    };
  });

  const modeCaption =
    sort === "picks"
      ? "SORTED · BY TIMES PICKED"
      : `SORTED · BY ${sort === "top3" ? "WINRATE" : "1ST-PLACE RATE"} · UNDER ${MIN_SAMPLE} DIMMED`;

  return (
    <CategorySection
      title="PICKS"
      quote="Only you can hear me, summoner. What masterpiece shall we play today?"
      imageUrl={SECTION_BACKGROUNDS.championPicks}
      sidebar={
        selected ? (
          <>
            <RingFrame size={262} className="mt-9.5">
              {/* 120px: Data Dragon's square icon is 120×120, so anything
                larger upscales it and turns soft. */}
              <div className="h-[120px] w-[120px] overflow-hidden rounded-full border border-[rgba(200,170,110,.55)] shadow-[0_0_30px_rgba(10,200,185,.22)]">
                <img
                  loading="lazy"
                  decoding="async"
                  src={championIconUrl(selected.championName)}
                  alt=""
                  width={120}
                  height={120}
                  className="h-full w-full object-cover"
                />
              </div>
            </RingFrame>

            <div className="mt-5.5 text-center">
              <div className="font-display text-[30px] tracking-[.1em] text-lol-gold-50">
                {displayName(selected.championName)}
              </div>
              <div className="mt-1.75 text-[13px] tracking-[.26em] text-lol-blue-300">
                {rankLabel(selectedRank, sorted.length, sort)}
              </div>
              <DossierLink championId={selected.championId} className="mt-3" />
            </div>

            <div className="mt-auto">
              <SidebarStatRows
                size="compact"
                rows={[
                  {
                    label: "PICKED",
                    value: selected.timesPicked.toLocaleString(),
                  },
                  {
                    label: "WINRATE",
                    value: `${(((selected.top1 + selected.top3ExclTop1) / selected.timesPicked) * 100).toFixed(0)}%`,
                    valueColor: TOP3_RATE_COLOR,
                  },
                  {
                    label: "1ST RATE",
                    value: `${((selected.top1 / selected.timesPicked) * 100).toFixed(0)}%`,
                    valueColor: FIRST_RATE_COLOR,
                  },
                ]}
              />
            </div>
          </>
        ) : null
      }
    >
      <HextechPanel>
        <PanelToolbar
          caption={`GAMES BY CHAMPION · ${modeCaption}`}
          trailing={sort !== "picks" ? <LowSampleSwitch checked={mixLowSample} onChange={setMixLowSample} /> : null}
        >
          <DiamondTabs
            tabs={[
              { key: "picks", label: "BY PICKS" },
              { key: "top3", label: "BY WINRATE" },
              { key: "rate", label: "BY 1ST RATE" },
            ]}
            active={sort}
            onChange={setSort}
          />
        </PanelToolbar>

        {champions.length === 0 ? (
          <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-lol-text-muted">
            No tracked matches yet.
          </div>
        ) : (
          <div ref={hoverRef} className="flex min-h-0 min-w-0 w-full flex-1 flex-col">
            <HextechBarChart
              columns={columns}
              onSelect={(id) => setSelectedChampionId(id as number)}
              onHover={onHover}
              highlightedId={hover?.id ?? null}
              gap={15}
              center
              topLabelColor={(column) => (column.isSelected ? "#f0e6d2" : "#8a8578")}
              heightUnit="percent"
            />
            <CursorTooltip point={hovered ? hover!.point : null}>
              {hovered ? (
                <PicksHoverCard
                  pick={hovered}
                  stats={championStats[hovered.championId]}
                  rank={hoveredIndex + 1}
                  total={sorted.length}
                  sortNoun={SORT_NOUN[sort]}
                />
              ) : null}
            </CursorTooltip>
          </div>
        )}
      </HextechPanel>
    </CategorySection>
  );
};

export { ChampionPicks };
