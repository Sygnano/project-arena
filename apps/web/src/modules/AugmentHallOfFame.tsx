"use client";

import { useMemo, useState } from "react";
import { HexComb, type HexCombCell } from "@/components/hex-comb";
import { tierForBestFinish } from "@/lib/tier-bars";
import type {
  AugmentPicksStats,
  AugmentsStats,
} from "@arena/types";
import { CategorySection } from "@/components/category-section";
import { HextechPanel } from "@/components/hextech-panel";
import { HeaderStatStrip, StatCell } from "@/components/header-stat-strip";
import { RarityFilterTabs } from "@/components/rarity-filter-tabs";
import { FadingRule } from "@/components/fading-rule";
import {
  matchesRarityFilter,
  RARITY_KICKER,
  type AugmentRarityFilter,
} from "@/lib/augment-rarity";
import { SECTION_BACKGROUNDS } from "@/lib/section-backgrounds";
import { pooledRate } from "@/lib/sample";
import { CursorTooltip } from "@/components/cursor-tooltip";
import { PickHoverCard } from "@/components/pick-hover-card";
import { useChartHover } from "@/hooks/use-chart-hover";

type Props = {
  augments: AugmentsStats;
  augmentPicks: AugmentPicksStats;
};

/**
 * The full augment catalog (currently 225 — see CLAUDE.md §2) as one Hall of
 * Fame honeycomb (`HexComb`), same layout as `Champions` — fixed alphabetical
 * order within whatever the rarity filter currently allows (the comb re-fits
 * its columns to the shown count), each hexagon rimmed by the
 * summoner's best-ever finish on that augment. Placed right after
 * `AugmentPicks` (which replaced the old catalog-grid `Augments` panel).
 */
const AugmentHallOfFame = ({
  augments,
  augmentPicks,
}: Props) => {
  const [rarityFilter, setRarityFilter] = useState<AugmentRarityFilter>("all");

  const pickByAugmentId = useMemo(
    () => new Map(augmentPicks.augments.map((pick) => [pick.augmentId, pick])),
    [augmentPicks],
  );

  const roster = useMemo(
    () =>
      [...augments.augments]
        .filter((augment) => matchesRarityFilter(augment.rarity, rarityFilter))
        .sort((a, b) => a.augmentName.localeCompare(b.augmentName)),
    [augments, rarityFilter],
  );

  const playedCount = roster.filter((augment) =>
    pickByAugmentId.has(augment.augmentId),
  ).length;
  const wonWithCount = roster.filter((augment) => {
    const pick = pickByAugmentId.get(augment.augmentId);
    return pick != null && (pick.top1 > 0 || pick.top3ExclTop1 > 0);
  }).length;
  const firstPlaceCount = roster.filter((augment) => {
    const pick = pickByAugmentId.get(augment.augmentId);
    return pick != null && pick.top1 > 0;
  }).length;

  const cells = useMemo<HexCombCell[]>(
    () =>
      roster.map((augment) => {
        const pick = pickByAugmentId.get(augment.augmentId);
        return {
          id: augment.augmentId,
          name: augment.augmentName,
          iconUrl: augment.iconUrl,
          tier: tierForBestFinish(pick),
          interactive: pick !== undefined,
        };
      }),
    [roster, pickByAugmentId],
  );

  // Compared with the average pick, like the Augments chart (see `pooledRate`).
  const averageWinRate = useMemo(
    () =>
      pooledRate(
        augmentPicks.augments,
        (row) => row.top1 + row.top3ExclTop1,
        (row) => row.timesPicked,
      ),
    [augmentPicks],
  );

  const { hover, onHover, containerRef: hoverRef } = useChartHover<number>();
  const hoveredPick = hover ? pickByAugmentId.get(hover.id) : undefined;
  const hoveredAugment = hoveredPick
    ? roster.find((augment) => augment.augmentId === hoveredPick.augmentId)
    : undefined;


  return (
    <CategorySection
      imageUrl={SECTION_BACKGROUNDS.augmentHallOfFame}
      title="AUGMENT GOD"
      quote="Master yourself, master the enemy."
      headerRight={
        <HeaderStatStrip>
          {/* Counted over `roster`, so both sides follow the rarity tab. */}
          <StatCell
            label="PLAYED"
            value={`${playedCount} / ${roster.length}`}
            bordered={false}
          />
          <StatCell label="WON WITH" value={`${wonWithCount} / ${roster.length}`} />
          <StatCell
            label="1ST PLACE WITH"
            value={`${firstPlaceCount} / ${roster.length}`}
            highlight
          />
        </HeaderStatStrip>
      }
    >
      <HextechPanel bodyClassName="p-8">
        <div className="mb-4 flex flex-none flex-wrap items-center gap-x-6 gap-y-3">
          <RarityFilterTabs
            active={rarityFilter}
            onChange={(filter) => {
              onHover(null);
              setRarityFilter(filter);
            }}
          />
          <FadingRule />
          <div className="text-[11px] tracking-[.28em] text-lol-text-muted">
            {roster.length.toLocaleString()} AUGMENTS
          </div>
        </div>

        <HexComb
          cells={cells}
          gap={8}
          minColumns={12}
          maxColumns={32}
          maxHexWidth={96}
          flowHexWidth={44}
          hoveredId={hover?.id}
          onHover={onHover}
          hoverRef={hoverRef}
          // Keyed by the filter, so a tab switch replays the ripple.
          animationKey={rarityFilter}
          // Augment art is a round badge with dark padding around it.
          imageClassName="scale-[1.18]"
        />
        <CursorTooltip point={hoveredPick ? hover!.point : null}>
          {hoveredPick ? (
            <PickHoverCard
              name={hoveredPick.augmentName}
              iconUrl={hoveredAugment?.iconUrl}
              roundIcon
              kicker={RARITY_KICKER[hoveredAugment?.rarity ?? -1]}
              countLabel="PICKED"
              top1={hoveredPick.top1}
              top3ExclTop1={hoveredPick.top3ExclTop1}
              remaining={hoveredPick.remaining}
              averageWinRate={averageWinRate}
              pinHint={false}
            />
          ) : null}
        </CursorTooltip>
      </HextechPanel>
    </CategorySection>
  );
};

export { AugmentHallOfFame };
