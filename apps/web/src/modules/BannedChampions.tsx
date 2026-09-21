"use client";

import { useMemo, useRef, useState } from "react";
import { motion, MotionConfig } from "motion/react";
import { cn } from "cn";
import type { BannedChampionsStats } from "@arena/types";
import { CategorySection } from "@/components/category-section";
import { HextechPanel } from "@/components/hextech-panel";
import { Dial } from "@/components/dial";
import { DiamondTabs } from "@/components/diamond-tabs";
import { PanelToolbar } from "@/components/panel-toolbar";
import { DetailBand } from "@/components/detail-band";
import { formatSignedPoints } from "@/components/delta-cell";
import { SidebarStatRows } from "@/components/sidebar-stat-row";
import { ValuePercentRow } from "@/components/sortable-stat-row";
import { TIER_STYLE, tierForBanRate } from "@/lib/tier-bars";
import { championIconUrl } from "@/lib/riot";
import { pressable } from "@/lib/a11y";
import { useDragScroll } from "@/hooks/use-drag-scroll";
import { useSectionInView } from "@/hooks/use-section-in-view";
import { useChampionName } from "@/lib/champion-names";
import { MIN_SAMPLE, isLowSample, sortByRate } from "@/lib/sample";
import { SortHeader } from "@/components/sort-header";
import { SECTION_BACKGROUNDS } from "@/lib/section-backgrounds";

type Props = {
  bannedChampions: BannedChampionsStats;
  /** The summoner's own top3-finish rate, used as the rail's baseline — the
   * same "win" definition `winRateWhenNotBanned` uses (see CLAUDE.md §2 and
   * `BannedChampionStats`'s doc comment), so they must come from the same
   * source or the rail lies. */
  top3Finishes: number;
  matchesPlayed: number;
};

/** The swing rail has no sort of its own: people click it to reach one end
 * of the rail, which is exactly what sorting by winrate does. */
type BanSort = "champion" | "rate" | "win";

/** The direction each column sorts in when you first click it: names read
 * A-Z, every number reads biggest-first. */
const NATURAL_DIR: Record<BanSort, "asc" | "desc"> = {
  champion: "asc",
  rate: "desc",
  win: "desc",
};

const SORT_LABEL: Record<BanSort, string> = {
  champion: "BY NAME",
  rate: "BY BAN RATE",
  win: "BY WIN %",
};

/** Sorts whose leading rows are a rate over a handful of games, so low-sample
 * rows rank last and render dimmed (see `lib/sample.ts`). */
const RATE_SORTS: readonly BanSort[] = ["win"];

/** Row geometry as real numbers (the rows' `py-1.25` around a 36px icon, and
 * the list's `gap-0.75`): the icon layer is positioned by `index * SLOT_PITCH`
 * rather than flowing with the rows — same split as `Damage.tsx`. */
const ROW_HEIGHT = 46;
const ROW_GAP = 3;
const SLOT_PITCH = ROW_HEIGHT + ROW_GAP;
const ICON_SIZE = 36;
const ROW_PADDING_X = 6;

/** Half-width of the swing rail, in px (the rail is 240px, baseline centered). */
const SWING_CLAMP = 108;
/** The rail's full-scale deflection never drops below this many percentage
 * points, so a page of tiny swings isn't blown up to look dramatic. It used
 * a fixed 17px per point, which pinned every swing beyond ±6.4% to the same
 * end of the rail. */
const MIN_SWING_SCALE_PP = 10;

/** "count | pct%" sidebar value — see `ValuePercentRow`. */
function CountPercentValue({ count, total }: { count: number; total: number }) {
  return (
    <ValuePercentRow
      value={count.toLocaleString()}
      pct={total > 0 ? (count / total) * 100 : 0}
      valueMinWidth="2.2em"
    />
  );
}

const BannedChampions = ({
  bannedChampions,
  top3Finishes,
  matchesPlayed,
}: Props) => {
  const [sort, setSort] = useState<BanSort>("rate");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  // Clicking the column the list is already sorted by flips it; clicking any
  // other column sorts by it in that column's natural direction.
  function sortBy(next: BanSort) {
    setDir((current) =>
      next === sort ? (current === "desc" ? "asc" : "desc") : NATURAL_DIR[next],
    );
    setSort(next);
  }

  const isRateSort = RATE_SORTS.includes(sort);
  const listRef = useRef<HTMLDivElement>(null);
  useDragScroll(listRef, "y");
  // Bars and swing rails start empty and grow in each time the slide is
  // scrolled to; they sit at their real values otherwise, so a re-sort tweens
  // each slot from its old champion's value to the new one's.
  const [layersRef, grown] = useSectionInView<HTMLDivElement>();
  const champions = bannedChampions.champions;
  const displayName = useChampionName();

  const baseline = matchesPlayed > 0 ? (top3Finishes / matchesPlayed) * 100 : 0;

  // Ban-rate rank is fixed per champion regardless of the active tab's sort
  // — it's "ranked by size" (see design_handoff_arena_panels/README.md,
  // "the tier-fill system"), not by whatever order BIGGEST SWING puts rows
  // in.
  const byBanRate = useMemo(
    () => [...champions].sort((a, b) => b.banRate - a.banRate),
    [champions],
  );
  const banRateRank = useMemo(
    () => new Map(byBanRate.map((c, i) => [c.championId, i])),
    [byBanRate],
  );

  // Winrates from a handful of games are noise, so they rank after every
  // champion with enough games behind the number (and render dimmed).
  const sorted = useMemo(() => {
    if (sort === "champion") {
      return [...champions].sort(
        (a, b) =>
          (dir === "asc" ? 1 : -1) *
          displayName(a.championName).localeCompare(
            displayName(b.championName),
          ),
      );
    }
    if (sort === "rate") {
      return dir === "desc" ? byBanRate : [...byBanRate].reverse();
    }
    // Champions nobody ever got to pick have no winrate to rank on, so they
    // sit at the end regardless of direction.
    const withRate = champions.filter((c) => c.winRateWhenNotBanned != null);
    const withoutRate = champions.filter((c) => c.winRateWhenNotBanned == null);
    return [
      ...sortByRate(
        withRate,
        (c) => c.winRateWhenNotBanned!,
        (c) => c.gamesOpenAndPicked,
        dir,
        "after",
      ),
      ...withoutRate,
    ];
  }, [champions, byBanRate, sort, dir, displayName]);

  const swingScalePp = Math.max(
    MIN_SWING_SCALE_PP,
    ...champions
      .filter((c) => c.winRateWhenNotBanned != null && !isLowSample(c.gamesOpenAndPicked))
      .map((c) => Math.ceil(Math.abs(c.winRateWhenNotBanned! - baseline))),
  );

  const rows = sorted;

  const [selectedChampionId, setSelectedChampionId] = useState<number | null>(
    () => rows[0]?.championId ?? null,
  );
  const selected =
    champions.find((c) => c.championId === selectedChampionId) ??
    rows[0] ??
    null;

  const fullyBanned = champions.filter(
    (c) => c.winRateWhenNotBanned == null,
  ).length;

  const modeCaption = `SORTED · ${SORT_LABEL[sort]}${
    isRateSort ? ` · UNDER ${MIN_SAMPLE} GAMES DIMMED` : ""
  }`;


  return (
    <CategorySection
      title="BANS"
      quote="More of a dog person, huh?"
      imageUrl={SECTION_BACKGROUNDS.bannedChampions}
      sidebar={
        <>
          <Dial
            value={bannedChampions.totalBans}
            label="TOTAL BANS"
            formatValue={(v) => v.toLocaleString()}
          />

          <div className="mt-auto">

            <SidebarStatRows
              rows={[
                {
                  label: "NO BAN",
                  value: (
                    <CountPercentValue
                      count={bannedChampions.noBanCount}
                      total={bannedChampions.totalBans + bannedChampions.noBanCount}
                    />
                  ),
                },
                {
                  label: "DUPLICATE BAN",
                  value: (
                    <CountPercentValue
                      count={bannedChampions.duplicateBanCount}
                      total={bannedChampions.totalBans}
                    />
                  ),
                },
                { label: "FULLY BANNED", value: fullyBanned.toLocaleString() },
              ]}
            />
          </div>
        </>
      }
    >
      <HextechPanel contentMinWidth={640}>
        <PanelToolbar
          caption={modeCaption}
        >
          <DiamondTabs
            tabs={[
              { key: "rate", label: "MOST BANNED" },
              { key: "win", label: "BEST WINRATE" },
            ]}
            active={sort}
            onChange={sortBy}
            label="Sort champions by"
          />
        </PanelToolbar>

        <div
          className="grid items-center gap-4 pb-2"
          style={{
            gridTemplateColumns: "36px 104px minmax(0,1fr) minmax(160px,240px) 62px",
            borderBottom: "1px solid rgba(200,170,110,.16)",
          }}
        >
          <div />
          <SortHeader
            active={sort === "champion"}
            dir={dir}
            onSort={() => sortBy("champion")}
          >
            CHAMPION
          </SortHeader>
          <SortHeader
            active={sort === "rate"}
            dir={dir}
            onSort={() => sortBy("rate")}
          >
            BAN RATE
          </SortHeader>
          <SortHeader
            active={sort === "win"}
            dir={dir}
            onSort={() => sortBy("win")}
            fill
            caret={false}
            className="tracking-[.18em]"
          >
            <span className="flex items-center justify-between">
              <span className="text-lol-garnet">−{swingScalePp}%</span>
              <span>YOUR {baseline.toFixed(0)}%</span>
              <span className="text-lol-blue-300">+{swingScalePp}%</span>
            </span>
          </SortHeader>
          <SortHeader
            active={sort === "win"}
            dir={dir}
            onSort={() => sortBy("win")}
            align="right"
          >
            WIN %
          </SortHeader>
        </div>

        <div
          ref={listRef}
          className="min-h-0 flex-1 overflow-y-auto py-1.5 pr-1"
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(200,170,110,.45) transparent",
          }}
        >
          {/*
           * Two decoupled layers, as in Damage.tsx: the row layer is keyed by
           * RANK, so a re-sort keeps each bar in place and tweens it to the
           * new champion's value; the icon layer is keyed by championId and
           * FLIPs each portrait to its new rank on top.
           */}
          <div
            ref={layersRef}
            className="relative flex-none"
            style={{ height: rows.length * SLOT_PITCH - ROW_GAP }}
          >
            {rows.map((champion, index) => {
              const tier = TIER_STYLE[tierForBanRate(champion.banRate)];
              const isSelected = champion.championId === selectedChampionId;
              const winRate = champion.winRateWhenNotBanned;
              const delta = winRate == null ? null : winRate - baseline;
              const dotLeft =
                delta == null || !grown
                  ? 120
                  : 120 +
                    Math.max(
                      -SWING_CLAMP,
                      Math.min(
                        SWING_CLAMP,
                        (delta / swingScalePp) * SWING_CLAMP,
                      ),
                    );
              const dotColor =
                delta == null
                  ? "transparent"
                  : delta >= 0
                    ? "#0ae0cf"
                    : "var(--color-lol-garnet)";

              return (
                <div
                  key={index}
                  {...pressable(
                    () => setSelectedChampionId(champion.championId),
                    {
                      pressed: isSelected,
                    },
                  )}
                  aria-label={`${displayName(champion.championName)}: banned in ${champion.banRate.toFixed(0)}% of games${
                    winRate == null
                      ? ""
                      : `, winrate when open ${winRate.toFixed(0)}% over ${champion.gamesOpenAndPicked} games`
                  }`}
                  className={cn(
                    "absolute inset-x-0 grid cursor-pointer items-center gap-4 px-1.5 transition-[background,opacity] duration-150",
                    isRateSort &&
                      isLowSample(champion.gamesOpenAndPicked) &&
                      "opacity-45",
                  )}
                  style={{
                    top: index * SLOT_PITCH,
                    height: ROW_HEIGHT,
                    gridTemplateColumns:
                      "36px 104px minmax(0,1fr) minmax(160px,240px) 62px",
                    background: isSelected
                      ? "rgba(200,170,110,.09)"
                      : "transparent",
                    boxShadow: isSelected
                      ? "inset 0 0 0 1px rgba(200,170,110,.45)"
                      : undefined,
                  }}
                >
                  {/* Icon sits in the layer above — this reserves its column. */}
                  <div />

                  <div className="font-body truncate text-[16px] text-lol-gold-50">
                    {displayName(champion.championName)}
                  </div>

                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className="relative h-3 flex-1 min-w-0"
                      style={{ background: "rgba(240,230,210,.05)" }}
                    >
                      <div
                        className={cn(
                          "h-3 transition-[width] duration-500 ease-out motion-reduce:transition-none",
                          tier.fillClass,
                        )}
                        style={{
                          width: grown ? `${champion.banRate}%` : "0%",
                          borderTop: `1px solid ${tier.edge}`,
                          boxShadow: tier.glow,
                        }}
                      />
                    </div>
                    <div className="w-10 flex-none font-display text-[15px] text-lol-text-secondary">
                      {champion.banRate.toFixed(0)}%
                    </div>
                  </div>

                  <div className="relative h-5.5 w-60">
                    <div
                      className="absolute inset-x-0"
                      style={{
                        top: 11,
                        height: 1,
                        background: "rgba(240,230,210,.07)",
                      }}
                    />
                    <div
                      className="absolute"
                      style={{
                        left: 120,
                        top: 2,
                        width: 1,
                        height: 18,
                        background: "rgba(200,170,110,.45)",
                      }}
                    />
                    {delta != null ? (
                      <div
                        className="absolute transition-[left,width] duration-500 ease-out motion-reduce:transition-none"
                        style={{
                          top: 11,
                          height: 1,
                          left: Math.min(120, dotLeft),
                          width: Math.abs(dotLeft - 120),
                          background: dotColor,
                        }}
                      />
                    ) : null}
                    <div
                      className="absolute h-1.75 w-1.75 rotate-45 transition-[left,opacity] duration-500 ease-out motion-reduce:transition-none"
                      style={{
                        left: dotLeft - 3.5,
                        top: 8,
                        background: dotColor,
                        opacity: delta == null ? 0 : 1,
                      }}
                    />
                  </div>

                  <div className="text-right font-display text-[16px] text-lol-text-secondary">
                    {winRate == null ? (
                      <span className="text-lol-text-disabled">—</span>
                    ) : (
                      `${winRate.toFixed(0)}%`
                    )}
                  </div>
                </div>
              );
            })}

            <MotionConfig
              transition={{
                type: "spring",
                stiffness: 450,
                damping: 25,
                mass: 0.8,
              }}
            >
              {rows.map((champion, index) => (
                <motion.div
                  key={champion.championId}
                  layout="position"
                  aria-hidden
                  onClick={() => setSelectedChampionId(champion.championId)}
                  className={cn(
                    "absolute cursor-pointer overflow-hidden transition-opacity duration-150",
                    // The row's dimming doesn't reach this separate layer.
                    isRateSort &&
                      isLowSample(champion.gamesOpenAndPicked) &&
                      "opacity-45",
                  )}
                  style={{
                    left: ROW_PADDING_X,
                    top: index * SLOT_PITCH + (ROW_HEIGHT - ICON_SIZE) / 2,
                    width: ICON_SIZE,
                    height: ICON_SIZE,
                  }}
                >
                  <img
                    loading="lazy"
                    decoding="async"
                    src={championIconUrl(champion.championName)}
                    alt=""
                    width={ICON_SIZE}
                    height={ICON_SIZE}
                    className="h-full w-full"
                  />
                </motion.div>
              ))}
            </MotionConfig>
          </div>
        </div>

        <div className="mt-2 text-[11px] leading-relaxed text-lol-text-muted tracking-[.26em]">
          WIN % = YOUR WINRATE IN GAMES WHERE THE CHAMPION WAS NOT BANNED AND
          SOMEONE PICKED IT. THE RAIL SHOWS HOW FAR THAT SITS FROM YOUR OVERALL{" "}
          {baseline.toFixed(0)}%.
        </div>

        {selected ? (
          <DetailBand
            icon={
              <div className="relative flex-none">
                <img
                  loading="lazy"
                  decoding="async"
                  src={championIconUrl(selected.championName)}
                  alt=""
                  width={62}
                  height={62}
                  className="block border border-[rgba(200,170,110,.6)] object-cover"
                />
                <div
                  className="absolute -top-1.25 -left-1.25 h-2.25 w-2.25 rotate-45 bg-[#040c14]"
                  style={{ border: "1px solid rgba(200,170,110,.8)" }}
                />
                <div
                  className="absolute -right-1.25 -bottom-1.25 h-2.25 w-2.25 rotate-45 bg-[#040c14]"
                  style={{ border: "1px solid rgba(200,170,110,.8)" }}
                />
              </div>
            }
            title={displayName(selected.championName)}
            subtitle={`${selected.totalBans.toLocaleString()} BANS`}
            stats={[
              {
                label: "BAN RATE",
                value: `${selected.banRate.toFixed(0)}%`,
                highlight: true,
                bordered: false,
              },
              {
                label: "BAN RANK",
                value: `#${(banRateRank.get(selected.championId) ?? 0) + 1}`,
              },
              {
                label: "TIMES AVAILABLE",
                value: `${Math.round(
                  matchesPlayed * (1 - selected.banRate / 100),
                ).toLocaleString()}`,
                nowrap: true,
              },
              {
                label: "WINRATE WHEN OPEN",
                value:
                  selected.winRateWhenNotBanned == null
                    ? "—"
                    : `${selected.winRateWhenNotBanned.toFixed(0)}% · ${selected.gamesOpenAndPicked}G`,
                nowrap: true,
              },
              {
                label: "VS BASELINE",
                value:
                  selected.winRateWhenNotBanned == null
                    ? "—"
                    : formatSignedPoints(
                        selected.winRateWhenNotBanned - baseline,
                      ),
                nowrap: true,
              },
            ]}
          />
        ) : null}
      </HextechPanel>
    </CategorySection>
  );
};

export { BannedChampions };
