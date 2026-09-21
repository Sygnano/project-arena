"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "cn";
import type { VersusChampionStats, VersusStats } from "@arena/types";
import { CategorySection } from "@/components/category-section";
import { HextechPanel } from "@/components/hextech-panel";
import { RingFrame } from "@/components/dial";
import { DiamondTabs } from "@/components/diamond-tabs";
import { PanelToolbar } from "@/components/panel-toolbar";
import { LowSampleSwitch } from "@/components/low-sample-switch";
import { SidebarStatRows } from "@/components/sidebar-stat-row";
import { formatSignedPoints } from "@/components/delta-cell";
import { championIconUrl } from "@/lib/riot";
import { pressable } from "@/lib/a11y";
import { useChampionName } from "@/lib/champion-names";
import { useDragScroll } from "@/hooks/use-drag-scroll";
import { SECTION_BACKGROUNDS } from "@/lib/section-backgrounds";
import { MIN_SAMPLE, isLowSample, sortByRate } from "@/lib/sample";

type Props = { versus: VersusStats };

type SortMode = "fought" | "best" | "worst";

// Same you/them pair as Nemesis' round bars.
const WON_COLOR = "var(--color-lol-blue-300)";
const LOST_COLOR = "var(--color-lol-garnet)";

/** won count · won bar (grows left) · champion · lost bar (grows right) ·
 * lost count · share of duels won. */
const ROW_GRID = "40px minmax(0,1fr) 190px minmax(0,1fr) 40px 56px";

const SORT_NOUN: Record<SortMode, string> = {
  fought: "MOST FOUGHT",
  best: "BEST MATCHUPS",
  worst: "WORST MATCHUPS",
};

function duels(row: VersusChampionStats): number {
  return row.duelsWon + row.duelsLost;
}

/** Share of duels against this champion that the summoner's team won (0-1). */
function winShare(row: VersusChampionStats): number {
  const total = duels(row);
  return total > 0 ? row.duelsWon / total : 0;
}

function pct(share: number): string {
  return `${(share * 100).toFixed(0)}%`;
}

function sortChampions(
  rows: VersusChampionStats[],
  sort: SortMode,
  mixLowSample: boolean,
): VersusChampionStats[] {
  if (sort === "fought") return [...rows].sort((a, b) => duels(b) - duels(a));
  return sortByRate(
    rows,
    (row) => (sort === "best" ? winShare(row) : 1 - winShare(row)),
    duels,
    "desc",
    mixLowSample ? "mixed" : "after",
  );
}

/**
 * Versus — every enemy champion the summoner's team fought in a round duel
 * (`match_rounds`), with the duels won and lost against it. Each row is a
 * tug-of-war around the champion, the same twin-bar shape as Nemesis: duels
 * won grow left, duels lost grow right, both on one shared scale. Totals
 * first: the default view ranks by duels fought; the rate views re-rank the
 * same rows by the share of duels won or lost.
 */
const Versus = ({ versus }: Props) => {
  const { champions, duelsWon, duelsLost } = versus;
  const [sort, setSort] = useState<SortMode>("fought");
  const [mixLowSample, setMixLowSample] = useState(false);
  const displayName = useChampionName();
  const listRef = useRef<HTMLDivElement>(null);
  useDragScroll(listRef, "y");

  const sorted = useMemo(
    () => sortChampions(champions, sort, mixLowSample),
    [champions, sort, mixLowSample],
  );

  const [selectedChampionId, setSelectedChampionId] = useState<number | null>(
    () => sorted[0]?.championId ?? null,
  );
  const selected =
    sorted.find((c) => c.championId === selectedChampionId) ?? sorted[0] ?? null;
  const selectedRank = selected
    ? sorted.findIndex((c) => c.championId === selected.championId) + 1
    : 0;

  // Bars start empty and grow in once mounted.
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const totalDuels = duelsWon + duelsLost;
  const baseline = totalDuels > 0 ? (duelsWon / totalDuels) * 100 : 0;

  // Duel counts, not rates: every row sets the one scale both sides share.
  const maxSide = Math.max(1, ...champions.map((c) => Math.max(c.duelsWon, c.duelsLost)));


  const modeCaption =
    sort === "fought"
      ? "SORTED · BY DUELS FOUGHT"
      : `SORTED · BY DUELS ${sort === "best" ? "WON" : "LOST"} % · UNDER ${MIN_SAMPLE} DIMMED`;

  return (
    <CategorySection
      title="VERSUS"
      quote="Who wants a piece of the champ?"
      imageUrl={SECTION_BACKGROUNDS.versus}
      sidebar={
        selected ? (
          <>
            <RingFrame size={262} className="mt-9.5">
              <div className="h-[120px] w-[120px] overflow-hidden rounded-full border border-[rgba(200,170,110,.55)] shadow-[0_0_30px_rgba(201,138,163,.22)]">
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
                #{selectedRank} OF {sorted.length} · {SORT_NOUN[sort]}
              </div>
            </div>

            <div className="mt-auto">
              <SidebarStatRows
                size="compact"
                rows={[
                  { label: "GAMES MET", value: selected.gamesFaced.toLocaleString() },
                  {
                    label: "DUELS PER GAME",
                    value: (selected.gamesFaced > 0
                      ? duels(selected) / selected.gamesFaced
                      : 0
                    ).toFixed(1),
                  },
                  {
                    label: "DUELS WON",
                    value: pct(winShare(selected)),
                    valueColor: winShare(selected) * 100 >= baseline ? WON_COLOR : LOST_COLOR,
                  },
                  {
                    label: "VS YOUR AVERAGE",
                    value: formatSignedPoints(winShare(selected) * 100 - baseline, 0),
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
          caption={`DUELS BY ENEMY CHAMPION · ${modeCaption}`}
          trailing={
            sort !== "fought" ? (
              <LowSampleSwitch checked={mixLowSample} onChange={setMixLowSample} />
            ) : null
          }
        >
          <DiamondTabs
            tabs={[
              { key: "fought", label: "MOST FOUGHT" },
              { key: "best", label: "BEST MATCHUPS" },
              { key: "worst", label: "WORST MATCHUPS" },
            ]}
            active={sort}
            onChange={setSort}
          />
        </PanelToolbar>

        <div
          className="grid items-center gap-4 px-1.5 pb-2 text-[11px] tracking-[.2em]"
          style={{
            gridTemplateColumns: ROW_GRID,
            borderBottom: "1px solid rgba(200,170,110,.16)",
          }}
        >
          <div className="col-span-2 text-right" style={{ color: WON_COLOR }}>
            ◀ DUELS YOU WON
          </div>
          <div className="text-center text-lol-text-muted">CHAMPION</div>
          <div className="col-span-2 text-left" style={{ color: LOST_COLOR }}>
            DUELS THEY WON ▶
          </div>
          <div className="text-right text-lol-text-muted">WON</div>
        </div>

        {champions.length === 0 ? (
          <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-lol-text-muted">
            No round duels yet.
          </div>
        ) : (
          <div
            ref={listRef}
            className="flex min-h-0 flex-1 flex-col justify-start gap-1 overflow-y-auto py-1.5 pr-1"
            style={{
              scrollbarWidth: "thin",
              scrollbarColor: "rgba(200,170,110,.45) transparent",
            }}
          >
            {sorted.map((champion, index) => {
              const isSelected = champion.championId === selected?.championId;
              const share = winShare(champion);
              const wonPct = grown ? (champion.duelsWon / maxSide) * 100 : 0;
              const lostPct = grown ? (champion.duelsLost / maxSide) * 100 : 0;
              return (
                // Keyed by rank, like Nemesis: a re-sort keeps each slot in
                // place and tweens its bars to the new champion.
                <div
                  key={index}
                  {...pressable(() => setSelectedChampionId(champion.championId), {
                    pressed: isSelected,
                  })}
                  aria-label={`${displayName(champion.championName)}: ${champion.duelsWon} duels won, ${champion.duelsLost} lost`}
                  className={cn(
                    "grid cursor-pointer items-center gap-4 px-1.5 py-1 transition-[background,opacity] duration-150",
                    sort !== "fought" && isLowSample(duels(champion)) && "opacity-45",
                  )}
                  style={{
                    gridTemplateColumns: ROW_GRID,
                    background: isSelected ? "rgba(200,170,110,.09)" : "transparent",
                    boxShadow: isSelected ? "inset 0 0 0 1px rgba(200,170,110,.45)" : undefined,
                  }}
                >
                  <div
                    className="text-right font-display text-[16px]"
                    style={{ color: WON_COLOR }}
                  >
                    {champion.duelsWon}
                  </div>

                  <div className="relative h-2.5" style={{ background: "rgba(240,230,210,.05)" }}>
                    <div
                      className="absolute inset-y-0 right-0 transition-[width] duration-500 ease-out motion-reduce:transition-none"
                      style={{
                        width: `${wonPct}%`,
                        background: WON_COLOR,
                        boxShadow: "0 0 10px rgba(10,200,185,.45)",
                      }}
                    />
                  </div>

                  <div className="flex min-w-0 items-center justify-center gap-2.5">
                    <img
                      loading="lazy"
                      decoding="async"
                      src={championIconUrl(champion.championName)}
                      alt=""
                      width={28}
                      height={28}
                      className="h-7 w-7 flex-none border border-[rgba(200,170,110,.35)] object-cover"
                    />
                    <div className="min-w-0">
                      <div className="font-body truncate text-[15px] leading-tight text-lol-gold-50">
                        {displayName(champion.championName)}
                      </div>
                      <div className="truncate text-[11px] tracking-[.1em] text-lol-text-muted">
                        {duels(champion).toLocaleString()} DUELS
                      </div>
                    </div>
                  </div>

                  <div className="relative h-2.5" style={{ background: "rgba(240,230,210,.05)" }}>
                    <div
                      className="absolute inset-y-0 left-0 transition-[width] duration-500 ease-out motion-reduce:transition-none"
                      style={{
                        width: `${lostPct}%`,
                        background: LOST_COLOR,
                        boxShadow: "0 0 10px rgba(201,138,163,.45)",
                      }}
                    />
                  </div>

                  <div
                    className="text-left font-display text-[16px]"
                    style={{ color: LOST_COLOR }}
                  >
                    {champion.duelsLost}
                  </div>

                  <div
                    className="text-right font-display text-[16px]"
                    style={{ color: share * 100 >= baseline ? WON_COLOR : LOST_COLOR }}
                  >
                    {pct(share)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </HextechPanel>
    </CategorySection>
  );
};

export { Versus };
