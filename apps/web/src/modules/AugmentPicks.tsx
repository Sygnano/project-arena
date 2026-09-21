"use client";

import { useMemo, useState } from "react";
import type {
  AugmentPickBreakdown,
  AugmentPicksStats,
  AugmentsStats,
} from "@arena/types";
import { CategorySection } from "@/components/category-section";
import { HextechPanel } from "@/components/hextech-panel";
import {
  HextechBarChart,
  type BarColumn,
} from "@/components/hextech-bar-chart";
import { RingFrame } from "@/components/dial";
import { DiamondTabs } from "@/components/diamond-tabs";
import { PanelToolbar, ToolbarDivider } from "@/components/panel-toolbar";
import { RarityFilterTabs } from "@/components/rarity-filter-tabs";
import { LowSampleSwitch } from "@/components/low-sample-switch";
import { SidebarStatRows } from "@/components/sidebar-stat-row";
import { TIER_STYLE } from "@/lib/tier-bars";
import { barHeight } from "@/lib/bar-scale";
import {
  matchesRarityFilter,
  RARITY_KICKER,
  type AugmentRarityFilter,
} from "@/lib/augment-rarity";
import { SECTION_BACKGROUNDS } from "@/lib/section-backgrounds";
import { MIN_SAMPLE, isLowSample, pooledRate, sortByRate } from "@/lib/sample";
import { formatSignedPoints } from "@/components/delta-cell";
import { CursorTooltip } from "@/components/cursor-tooltip";
import { PickHoverCard } from "@/components/pick-hover-card";
import {
  HoverCardChampions,
  HoverCardRows,
  HoverCardSection,
} from "@/components/hover-stat-card";
import { useChartHover } from "@/hooks/use-chart-hover";

type Props = {
  augments: AugmentsStats;
  augmentPicks: AugmentPicksStats;
};

type SortMode = "picks" | "top3" | "rate";

// Percentages of the chart's own bar track (`HextechBarChart`'s
// `heightUnit="percent"`), not px — the leader bar is deliberately capped
// below 100% rather than always touching the track's top edge, leaving
// headroom above the tallest column.
const BAR_MAX_HEIGHT = 70;
const BAR_MIN_HEIGHT = 5;

const TOP3_RATE_COLOR = "#e0b563";
const FIRST_RATE_COLOR = "var(--color-augment-prismatic)";

const SORT_NOUN: Record<SortMode, string> = {
  picks: "BY PICKS",
  top3: "BY WINRATE",
  rate: "BY 1ST RATE",
};

function rankLabel(rank: number, total: number): string {
  return `#${rank} OF ${total} PICKED`;
}

/** Share of games that count toward the active rate sort. */
function pickRate(row: AugmentPickBreakdown, sort: Exclude<SortMode, "picks">): number {
  const hits = sort === "top3" ? row.top1 + row.top3ExclTop1 : row.top1;
  return row.timesPicked > 0 ? hits / row.timesPicked : 0;
}

/** Same split as `ChampionPicks`' own `sortChampions` — bar HEIGHT follows the
 * sort: total picks under "BY PICKS", the rate itself under the two rate
 * sorts, so a rate sort reads highest-to-lowest left to right. */
function sortAugments(
  rows: AugmentPickBreakdown[],
  sort: SortMode,
  mixLowSample = false,
): AugmentPickBreakdown[] {
  if (sort === "picks") return [...rows].sort((a, b) => b.timesPicked - a.timesPicked);
  // Rates only rank rows with enough games; the rest follow, dimmed (see
  // lib/sample.ts). A 1-for-1 pick used to top "BY 1ST RATE" at 100%.
  return sortByRate(
    rows,
    (row) => pickRate(row, sort),
    (row) => row.timesPicked,
    "desc",
    mixLowSample ? "mixed" : "after",
  );
}

/**
 * The same "picks" bar chart as `ChampionPicks`, over augments instead of
 * champions — replaces the old catalog-grid `Augments` panel at this spot
 * on the page (the full-catalog view moved to `AugmentHallOfFame`, placed
 * right after this one). The one real addition over the champion version is
 * the rarity filter row: an augment's own Silver/Gold/Prismatic rarity
 * (`AugmentStats.rarity`) is a fixed property of the augment, independent of
 * how well the summoner has done on it (the bar segments' tier colors
 * below track the latter), so it gets its own filter rather than folding
 * into the existing sort tabs.
 */
const AugmentPicks = ({
  augments,
  augmentPicks,
}: Props) => {
  const [sort, setSort] = useState<SortMode>("picks");
  // Rate sorts: rank rows under MIN_SAMPLE with the rest (still dimmed).
  const [mixLowSample, setMixLowSample] = useState(false);
  const [rarityFilter, setRarityFilter] = useState<AugmentRarityFilter>("all");

  const catalogById = useMemo(
    () =>
      new Map(augments.augments.map((augment) => [augment.augmentId, augment])),
    [augments],
  );

  const filtered = useMemo(
    () =>
      augmentPicks.augments.filter((augment) => {
        const rarity = catalogById.get(augment.augmentId)?.rarity;
        return (
          rarity !== undefined && matchesRarityFilter(rarity, rarityFilter)
        );
      }),
    [augmentPicks, catalogById, rarityFilter],
  );

  const sorted = useMemo(() => sortAugments(filtered, sort, mixLowSample), [filtered, sort, mixLowSample]);

  const [selectedAugmentId, setSelectedAugmentId] = useState<number | null>(
    () => sorted[0]?.augmentId ?? null,
  );

  const maxPicks = Math.max(
    1,
    ...filtered.map((augment) => augment.timesPicked),
  );
  // Rate sorts scale against the best rate among rows with enough games, so a
  // 1-for-1 outlier can't flatten every real bar; mixed in, every row counts
  // (see lib/sample.ts). Outliers above the max clamp to the leader's height.
  const maxRate =
    sort === "picks"
      ? 0
      : Math.max(
          0,
          ...filtered
            .filter((row) => mixLowSample || !isLowSample(row.timesPicked))
            .map((row) => pickRate(row, sort)),
        );

  // Ranked off `selected` itself (not the raw `selectedAugmentId` state)
  // since the rarity filter can drop the previously-selected augment out of
  // `sorted` entirely — unlike `ChampionPicks`, which only ever re-sorts the
  // same fixed list and so never needs this fallback. Deriving the rank
  // from whichever augment `selected` actually resolves to (the real
  // selection, or `sorted[0]` once the old one is filtered away) keeps the
  // sidebar's "#N OF total" label in sync with what's on screen instead of
  // reporting "#0" for a selection that's no longer in the filtered list.
  // Compared with the average pick, not the per-game rate: longer games
  // hold more augments and finish higher (see `pooledRate`).
  const averageTop3 = pooledRate(
    augmentPicks.augments,
    (row) => row.top1 + row.top3ExclTop1,
    (row) => row.timesPicked,
  );
  const selected =
    sorted.find((augment) => augment.augmentId === selectedAugmentId) ??
    sorted[0] ??
    null;
  const selectedRank = selected
    ? sorted.findIndex((augment) => augment.augmentId === selected.augmentId) +
      1
    : 0;
  const selectedIcon = selected ? catalogById.get(selected.augmentId) : null;

  const { hover, onHover, containerRef: hoverRef } = useChartHover<number>();
  const hoveredIndex = hover ? sorted.findIndex((a) => a.augmentId === hover.id) : -1;
  const hovered = hoveredIndex === -1 ? null : sorted[hoveredIndex];

  const columns: BarColumn[] = sorted.map((augment) => {
    const isSelected = augment.augmentId === selected?.augmentId;

    // Under a rate sort the stack holds only the placements that count toward
    // that rate (1st + 2nd-3rd for WINRATE, 1st for 1ST RATE), so its height
    // is the rate itself — same as `ChampionPicks`.
    const stack = (
      [
        ["1st", augment.top1, TIER_STYLE.prismatic],
        ["top3", augment.top3ExclTop1, TIER_STYLE.gold],
        ["rest", augment.remaining, TIER_STYLE.silver],
      ] as const
    ).filter(
      ([key]) =>
        sort === "picks" || key === "1st" || (sort === "top3" && key === "top3"),
    );
    const stackCount = stack.reduce((sum, [, value]) => sum + value, 0);
    const total =
      sort === "picks"
        ? barHeight(augment.timesPicked, maxPicks, BAR_MAX_HEIGHT, BAR_MIN_HEIGHT)
        : barHeight(pickRate(augment, sort), maxRate, BAR_MAX_HEIGHT, BAR_MIN_HEIGHT);

    // Segment heights are proportional shares of `total` (not independently
    // scaled), so a stack always sums back to its own bar total.
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
      id: augment.augmentId,
      topLabel:
        sort === "picks"
          ? augment.timesPicked.toLocaleString()
          : `${(pickRate(augment, sort) * 100).toFixed(0)}%`,
      isSelected,
      dimmed: sort !== "picks" && isLowSample(augment.timesPicked),
      ariaLabel: `${augment.augmentName}: ${augment.timesPicked} games, ${augment.top1 + augment.top3ExclTop1} wins, ${augment.top1} first`,
      icon: (
        <img
          loading="lazy"
          decoding="async"
          src={catalogById.get(augment.augmentId)?.iconUrl}
          alt=""
          width={36}
          height={36}
          className="rounded-full"
          style={{ opacity: isSelected ? 1 : 0.72 }}
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
      imageUrl={SECTION_BACKGROUNDS.augmentPicks}
      title="AUGMENTS"
      quote="Join the glorious evolution."
      sidebar={
        selected ? (
          <>
            <RingFrame size={262} className="mt-9.5">
              <div className="h-[150px] w-[150px] overflow-hidden rounded-full border border-[rgba(200,170,110,.55)] shadow-[0_0_30px_rgba(10,200,185,.22)]">
                <img
                  loading="lazy"
                  decoding="async"
                  src={selectedIcon?.iconUrl}
                  alt={selected.augmentName}
                  width={150}
                  height={150}
                  className="h-full w-full object-cover"
                />
              </div>
            </RingFrame>

            <div className="mt-5.5 text-center">
              <div className="font-display text-[30px] tracking-[.1em] text-lol-gold-50">
                {selected.augmentName}
              </div>
              <div className="mt-1.75 text-[13px] tracking-[.26em] text-lol-blue-300">
                {rankLabel(selectedRank, sorted.length)}
              </div>
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
                  {
                    label: "WINRATE VS AVG PICK",
                    value: isLowSample(selected.timesPicked)
                      ? "FEW GAMES"
                      : formatSignedPoints(
                          ((selected.top1 + selected.top3ExclTop1) / selected.timesPicked) * 100 - averageTop3,
                          0,
                        ),
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
          caption={`GAMES BY AUGMENT · ${modeCaption}`}
          trailing={
            sort !== "picks" ? (
              <LowSampleSwitch checked={mixLowSample} onChange={setMixLowSample} unit="PICKS" />
            ) : null
          }
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
          <ToolbarDivider />
          <RarityFilterTabs active={rarityFilter} onChange={setRarityFilter} />
        </PanelToolbar>

        {sorted.length === 0 ? (
          <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-lol-text-muted">
            No tracked matches yet.
          </div>
        ) : (
          <div ref={hoverRef} className="flex min-h-0 min-w-0 w-full flex-1 flex-col">
            <HextechBarChart
              columns={columns}
              onSelect={(id) => setSelectedAugmentId(id as number)}
              onHover={onHover}
              highlightedId={hover?.id ?? null}
              gap={15}
              center
              topLabelColor={(column) =>
                column.isSelected ? "#f0e6d2" : "#8a8578"
              }
              heightUnit="percent"
            />
            <CursorTooltip point={hovered ? hover!.point : null}>
              {hovered ? (
                <PickHoverCard
                  name={hovered.augmentName}
                  iconUrl={catalogById.get(hovered.augmentId)?.iconUrl}
                  roundIcon
                  kicker={RARITY_KICKER[catalogById.get(hovered.augmentId)?.rarity ?? -1]}
                  countLabel="PICKED"
                  top1={hovered.top1}
                  top3ExclTop1={hovered.top3ExclTop1}
                  remaining={hovered.remaining}
                  rank={hoveredIndex + 1}
                  total={sorted.length}
                  sortNoun={SORT_NOUN[sort]}
                  // The sidebar already shows this augment's rates, so the
                  // card shows who it was picked on instead.
                  body={
                    <>
                      <HoverCardSection label="MOST PICKED ON">
                        <HoverCardChampions
                          champions={hovered.topChampions}
                          detail={(champion) =>
                            isLowSample(champion.games)
                              ? `${champion.top3} win${champion.top3 === 1 ? "" : "s"}`
                              : `${((champion.top3 / champion.games) * 100).toFixed(0)}% WR`
                          }
                        />
                      </HoverCardSection>
                      <HoverCardSection>
                        <HoverCardRows
                          rows={[
                            {
                              label: "PICKED ON",
                              value: `${hovered.championCount} champion${hovered.championCount === 1 ? "" : "s"}`,
                            },
                          ]}
                        />
                      </HoverCardSection>
                    </>
                  }
                />
              ) : null}
            </CursorTooltip>
          </div>
        )}
      </HextechPanel>
    </CategorySection>
  );
};

export { AugmentPicks };
