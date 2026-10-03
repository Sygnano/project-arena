"use client";

import type { AbilityStats, ChampionStats } from "@arena/types";
import { cn } from "cn";
import { MotionConfig, motion } from "motion/react";
import { useMemo, useRef, useState } from "react";
import { DetailBand } from "@/components/detail-band";
import { Dial } from "@/components/dial";
import { DiamondTabs } from "@/components/diamond-tabs";
import { HextechPanel } from "@/components/hextech-panel";
import { PanelToolbar, ToolbarDivider } from "@/components/panel-toolbar";
import { SidebarStatRows } from "@/components/sidebar-stat-rows";
import { SortHeaderLabel } from "@/components/sort-header-label";
import { ValuePercentRow } from "@/components/value-percent-row";
import { CategorySection } from "@/features/recap/components/category-section";
import { DossierLink } from "@/features/recap/components/dossier-link";
import { LowSampleSwitch } from "@/features/recap/components/low-sample-switch";
import { useChampionName } from "@/features/recap/stores/champion-names";
import { perGame } from "@/features/recap/utils/per-game";
import { isLowSample, MIN_SAMPLE, sortByRate } from "@/features/recap/utils/sample";
import { SECTION_BACKGROUNDS } from "@/features/recap/utils/section-backgrounds";
import { useDragScroll } from "@/hooks/use-drag-scroll";
import { pressable } from "@/utils/a11y";
import { formatCompact } from "@/utils/format";
import { championIconUrl } from "@/utils/riot";
import {
  BREAKDOWN_KEYS,
  COLORS,
  ICON_SIZE,
  METRIC_LABEL,
  METRICS,
  ROW_GAP,
  ROW_HEIGHT,
  ROW_PADDING_X,
  SLOT_PITCH,
} from "./constants";
import type { Metric, Mode, Row, SortDir } from "./types";
import { barWidthPercent, columnValue, segmentOrder, sumBreakdown } from "./utils";

type Props = {
  ability: AbilityStats;
  champions: Record<number, ChampionStats>;
};

/**
 * Ability — rebuilt on the exact same row-list template as Damage/DamageTaken
 * (see that module's doc comment): a stacked Q/W/E/R bar per champion
 * (tallying to the total shown at its right) plus four plain value columns
 * for the exact per-spell cast counts. TOTAL/BEST GAME and TOTAL/Q/W/E/R
 * tabs, sortable columns, a selected-champion detail band — all identical
 * behavior to Damage, just Q/W/E/R cast counts in place of physical/magical/
 * true damage.
 */
const Ability = ({ ability, champions }: Props) => {
  const [mode, setMode] = useState<Mode>("total");
  const displayName = useChampionName();
  const [metric, setMetric] = useState<Metric>("total");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  // PER GAME: rank champions under MIN_SAMPLE games with the rest (still dimmed).
  const [mixLowSample, setMixLowSample] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  useDragScroll(listRef, "y");

  // Clicking the already-active column flips direction; picking a new one
  // (from a header or the metric tabs) always starts descending.
  const sortBy = (m: Metric) => {
    if (m === metric) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setMetric(m);
      setSortDir("desc");
    }
  };

  const roster = useMemo<Row[]>(
    () =>
      Object.values(champions).map((champion) => {
        const championAbility = champion.ability;
        return {
          championId: champion.championId,
          championName: champion.championName,
          matchesPlayed: champion.matchesPlayed,
          active:
            mode === "best"
              ? championAbility.maxGame
              : mode === "perGame"
                ? perGame(championAbility.total, champion.matchesPlayed)
                : championAbility.total,
          activeByType:
            mode === "best"
              ? championAbility.maxGame
              : mode === "perGame"
                ? perGame(championAbility.total, champion.matchesPlayed)
                : championAbility.total,
          seasonTotal: championAbility.total,
          bestGame: championAbility.maxGame,
        };
      }),
    [champions, mode],
  );

  const rows = useMemo(() => {
    // Per-game averages from a handful of games are noise: they rank after
    // every champion with enough games, and render dimmed.
    if (mode === "perGame") {
      return sortByRate(
        roster,
        (row) => columnValue(row, metric),
        (row) => row.matchesPlayed,
        sortDir,
        mixLowSample ? "mixed" : "after",
      );
    }
    const dirSign = sortDir === "desc" ? 1 : -1;
    return [...roster].sort((a, b) => dirSign * (columnValue(b, metric) - columnValue(a, metric)));
  }, [roster, metric, sortDir, mode, mixLowSample]);

  const [selectedChampionId, setSelectedChampionId] = useState<number | null>(() => rows[0]?.championId ?? null);
  const selected = roster.find((r) => r.championId === selectedChampionId) ?? rows[0] ?? null;

  // Scale from champions with enough games in PER GAME mode, so a dimmed
  // one-game outlier can't shrink every trustworthy bar (widths clamp at 100%).
  // Mixed in by the viewer, they scale too, or they'd all clamp to 100%.
  const scaleRows = mode === "perGame" && !mixLowSample ? rows.filter((r) => !isLowSample(r.matchesPlayed)) : rows;
  const maxMetricValue = Math.max(1, ...(scaleRows.length > 0 ? scaleRows : rows).map((r) => columnValue(r, metric)));
  const seasonGrandTotal = sumBreakdown(ability.total);
  const totalGames = Object.values(champions).reduce((sum, c) => sum + c.matchesPlayed, 0);
  const dialValue = sumBreakdown(
    mode === "best" ? ability.maxGame : mode === "perGame" ? perGame(ability.total, totalGames) : ability.total,
  );
  // Same "no independent per-key best" caveat as `Row.activeByType` — BEST
  // mode's sidebar breakdown is just the one best-total-casts match's
  // numbers, not each spell's own all-time high.
  const sidebarBreakdown =
    mode === "best" ? ability.maxGame : mode === "perGame" ? perGame(ability.total, totalGames) : ability.total;

  const modeCaption =
    mode === "perGame"
      ? `PER GAME · UNDER ${MIN_SAMPLE} GAMES DIMMED`
      : mode === "total"
        ? "ALL GAMES"
        : "BEST SINGLE GAME";

  // Percentages only make sense against a real total (TOTAL mode) — see
  // `ValuePercentRow`'s doc comment for why BEST GAME skips them.
  const sidebarTotal = sumBreakdown(sidebarBreakdown);
  const sidebarRow = (label: string, value: number) => ({
    label,
    value:
      mode !== "best" ? (
        <ValuePercentRow value={formatCompact(value)} pct={sidebarTotal > 0 ? (value / sidebarTotal) * 100 : 0} />
      ) : (
        formatCompact(value)
      ),
  });

  return (
    <CategorySection
      title="ABILITIES"
      quote="I'll take this one, and this one, and—throw it in your face!"
      imageUrl={SECTION_BACKGROUNDS.ability}
      sidebar={
        <>
          <Dial
            value={dialValue}
            label={`${mode === "perGame" ? "PER GAME" : mode === "total" ? "TOTAL" : "BEST"} CASTS`}
            labelPosition="bottom"
            formatValue={formatCompact}
          />

          <div className="mt-auto">
            <SidebarStatRows
              rows={[
                sidebarRow("Q", sidebarBreakdown.q),
                sidebarRow("W", sidebarBreakdown.w),
                sidebarRow("E", sidebarBreakdown.e),
                sidebarRow("R", sidebarBreakdown.r),
              ]}
            />
          </div>
        </>
      }
    >
      <HextechPanel contentMinWidth={700}>
        <PanelToolbar
          caption={`${modeCaption} · SORTED · BY ${METRIC_LABEL[metric]}`}
          trailing={mode === "perGame" ? <LowSampleSwitch checked={mixLowSample} onChange={setMixLowSample} /> : null}
        >
          <DiamondTabs
            tabs={[
              { key: "total", label: "TOTAL" },
              { key: "best", label: "BEST GAME" },
              { key: "perGame", label: "PER GAME" },
            ]}
            active={mode}
            onChange={setMode}
          />
          <ToolbarDivider />
          <DiamondTabs
            tabs={METRICS.map((m) => ({ key: m, label: METRIC_LABEL[m] }))}
            active={metric}
            onChange={sortBy}
            gap={18}
          />
        </PanelToolbar>

        <div
          className="grid items-center gap-4 pb-2 pl-1.5 pr-2.5"
          style={{
            gridTemplateColumns: "36px 104px minmax(0,1fr) 60px 60px 60px 60px",
            borderBottom: "1px solid rgba(200,170,110,.16)",
          }}
        >
          <div />
          <div className="text-[11px] tracking-[.22em] text-[#a09b8c]">CHAMPION</div>
          <button
            type="button"
            onClick={() => sortBy("total")}
            className="cursor-pointer text-right select-none hover:text-lol-gold-100"
            style={{
              color: metric === "total" ? "var(--color-lol-gold-50)" : "#a09b8c",
            }}
          >
            <SortHeaderLabel label="TOTAL CASTS" active={metric === "total"} dir={sortDir} />
          </button>
          {BREAKDOWN_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => sortBy(key)}
              className="cursor-pointer text-right select-none hover:opacity-100"
              style={{
                color: COLORS[key],
                opacity: metric === key ? 1 : 0.55,
              }}
            >
              <SortHeaderLabel label={METRIC_LABEL[key]} active={metric === key} dir={sortDir} />
            </button>
          ))}
        </div>

        {rows.length === 0 ? (
          <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-lol-text-muted">
            No tracked matches yet.
          </div>
        ) : (
          <div
            ref={listRef}
            className="min-h-0 flex-1 overflow-y-auto py-1.5 pr-1"
            style={{
              scrollbarWidth: "thin",
              scrollbarColor: "rgba(200,170,110,.45) transparent",
            }}
          >
            <div className="relative" style={{ height: rows.length * SLOT_PITCH - ROW_GAP }}>
              {rows.map((row, index) => {
                const isSelected = row.championId === selectedChampionId;
                const total = sumBreakdown(row.active);
                const barWidthPct = barWidthPercent(columnValue(row, metric), maxMetricValue);

                return (
                  <div
                    key={index}
                    {...pressable(() => setSelectedChampionId(row.championId), {
                      pressed: isSelected,
                    })}
                    aria-label={`${displayName(row.championName)}, ${row.matchesPlayed} games`}
                    className={cn(
                      "absolute inset-x-0 grid cursor-pointer items-center gap-4 px-1.5 transition-[background,opacity] duration-150",
                      mode === "perGame" && isLowSample(row.matchesPlayed) && "opacity-45",
                    )}
                    style={{
                      top: index * SLOT_PITCH,
                      height: ROW_HEIGHT,
                      gridTemplateColumns: "36px 104px minmax(0,1fr) 60px 60px 60px 60px",
                      background: isSelected ? "rgba(200,170,110,.09)" : "transparent",
                      boxShadow: isSelected ? "inset 0 0 0 1px rgba(200,170,110,.45)" : undefined,
                    }}
                  >
                    {/* Icon sits in the layer above — this reserves its column. */}
                    <div />

                    <div className="font-body truncate text-[16px] text-lol-gold-50">
                      {displayName(row.championName)}
                    </div>

                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className="relative h-3 min-w-0 flex-1 overflow-hidden"
                        style={{ background: "rgba(240,230,210,.05)" }}
                      >
                        <div
                          className="absolute inset-y-0 left-0 flex transition-[width] duration-300 ease-out"
                          style={{ width: `${barWidthPct}%` }}
                        >
                          {metric === "total" ? (
                            segmentOrder(metric).map((key) => (
                              <div
                                key={key}
                                className="h-full transition-[width] duration-300 ease-out"
                                style={{
                                  width: total > 0 ? `${(row.active[key] / total) * 100}%` : 0,
                                  background: COLORS[key],
                                }}
                              />
                            ))
                          ) : (
                            <div className="h-full w-full" style={{ background: COLORS[metric] }} />
                          )}
                        </div>
                      </div>
                      <div
                        className="w-16 flex-none text-right font-display text-[15px]"
                        style={{
                          color: metric === "total" ? "var(--color-lol-gold-50)" : "var(--color-lol-text-secondary)",
                        }}
                      >
                        {formatCompact(total)}
                      </div>
                    </div>

                    {BREAKDOWN_KEYS.map((key) => (
                      <div
                        key={key}
                        className="text-right font-display text-[15px]"
                        style={{
                          color: COLORS[key],
                          opacity: metric === key ? 1 : 0.55,
                        }}
                      >
                        {formatCompact(row.activeByType[key])}
                      </div>
                    ))}
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
                {rows.map((row, index) => (
                  <motion.div
                    key={row.championId}
                    layout="position"
                    aria-hidden
                    onClick={() => setSelectedChampionId(row.championId)}
                    className="absolute cursor-pointer overflow-hidden"
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
                      src={championIconUrl(row.championName)}
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
        )}

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
            action={<DossierLink championId={selected.championId} />}
            subtitle={`${selected.matchesPlayed.toLocaleString()} GAMES`}
            stats={[
              {
                label: `${mode === "perGame" ? "PER GAME" : mode === "total" ? "TOTAL" : "BEST"} CASTS`,
                value: formatCompact(sumBreakdown(selected.active)),
                highlight: true,
                bordered: false,
              },
              {
                label: "% OF TOTAL",
                value:
                  seasonGrandTotal > 0
                    ? `${((sumBreakdown(selected.seasonTotal) / seasonGrandTotal) * 100).toFixed(1)}%`
                    : "—",
              },
              { label: "Q", value: formatCompact(selected.active.q) },
              { label: "W", value: formatCompact(selected.active.w) },
              { label: "E", value: formatCompact(selected.active.e) },
              { label: "R", value: formatCompact(selected.active.r) },
              {
                label: "BEST GAME",
                value: formatCompact(sumBreakdown(selected.bestGame)),
                nowrap: true,
              },
            ]}
          />
        ) : null}
      </HextechPanel>
    </CategorySection>
  );
};

export { Ability };
