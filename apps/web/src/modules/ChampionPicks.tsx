"use client";

import { useMemo, useState } from "react";
import type { ChampionPickBreakdown, ChampionPicksStats } from "@arena/types";
import { CategorySection } from "@/components/category-section";
import { HextechPanel } from "@/components/hextech-panel";
import {
  HextechBarChart,
  type BarColumn,
} from "@/components/hextech-bar-chart";
import { RingFrame } from "@/components/dial";
import { DiamondTabs } from "@/components/diamond-tabs";
import { FadingRule } from "@/components/fading-rule";
import { SidebarStatRows } from "@/components/sidebar-stat-row";
import { TIER_STYLE } from "@/lib/tier-bars";
import { championIconUrl } from "@/lib/riot";

type Props = {
  championPicks: ChampionPicksStats;
  nextSectionLabel?: string;
};

type SortMode = "picks" | "rate";

const BAR_MAX_HEIGHT = 380;
const BAR_MIN_HEIGHT = 16;

/**
 * The design's middle stack segment (`top3ExclTop1`, 2nd-3rd place — see
 * `ChampionPickBreakdown`) is labeled "TOP 4" in the original prototype's
 * legend/sidebar text, a leftover from an earlier Arena team-size era (see
 * CLAUDE.md §2 on why team size — and therefore what "top 4" even means —
 * isn't stable). Relabeled to "TOP 3" here to match what the field actually
 * counts and stay consistent with `PlacementStats.top3Finishes`'s "win"
 * definition used everywhere else in the app; no data or layout changed.
 */
const TOP3_RATE_COLOR = "#e0b563";
const FIRST_RATE_COLOR = "var(--color-augment-prismatic)";

function rankLabel(rank: number, total: number): string {
  return `#${rank} OF ${total} PICKED`;
}

/**
 * Ranks champions by the active sort mode. Bar HEIGHT always reflects total
 * picks regardless of sort (see design_handoff_arena_panels/README.md, 5a:
 * "Bar total height = ... picks / maxPicks" is the only height formula
 * given) — only the x-order changes between "BY PICKS" and "BY 1ST RATE".
 */
function sortChampions(
  champions: ChampionPickBreakdown[],
  sort: SortMode,
): ChampionPickBreakdown[] {
  return [...champions].sort((a, b) =>
    sort === "picks"
      ? b.timesPicked - a.timesPicked
      : b.top1 / b.timesPicked - a.top1 / a.timesPicked,
  );
}

const ChampionPicks = ({
  championPicks,
  nextSectionLabel = "CHAMPIONS",
}: Props) => {
  const [sort, setSort] = useState<SortMode>("picks");
  const champions = championPicks.champions;

  const sorted = useMemo(
    () => sortChampions(champions, sort),
    [champions, sort],
  );

  const [selectedChampionId, setSelectedChampionId] = useState<number | null>(
    () => sorted[0]?.championId ?? null,
  );

  const maxPicks = Math.max(1, ...champions.map((c) => c.timesPicked));
  const totalPicks = champions.reduce((sum, c) => sum + c.timesPicked, 0);
  const avgPicks = champions.length > 0 ? totalPicks / champions.length : 0;
  const avgLineBottom = Math.round((avgPicks / maxPicks) * BAR_MAX_HEIGHT);

  const selectedRank =
    sorted.findIndex((c) => c.championId === selectedChampionId) + 1;
  const selected =
    sorted.find((c) => c.championId === selectedChampionId) ??
    sorted[0] ??
    null;

  const columns: BarColumn[] = sorted.map((champion) => {
    const total = Math.max(
      BAR_MIN_HEIGHT,
      Math.round((champion.timesPicked / maxPicks) * BAR_MAX_HEIGHT),
    );
    const isSelected = champion.championId === selectedChampionId;

    // Segment heights are proportional shares of `total` (not independently
    // scaled), so a champion's stack always sums back to its own bar total.
    const scale = champion.timesPicked > 0 ? total / champion.timesPicked : 0;
    const segments = (
      [
        [
          "1st",
          champion.top1,
          TIER_STYLE.prismatic,
          Math.max(
            champion.top1 > 0 ? 3 : 0,
            Math.round(champion.top1 * scale),
          ),
        ],
        [
          "top3",
          champion.top3ExclTop1,
          TIER_STYLE.gold,
          Math.round(champion.top3ExclTop1 * scale),
        ],
        [
          "rest",
          champion.remaining,
          TIER_STYLE.silver,
          Math.round(champion.remaining * scale),
        ],
      ] as const
    ).map(([key, value, tier, height]) => ({
      key,
      height,
      label: value > 0 ? String(value) : undefined,
      title: `${value} pick${value === 1 ? "" : "s"}`,
      fillClassName: tier.fillClass,
      borderColor: tier.edge,
      boxShadow: tier.glow,
    }));

    return {
      id: champion.championId,
      topLabel: champion.timesPicked.toLocaleString(),
      isSelected,
      icon: (
        <img
          src={championIconUrl(champion.championName)}
          alt={champion.championName}
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
      : "SORTED · BY 1ST-PLACE RATE";

  return (
    <CategorySection
      title="PICKS"
      quote="Only you can hear me, summoner. What masterpiece shall we play today ?"
      imageUrl="/images/kda-bg.jpg"
      nextSectionLabel={nextSectionLabel}
      sidebar={
        selected ? (
          <>
            <RingFrame size={262} className="mt-9.5">
              <div className="h-[150px] w-[150px] overflow-hidden rounded-full border border-[rgba(200,170,110,.55)] shadow-[0_0_30px_rgba(10,200,185,.22)]">
                <img
                  src={championIconUrl(selected.championName)}
                  alt={selected.championName}
                  width={150}
                  height={150}
                  className="h-full w-full object-cover"
                />
              </div>
            </RingFrame>

            <div className="mt-5.5 text-center">
              <div className="font-display text-[30px] tracking-[.1em] text-lol-gold-50">
                {selected.championName}
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
                    label: "TOP 3 RATE",
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
        <div className="mb-4 flex items-center gap-6">
          <DiamondTabs
            tabs={[
              { key: "picks", label: "BY PICKS" },
              { key: "rate", label: "BY 1ST RATE" },
            ]}
            active={sort}
            onChange={setSort}
          />
          <FadingRule />
          <div className="text-[11px] tracking-[.28em] text-lol-text-muted">
            GAMES BY CHAMPION · {modeCaption}
          </div>
        </div>

        {champions.length === 0 ? (
          <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-lol-text-muted">
            No tracked matches yet.
          </div>
        ) : (
          <HextechBarChart
            columns={columns}
            onSelect={(id) => setSelectedChampionId(id as number)}
            gap={15}
            center
            topLabelColor={(column) =>
              column.isSelected ? "#f0e6d2" : "#8a8578"
            }
          />
        )}
      </HextechPanel>
    </CategorySection>
  );
};

export { ChampionPicks };
