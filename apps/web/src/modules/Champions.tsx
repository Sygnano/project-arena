"use client";

import { useMemo } from "react";
import { tierForBestFinish } from "@/lib/tier-bars";
import type { ChampionCatalogStats, ChampionPicksStats, ChampionStats } from "@arena/types";
import { CursorTooltip } from "@/components/cursor-tooltip";
import { useChartHover } from "@/hooks/use-chart-hover";
import { ChampionResultsCard } from "@/modules/ChampionResultsCard";
import { CategorySection } from "@/components/category-section";
import { HextechPanel } from "@/components/hextech-panel";
import { HeaderStatStrip, StatCell } from "@/components/header-stat-strip";
import { HexComb, type HexCombCell } from "@/components/hex-comb";
import { championIconUrl } from "@/lib/riot";
import { useChampionName } from "@/lib/champion-names";
import { SECTION_BACKGROUNDS } from "@/lib/section-backgrounds";

type Props = {
  championCatalog: ChampionCatalogStats;
  championPicks: ChampionPicksStats;
  /** Per-champion stats, for the hover card's placements. */
  champions: Record<number, ChampionStats>;
};

/**
 * Every champion in the game (currently ~171) as one Hall of Fame honeycomb
 * (`HexComb`), in fixed alphabetical order, each portrait rimmed by the
 * summoner's best-ever finish on that champion. No sidebar and no
 * per-champion drilldown: the comb itself is the content, beside a PLAYED /
 * WON WITH / FIRST PLACE header stat strip.
 */
const Champions = ({ championCatalog, championPicks, champions }: Props) => {
  const displayName = useChampionName();

  const pickByChampionId = useMemo(
    () => new Map(championPicks.champions.map((pick) => [pick.championId, pick])),
    [championPicks],
  );

  const cells = useMemo<HexCombCell[]>(
    () =>
      [...championCatalog.champions]
        .sort((a, b) => displayName(a.championName).localeCompare(displayName(b.championName)))
        .map((champion) => ({
          id: champion.championId,
          name: displayName(champion.championName),
          iconUrl: championIconUrl(champion.championName),
          tier: tierForBestFinish(pickByChampionId.get(champion.championId)),
          interactive: champions[champion.championId] !== undefined,
        })),
    [championCatalog, displayName, pickByChampionId, champions],
  );

  const playedCount = cells.filter((cell) => pickByChampionId.has(cell.id)).length;
  const wonWithCount = championPicks.champions.filter((pick) => pick.top1 > 0 || pick.top3ExclTop1 > 0).length;
  const firstPlaceCount = championPicks.champions.filter((pick) => pick.top1 > 0).length;

  const { hover, onHover, containerRef: hoverRef } = useChartHover<number>();
  const hoveredStats = hover ? champions[hover.id] : undefined;

  return (
    <CategorySection
      title="ARENA GOD"
      quote="Bring me a real challenge."
      imageUrl={SECTION_BACKGROUNDS.champions}
      headerRight={
        <HeaderStatStrip>
          <StatCell label="PLAYED" value={`${playedCount} / ${cells.length}`} bordered={false} />
          <StatCell label="WON WITH" value={`${wonWithCount} / ${cells.length}`} />
          <StatCell label="1ST PLACE WITH" value={`${firstPlaceCount} / ${cells.length}`} highlight />
        </HeaderStatStrip>
      }
    >
      <HextechPanel bodyClassName="p-8">
        <HexComb
          cells={cells}
          gap={8}
          minColumns={10}
          maxColumns={30}
          maxHexWidth={96}
          flowHexWidth={48}
          hoveredId={hover?.id}
          onHover={onHover}
          hoverRef={hoverRef}
          // Data Dragon portraits have a thin dark border baked in.
          imageClassName="scale-[1.12]"
        />
        <CursorTooltip point={hoveredStats ? hover!.point : null}>
          {hoveredStats ? <ChampionResultsCard stats={hoveredStats} /> : null}
        </CursorTooltip>
      </HextechPanel>
    </CategorySection>
  );
};

export { Champions };
