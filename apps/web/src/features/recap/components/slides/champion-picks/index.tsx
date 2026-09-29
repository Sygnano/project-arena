"use client";

import { useState, useMemo } from "react";
import type { ChampionPicksStats, ChampionStats } from "@arena/types";
import { CategorySection } from "@/features/recap/components/category-section";
import { HextechPanel } from "@/components/hextech-panel";
import { type BarColumn, HextechBarChart } from "@/components/hextech-bar-chart";
import { RingFrame } from "@/components/dial";
import { DiamondTabs } from "@/components/diamond-tabs";
import { PanelToolbar } from "@/components/panel-toolbar";
import { LowSampleSwitch } from "@/features/recap/components/low-sample-switch";
import { SidebarStatRows } from "@/components/sidebar-stat-rows";
import { TIER_STYLE } from "@/utils/tier-bars";
import { championIconUrl } from "@/utils/riot";
import { barHeight } from "@/utils/bar-scale";
import { useChampionName } from "@/features/recap/stores/champion-names";
import { DossierLink } from "@/features/recap/components/dossier-link";
import { CursorTooltip } from "@/components/cursor-tooltip";
import { useChartHover } from "@/hooks/use-chart-hover";
import { SECTION_BACKGROUNDS } from "@/features/recap/utils/section-backgrounds";
import { isLowSample, MIN_SAMPLE } from "@/features/recap/utils/sample";
import { PicksHoverCard } from "./components/picks-hover-card";
import { BAR_MAX_HEIGHT, BAR_MIN_HEIGHT, FIRST_RATE_COLOR, SORT_NOUN, TOP3_RATE_COLOR } from "./constants";
import type { SortMode } from "./types";
import { championRate, rankLabel, sortChampions } from "./utils";

type Props = {
  championPicks: ChampionPicksStats;
  /** Per-champion combat totals, for the hover card. */
  champions: Record<number, ChampionStats>;
};

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
