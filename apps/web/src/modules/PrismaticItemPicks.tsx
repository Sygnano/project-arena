"use client";

import { useMemo, useState } from "react";
import type { PrismaticItemPickBreakdown, PrismaticItemPicksStats, PrismaticItemsStats } from "@arena/types";
import { CategorySection } from "@/components/category-section";
import { HextechPanel } from "@/components/hextech-panel";
import { HextechBarChart, type BarColumn } from "@/components/hextech-bar-chart";
import { RingFrame } from "@/components/dial";
import { DiamondTabs } from "@/components/diamond-tabs";
import { PanelToolbar } from "@/components/panel-toolbar";
import { LowSampleSwitch } from "@/components/low-sample-switch";
import { SidebarStatRows } from "@/components/sidebar-stat-row";
import { TIER_STYLE } from "@/lib/tier-bars";
import { barHeight } from "@/lib/bar-scale";
import { SECTION_BACKGROUNDS } from "@/lib/section-backgrounds";
import { MIN_SAMPLE, isLowSample, pooledRate, sortByRate } from "@/lib/sample";
import { formatSignedPoints } from "@/components/delta-cell";
import { CursorTooltip } from "@/components/cursor-tooltip";
import { PickHoverCard } from "@/components/pick-hover-card";
import { useChartHover } from "@/hooks/use-chart-hover";

type Props = {
  prismaticItems: PrismaticItemsStats;
  prismaticItemPicks: PrismaticItemPicksStats;
};

type SortMode = "held" | "top3" | "rate";

// Percentages of the chart's own bar track (`HextechBarChart`'s
// `heightUnit="percent"`), not px — same as `ChampionPicks`/`AugmentPicks`.
const BAR_MAX_HEIGHT = 70;
const BAR_MIN_HEIGHT = 5;

const TOP3_RATE_COLOR = "#e0b563";
const FIRST_RATE_COLOR = "var(--color-augment-prismatic)";

const SORT_NOUN: Record<SortMode, string> = {
  held: "BY TIMES HELD",
  top3: "BY WINRATE",
  rate: "BY 1ST RATE",
};

function rankLabel(rank: number, total: number): string {
  return `#${rank} OF ${total} HELD`;
}

/** Share of games that count toward the active rate sort. */
function pickRate(row: PrismaticItemPickBreakdown, sort: Exclude<SortMode, "held">): number {
  const hits = sort === "top3" ? row.top1 + row.top3ExclTop1 : row.top1;
  return row.timesHeld > 0 ? hits / row.timesHeld : 0;
}

/** Same split as `ChampionPicks`' own `sortChampions` — bar HEIGHT follows the
 * sort: total holds under "BY TIMES HELD", the rate itself under the two rate
 * sorts, so a rate sort reads highest-to-lowest left to right. */
function sortItems(
  rows: PrismaticItemPickBreakdown[],
  sort: SortMode,
  mixLowSample = false,
): PrismaticItemPickBreakdown[] {
  if (sort === "held") return [...rows].sort((a, b) => b.timesHeld - a.timesHeld);
  // Rates only rank rows with enough games; the rest follow, dimmed (see
  // lib/sample.ts). A 1-for-1 pick used to top "BY 1ST RATE" at 100%.
  return sortByRate(
    rows,
    (row) => pickRate(row, sort),
    (row) => row.timesHeld,
    "desc",
    mixLowSample ? "mixed" : "after",
  );
}

/**
 * The same "picks" bar chart as `ChampionPicks`/`AugmentPicks`, over
 * Prismatic Items instead — replaces the old catalog-grid `PrismaticItems`
 * panel at this spot on the page (the full-catalog view moved to
 * `PrismaticItemHallOfFame`, placed right after this one). Unlike augments,
 * every entry here already IS the rarest tier (see CLAUDE.md §2 on how the
 * Prismatic Item catalog was verified) — there's no Silver/Gold/Prismatic
 * rarity to filter by, so this is a plain sortable chart with no filter row.
 */
const PrismaticItemPicks = ({ prismaticItems, prismaticItemPicks }: Props) => {
  const [sort, setSort] = useState<SortMode>("held");
  // Rate sorts: rank rows under MIN_SAMPLE with the rest (still dimmed).
  const [mixLowSample, setMixLowSample] = useState(false);

  const catalogById = useMemo(() => new Map(prismaticItems.items.map((item) => [item.itemId, item])), [prismaticItems]);

  const items = prismaticItemPicks.items;
  const sorted = useMemo(() => sortItems(items, sort, mixLowSample), [items, sort, mixLowSample]);

  const [selectedItemId, setSelectedItemId] = useState<number | null>(() => sorted[0]?.itemId ?? null);

  const maxHeld = Math.max(1, ...items.map((item) => item.timesHeld));
  // Rate sorts scale against the best rate among rows with enough games, so a
  // 1-for-1 outlier can't flatten every real bar; mixed in, every row counts
  // (see lib/sample.ts). Outliers above the max clamp to the leader's height.
  const maxRate =
    sort === "held"
      ? 0
      : Math.max(
          0,
          ...items.filter((row) => mixLowSample || !isLowSample(row.timesHeld)).map((row) => pickRate(row, sort)),
        );

  // Compared with the average pick, not the per-game rate: longer games
  // hold more items and finish higher (see `pooledRate`).
  const averageTop3 = pooledRate(
    items,
    (row) => row.top1 + row.top3ExclTop1,
    (row) => row.timesHeld,
  );
  const selected = sorted.find((item) => item.itemId === selectedItemId) ?? sorted[0] ?? null;
  const selectedRank = selected ? sorted.findIndex((item) => item.itemId === selected.itemId) + 1 : 0;
  const selectedIcon = selected ? catalogById.get(selected.itemId) : null;

  const { hover, onHover, containerRef: hoverRef } = useChartHover<number>();
  const hoveredIndex = hover ? sorted.findIndex((i) => i.itemId === hover.id) : -1;
  const hovered = hoveredIndex === -1 ? null : sorted[hoveredIndex];

  const columns: BarColumn[] = sorted.map((item) => {
    const isSelected = item.itemId === selected?.itemId;

    // Under a rate sort the stack holds only the placements that count toward
    // that rate (1st + 2nd-3rd for WINRATE, 1st for 1ST RATE), so its height
    // is the rate itself — same as `ChampionPicks`.
    const stack = (
      [
        ["1st", item.top1, TIER_STYLE.prismatic],
        ["top3", item.top3ExclTop1, TIER_STYLE.gold],
        ["rest", item.remaining, TIER_STYLE.silver],
      ] as const
    ).filter(([key]) => sort === "held" || key === "1st" || (sort === "top3" && key === "top3"));
    const stackCount = stack.reduce((sum, [, value]) => sum + value, 0);
    const total =
      sort === "held"
        ? barHeight(item.timesHeld, maxHeld, BAR_MAX_HEIGHT, BAR_MIN_HEIGHT)
        : barHeight(pickRate(item, sort), maxRate, BAR_MAX_HEIGHT, BAR_MIN_HEIGHT);

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
      id: item.itemId,
      topLabel: sort === "held" ? item.timesHeld.toLocaleString() : `${(pickRate(item, sort) * 100).toFixed(0)}%`,
      isSelected,
      dimmed: sort !== "held" && isLowSample(item.timesHeld),
      ariaLabel: `${item.itemName}: ${item.timesHeld} games, ${item.top1 + item.top3ExclTop1} wins, ${item.top1} first`,
      icon: (
        <img
          loading="lazy"
          decoding="async"
          src={catalogById.get(item.itemId)?.iconUrl}
          alt=""
          width={36}
          height={36}
          className="rounded-md"
          style={{ opacity: isSelected ? 1 : 0.72 }}
        />
      ),
      segments,
    };
  });

  const modeCaption =
    sort === "held"
      ? "SORTED · BY TIMES HELD"
      : `SORTED · BY ${sort === "top3" ? "WINRATE" : "1ST-PLACE RATE"} · UNDER ${MIN_SAMPLE} DIMMED`;

  return (
    <CategorySection
      imageUrl={SECTION_BACKGROUNDS.prismaticItemPicks}
      title="PRISMATICS"
      quote="The weapons I forge do not have names. They have ambitions."
      sidebar={
        selected ? (
          <>
            <RingFrame size={262} className="mt-9.5">
              <div className="h-[150px] w-[150px] overflow-hidden rounded-md border border-[rgba(200,170,110,.55)] shadow-[0_0_30px_rgba(10,200,185,.22)]">
                <img
                  loading="lazy"
                  decoding="async"
                  src={selectedIcon?.iconUrl}
                  alt={selected.itemName}
                  width={150}
                  height={150}
                  className="h-full w-full object-cover"
                />
              </div>
            </RingFrame>

            <div className="mt-5.5 text-center">
              <div className="font-display text-[30px] tracking-[.1em] text-lol-gold-50">{selected.itemName}</div>
              <div className="mt-1.75 text-[13px] tracking-[.26em] text-lol-blue-300">
                {rankLabel(selectedRank, sorted.length)}
              </div>
            </div>

            <div className="mt-auto">
              <SidebarStatRows
                size="compact"
                rows={[
                  {
                    label: "HELD",
                    value: selected.timesHeld.toLocaleString(),
                  },
                  {
                    label: "WINRATE",
                    value: `${(((selected.top1 + selected.top3ExclTop1) / selected.timesHeld) * 100).toFixed(0)}%`,
                    valueColor: TOP3_RATE_COLOR,
                  },
                  {
                    label: "1ST RATE",
                    value: `${((selected.top1 / selected.timesHeld) * 100).toFixed(0)}%`,
                    valueColor: FIRST_RATE_COLOR,
                  },
                  {
                    label: "WINRATE VS AVG ITEM",
                    value: isLowSample(selected.timesHeld)
                      ? "FEW GAMES"
                      : formatSignedPoints(
                          ((selected.top1 + selected.top3ExclTop1) / selected.timesHeld) * 100 - averageTop3,
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
          caption={`GAMES BY ITEM · ${modeCaption}`}
          trailing={sort !== "held" ? <LowSampleSwitch checked={mixLowSample} onChange={setMixLowSample} /> : null}
        >
          <DiamondTabs
            tabs={[
              { key: "held", label: "BY TIMES HELD" },
              { key: "top3", label: "BY WINRATE" },
              { key: "rate", label: "BY 1ST RATE" },
            ]}
            active={sort}
            onChange={setSort}
          />
        </PanelToolbar>

        {sorted.length === 0 ? (
          <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-lol-text-muted">
            No tracked matches yet.
          </div>
        ) : (
          <div ref={hoverRef} className="flex min-h-0 min-w-0 w-full flex-1 flex-col">
            <HextechBarChart
              columns={columns}
              onSelect={(id) => setSelectedItemId(id as number)}
              onHover={onHover}
              highlightedId={hover?.id ?? null}
              gap={15}
              center
              topLabelColor={(column) => (column.isSelected ? "#f0e6d2" : "#8a8578")}
              heightUnit="percent"
            />
            <CursorTooltip point={hovered ? hover!.point : null}>
              {hovered ? (
                <PickHoverCard
                  name={hovered.itemName}
                  iconUrl={catalogById.get(hovered.itemId)?.iconUrl}
                  kicker="PRISMATIC ITEM"
                  countLabel="HELD"
                  top1={hovered.top1}
                  top3ExclTop1={hovered.top3ExclTop1}
                  remaining={hovered.remaining}
                  rank={hoveredIndex + 1}
                  total={sorted.length}
                  sortNoun={SORT_NOUN[sort]}
                  averageWinRate={averageTop3}
                  averageLabel="AVG ITEM"
                />
              ) : null}
            </CursorTooltip>
          </div>
        )}
      </HextechPanel>
    </CategorySection>
  );
};

export { PrismaticItemPicks };
