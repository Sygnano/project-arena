"use client";

import { useMemo } from "react";
import { tierForBestFinish } from "@/lib/tier-bars";
import type {
  PrismaticItemPicksStats,
  PrismaticItemsStats,
} from "@arena/types";
import { CategorySection } from "@/components/category-section";
import { HextechPanel } from "@/components/hextech-panel";
import { HeaderStatStrip, StatCell } from "@/components/header-stat-strip";
import { HexComb, type HexCombCell } from "@/components/hex-comb";
import { SECTION_BACKGROUNDS } from "@/lib/section-backgrounds";
import { pooledRate } from "@/lib/sample";
import { CursorTooltip } from "@/components/cursor-tooltip";
import { PickHoverCard } from "@/components/pick-hover-card";
import { useChartHover } from "@/hooks/use-chart-hover";

type Props = {
  prismaticItems: PrismaticItemsStats;
  prismaticItemPicks: PrismaticItemPicksStats;
};

/**
 * The full Prismatic Item catalog (49 items — see CLAUDE.md §2) as a
 * honeycomb (`HexComb`), same layout as `Champions`/`AugmentHallOfFame` —
 * fixed alphabetical order, each hexagon rimmed by the summoner's best-ever
 * finish while holding it.
 */
const PrismaticItemHallOfFame = ({
  prismaticItems,
  prismaticItemPicks,
}: Props) => {
  const pickByItemId = useMemo(
    () => new Map(prismaticItemPicks.items.map((pick) => [pick.itemId, pick])),
    [prismaticItemPicks],
  );

  const roster = useMemo(
    () =>
      [...prismaticItems.items].sort((a, b) =>
        a.itemName.localeCompare(b.itemName),
      ),
    [prismaticItems],
  );
  const catalogById = useMemo(
    () => new Map(roster.map((item) => [item.itemId, item])),
    [roster],
  );

  const cells = useMemo<HexCombCell[]>(
    () =>
      roster.map((item) => {
        const pick = pickByItemId.get(item.itemId);
        return {
          id: item.itemId,
          name: item.itemName,
          iconUrl: item.iconUrl,
          tier: tierForBestFinish(pick),
          interactive: pick !== undefined,
        };
      }),
    [roster, pickByItemId],
  );

  const heldCount = roster.filter((item) =>
    pickByItemId.has(item.itemId),
  ).length;
  const wonWithCount = prismaticItemPicks.items.filter(
    (pick) => pick.top1 > 0 || pick.top3ExclTop1 > 0,
  ).length;
  const firstPlaceCount = prismaticItemPicks.items.filter(
    (pick) => pick.top1 > 0,
  ).length;

  // Compared with the average held item, like the Prismatic Items chart
  // (see `pooledRate`).
  const averageWinRate = useMemo(
    () =>
      pooledRate(
        prismaticItemPicks.items,
        (row) => row.top1 + row.top3ExclTop1,
        (row) => row.timesHeld,
      ),
    [prismaticItemPicks],
  );

  const { hover, onHover, containerRef: hoverRef } = useChartHover<number>();
  const hoveredPick = hover ? pickByItemId.get(hover.id) : undefined;


  return (
    <CategorySection
      imageUrl={SECTION_BACKGROUNDS.prismaticItemHallOfFame}
      title="PRISMATIC GOD"
      quote="You belong in a museum!"
      headerRight={
        <HeaderStatStrip>
          <StatCell
            label="HELD"
            value={`${heldCount} / ${roster.length}`}
            bordered={false}
          />
          <StatCell
            label="WON WITH"
            value={`${wonWithCount} / ${roster.length}`}
          />
          <StatCell
            label="1ST PLACE WITH"
            value={`${firstPlaceCount} / ${roster.length}`}
            highlight
          />
        </HeaderStatStrip>
      }
    >
      <HextechPanel bodyClassName="p-8">
        <HexComb
          cells={cells}
          gap={14}
          minColumns={5}
          maxColumns={16}
          maxHexWidth={116}
          flowHexWidth={64}
          hoveredId={hover?.id}
          onHover={onHover}
          hoverRef={hoverRef}
        />
        <CursorTooltip point={hoveredPick ? hover!.point : null}>
          {hoveredPick ? (
            <PickHoverCard
              name={hoveredPick.itemName}
              iconUrl={catalogById.get(hoveredPick.itemId)?.iconUrl}
              kicker="PRISMATIC ITEM"
              countLabel="HELD"
              top1={hoveredPick.top1}
              top3ExclTop1={hoveredPick.top3ExclTop1}
              remaining={hoveredPick.remaining}
              averageWinRate={averageWinRate}
              averageLabel="AVG ITEM"
              pinHint={false}
            />
          ) : null}
        </CursorTooltip>
      </HextechPanel>
    </CategorySection>
  );
};

export { PrismaticItemHallOfFame };
