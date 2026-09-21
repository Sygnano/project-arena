"use client";

import { useMemo, useRef, useState } from "react";
import { cn } from "cn";
import { motion, MotionConfig } from "motion/react";
import type { ChampionStats, DamageBreakdown, DamageStats } from "@arena/types";
import { CategorySection } from "@/components/category-section";
import { HextechPanel } from "@/components/hextech-panel";
import { Dial } from "@/components/dial";
import { DiamondTabs } from "@/components/diamond-tabs";
import { PanelToolbar, ToolbarDivider } from "@/components/panel-toolbar";
import { LowSampleSwitch } from "@/components/low-sample-switch";
import { DetailBand } from "@/components/detail-band";
import { SidebarStatRows } from "@/components/sidebar-stat-row";
import { ValuePercentRow, SortHeaderLabel } from "@/components/sortable-stat-row";
import { championIconUrl } from "@/lib/riot";
import { DAMAGE_TYPE_COLORS } from "@/lib/damage-types";
import { formatCompact } from "@/lib/format";
import { pressable } from "@/lib/a11y";
import { useDragScroll } from "@/hooks/use-drag-scroll";
import { useChampionName } from "@/lib/champion-names";
import { DossierLink } from "@/lib/champion-dossier";
import { perGame } from "@/lib/per-game";
import { MIN_SAMPLE, isLowSample, sortByRate } from "@/lib/sample";
import { SECTION_BACKGROUNDS } from "@/lib/section-backgrounds";

type Props = {
  /** Which damage stats this section shows — `"dealt"` (default) or
   * `"taken"`. Selects both the per-champion field read off `ChampionStats`
   * (`.damage` vs `.damageTaken` — same shape either way) and every derived
   * label (title, quote, dial caption, detail-band header); everything else
   * about this component is variant-agnostic. See `DamageTaken.tsx`'s thin
   * wrapper for the "taken" call site. */
  variant?: "dealt" | "taken";
  damage: DamageStats;
  champions: Record<number, ChampionStats>;
  /** Shown as an extra sidebar row alongside PHYSICAL/MAGICAL/TRUE, following
   * the TOTAL / BEST GAME / PER GAME tabs. Skillshots landed for `"dealt"`,
   * skillshots dodged for `"taken"` — each only makes sense paired with its
   * matching damage direction. */
  skillshots?: { total: number; best: number };
};

type Mode = "perGame" | "total" | "best";
type Metric = "total" | "physical" | "magical" | "trueDamage";

const METRICS: Metric[] = ["total", "physical", "magical", "trueDamage"];
const METRIC_LABEL: Record<Metric, string> = {
  total: "TOTAL",
  physical: "PHYSICAL",
  magical: "MAGICAL",
  trueDamage: "TRUE",
};

/** Local alias for the shared palette (see `lib/damage-types.ts`) — kept so
 * this file's many `COLORS.physical` references read unchanged. */
const COLORS = DAMAGE_TYPE_COLORS;

function sumBreakdown(breakdown: DamageBreakdown): number {
  return breakdown.physical + breakdown.magical + breakdown.trueDamage;
}

/** Maps a row's value, relative to the top row's, onto a bar width — plain
 * linear scaling (ratio * 100) makes anything short of the leader look
 * disproportionately tiny (a third of the top damage would draw as a
 * 33%-wide bar), so the ratio is raised to a fractional power first: that
 * still pins 0 -> 0% and 1 (the leader) -> 100%, but compresses the low end
 * upward, so real gaps still read as gaps without every non-leader bar
 * looking crushed against the axis. */
// Linear (exponent 1): bar length is proportional to the value. An earlier
// 0.55 power drew a third of the leader at ~55% width, which read as a much
// closer race than the numbers are.
const BAR_WIDTH_EXPONENT = 1;
function barWidthPercent(value: number, max: number): number {
  if (max <= 0) return 0;
  const ratio = Math.min(1, Math.max(0, value / max));
  return Math.pow(ratio, BAR_WIDTH_EXPONENT) * 100;
}

type Row = {
  championId: number;
  championName: string;
  matchesPlayed: number;
  /** Mode-dependent: the season total, the per-game average, or in "best"
   * mode one single game — the top total game, or when sorted by one type the
   * game where that type peaked (`bestGameByType`). Drives the bar and every
   * column, so they always sum to one real total. */
  active: DamageBreakdown;
  seasonTotal: DamageBreakdown;
  bestGame: DamageBreakdown;
};

function columnValue(row: Row, metric: Metric): number {
  return metric === "total"
    ? sumBreakdown(row.active)
    : row.active[metric];
}

type SortDir = "asc" | "desc";

const BREAKDOWN_KEYS = ["physical", "magical", "trueDamage"] as const;

/** The stacked bar's segment draw order — normally physical/magical/true,
 * but when sorting by one of those specifically, that type's segment leads
 * (leftmost) so the bar visually reads left-to-right in the same order the
 * list is sorted by. */
function segmentOrder(
  metric: Metric,
): readonly (typeof BREAKDOWN_KEYS)[number][] {
  if (metric === "total") return BREAKDOWN_KEYS;
  return [metric, ...BREAKDOWN_KEYS.filter((k) => k !== metric)];
}

/** Row height and the list's fixed slot pitch (row height + inter-row gap),
 * in px — matches the row's own `py-1.25` (5px) padding around a 36px icon
 * and the list's `gap-0.75` (3px). Needed as real numbers (not just Tailwind
 * classes) because the icon overlay below is positioned by `index * SLOT_PITCH`
 * rather than participating in normal document flow. */
const ROW_HEIGHT = 46;
const ROW_GAP = 3;
const SLOT_PITCH = ROW_HEIGHT + ROW_GAP;
const ICON_SIZE = 36;
const ROW_PADDING_X = 6;

/**
 * Rebuilt on the same row-list template as `BannedChampions` (see
 * design_handoff_arena_panels/README.md, "the tier-fill system" and CLAUDE.md's
 * component layering notes) rather than the earlier dealt/taken mirrored bar
 * chart — a stacked physical/magical/true bar per champion (tallying to the
 * total shown at its right, the same slot ban rate's % occupied) plus three
 * plain value columns for the exact per-type numbers. Serves both the
 * DAMAGE and DAMAGE TAKEN sections (see `variant` on `Props`) rather than
 * the old separate mirrored-chart component, since the two are otherwise
 * identical down to the sort/motion behavior.
 */
const Damage = ({
  variant = "dealt",
  damage,
  champions,
  skillshots,
}: Props) => {
  const dmgWord = variant === "taken" ? "TAKEN" : "DMG";
  const [mode, setMode] = useState<Mode>("total");
  const displayName = useChampionName();
  const [metric, setMetric] = useState<Metric>("total");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  // PER GAME only: rank champions under MIN_SAMPLE games together with the
  // rest instead of after them. They stay dimmed either way.
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
        const championDamage =
          variant === "taken" ? champion.damageTaken : champion.damage;
        return {
          championId: champion.championId,
          championName: champion.championName,
          matchesPlayed: champion.matchesPlayed,
          active:
            mode === "best"
              ? metric === "total"
                ? championDamage.maxGame
                : championDamage.bestGameByType[metric]
              : mode === "perGame"
                ? perGame(championDamage.total, champion.matchesPlayed)
                : championDamage.total,
          seasonTotal: championDamage.total,
          bestGame: championDamage.maxGame,
        };
      }),
    [champions, mode, variant, metric],
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
    return [...roster].sort(
      (a, b) => dirSign * (columnValue(b, metric) - columnValue(a, metric)),
    );
  }, [roster, metric, sortDir, mode, mixLowSample]);

  const [selectedChampionId, setSelectedChampionId] = useState<number | null>(
    () => rows[0]?.championId ?? null,
  );
  const selected =
    roster.find((r) => r.championId === selectedChampionId) ?? rows[0] ?? null;

  // Drives the big bar's scale: the stacked total when showing TOTAL, or just
  // that one type's own max when a specific PHYS/MAGIC/TRUE column is active
  // — so e.g. sorting by Magic makes the top magic damage dealer's bar read
  // as 100%, not as "however much of their total damage happened to be
  // magic."
  // Scale from champions with enough games in PER GAME mode, so a dimmed
  // one-game outlier can't shrink every trustworthy bar (widths clamp at 100%).
  // Mixed in by the viewer, they scale too, or they'd all clamp to 100%.
  const scaleRows =
    mode === "perGame" && !mixLowSample
      ? rows.filter((r) => !isLowSample(r.matchesPlayed))
      : rows;
  const maxMetricValue = Math.max(
    1,
    ...(scaleRows.length > 0 ? scaleRows : rows).map((r) => columnValue(r, metric)),
  );
  const seasonGrandTotal = sumBreakdown(damage.total);
  const totalGames = Object.values(champions).reduce((sum, c) => sum + c.matchesPlayed, 0);
  // In "best" mode: the one game the grid's columns come from (see
  // `Row.active`) — the top total game, or the top game for the sorted type.
  const sidebarBreakdown =
    mode === "best"
      ? metric === "total"
        ? damage.maxGame
        : damage.bestGameByType[metric]
      : mode === "perGame"
        ? perGame(damage.total, totalGames)
        : damage.total;
  const dialValue = sumBreakdown(sidebarBreakdown);

  const modeCaption =
    mode === "perGame"
      ? `PER GAME · UNDER ${MIN_SAMPLE} GAMES DIMMED`
      : mode === "total"
        ? "ALL GAMES"
        : metric === "total"
          ? "BEST SINGLE GAME"
          : `BEST SINGLE ${METRIC_LABEL[metric]} GAME`;

  // Every mode's breakdown is one real total (a single game in BEST GAME),
  // so the percentages always add up.
  const sidebarTotal = sumBreakdown(sidebarBreakdown);
  const sidebarRow = (label: string, value: number) => ({
    label,
    value: (
      <ValuePercentRow
        value={formatCompact(value)}
        pct={sidebarTotal > 0 ? (value / sidebarTotal) * 100 : 0}
      />
    ),
  });

  return (
    <CategorySection
      title={variant === "taken" ? "DMG TAKEN" : "DMG DEALT"}
      quote={
        variant === "taken"
          ? "Next time, try to leave a dent!"
          : "Whatever, let's just start shooting!"
      }
      imageUrl={variant === "taken" ? SECTION_BACKGROUNDS.damageTaken : SECTION_BACKGROUNDS.damage}
      sidebar={
        <>
          <Dial
            value={dialValue}
            label={`${mode === "perGame" ? "PER GAME" : mode === "total" ? "TOTAL" : "BEST"} ${dmgWord}`}
            labelPosition="bottom"
            formatValue={formatCompact}
          />

          <div className="mt-auto">
            <SidebarStatRows
              rows={[
                sidebarRow("PHYSICAL", sidebarBreakdown.physical),
                sidebarRow("MAGICAL", sidebarBreakdown.magical),
                sidebarRow("TRUE", sidebarBreakdown.trueDamage),
                ...(skillshots
                  ? [
                      {
                        label: variant === "taken" ? "SKILLSHOTS DODGED" : "SKILLSHOTS HIT",
                        value:
                          mode === "best"
                            ? skillshots.best.toLocaleString()
                            : mode === "perGame"
                              ? (totalGames > 0 ? skillshots.total / totalGames : 0).toLocaleString(
                                  undefined,
                                  { maximumFractionDigits: 1 },
                                )
                              : skillshots.total.toLocaleString(),
                      },
                    ]
                  : []),
              ]}
            />
          </div>
        </>
      }
    >
      <HextechPanel contentMinWidth={700}>
        <PanelToolbar
          caption={`${modeCaption} · SORTED · BY ${METRIC_LABEL[metric]}`}
          trailing={
            mode === "perGame" ? (
              <LowSampleSwitch
                checked={mixLowSample}
                onChange={setMixLowSample}
              />
            ) : null
          }
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
          // pl-1.5/pr-2.5 (6px/10px), not a symmetric px-1.5: the scrollable
          // rows below sit inside a container with its own `pr-1` (4px)
          // scrollbar gutter on top of each row's own `px-1.5` (6px) inset,
          // so a row's actual right edge is 10px in from the panel edge
          // while its left edge is only 6px in — matching that asymmetry
          // here is what makes this header's fixed-width PHYS/MAGIC/TRUE
          // columns land exactly above the same columns in every row.
          className="grid items-center gap-4 pb-2 pl-1.5 pr-2.5"
          style={{
            gridTemplateColumns: "36px 104px minmax(0,1fr) 76px 76px 76px",
            borderBottom: "1px solid rgba(200,170,110,.16)",
          }}
        >
          <div />
          <div className="text-[11px] tracking-[.22em] text-[#a09b8c]">
            CHAMPION
          </div>
          <button
            type="button"
            onClick={() => sortBy("total")}
            className="cursor-pointer text-right select-none hover:text-lol-gold-100"
            style={{
              color:
                metric === "total" ? "var(--color-lol-gold-50)" : "#a09b8c",
            }}
          >
            <SortHeaderLabel
              label={variant === "taken" ? "TOTAL TAKEN" : "TOTAL DAMAGE"}
              active={metric === "total"}
              dir={sortDir}
            />
          </button>
          <button
            type="button"
            onClick={() => sortBy("physical")}
            className="cursor-pointer text-right select-none hover:opacity-100"
            style={{
              color: COLORS.physical,
              opacity: metric === "physical" ? 1 : 0.55,
            }}
          >
            <SortHeaderLabel
              label="PHYS"
              active={metric === "physical"}
              dir={sortDir}
            />
          </button>
          <button
            type="button"
            onClick={() => sortBy("magical")}
            className="cursor-pointer text-right select-none hover:opacity-100"
            style={{
              color: COLORS.magical,
              opacity: metric === "magical" ? 1 : 0.55,
            }}
          >
            <SortHeaderLabel
              label="MAGIC"
              active={metric === "magical"}
              dir={sortDir}
            />
          </button>
          <button
            type="button"
            onClick={() => sortBy("trueDamage")}
            className="cursor-pointer text-right select-none hover:opacity-100"
            style={{
              color: COLORS.trueDamage,
              opacity: metric === "trueDamage" ? 1 : 0.55,
            }}
          >
            <SortHeaderLabel
              label="TRUE"
              active={metric === "trueDamage"}
              dir={sortDir}
            />
          </button>
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
            {/*
             * Two decoupled layers over one fixed-height relative container —
             * same split HextechBarChart uses (see its doc comment): a
             * re-sort should read as "these champions swapped rank," not as
             * every bar sliding sideways underneath its own icon. So the
             * slot layer below is keyed by RANK (index), not championId —
             * a re-sort just changes which champion's numbers a given slot
             * renders, and the bar's width/segments tween to the new values
             * in place via plain CSS transitions, never moving position. The
             * icon layer, keyed by championId with Motion's `layout="position"`,
             * is what actually animates — it FLIPs to each icon's new rank
             * on top of the (positionally static) slots underneath.
             */}
            <div
              className="relative"
              style={{ height: rows.length * SLOT_PITCH - ROW_GAP }}
            >
              {rows.map((row, index) => {
                const isSelected = row.championId === selectedChampionId;
                const total = sumBreakdown(row.active);
                const barWidthPct = barWidthPercent(
                  columnValue(row, metric),
                  maxMetricValue,
                );

                return (
                  <div
                    key={index}
                    {...pressable(() => setSelectedChampionId(row.championId), { pressed: isSelected })}
                    aria-label={`${displayName(row.championName)}, ${row.matchesPlayed} games`}
                    className={cn(
                      "absolute inset-x-0 grid cursor-pointer items-center gap-4 px-1.5 transition-[background,opacity] duration-150",
                      mode === "perGame" && isLowSample(row.matchesPlayed) && "opacity-45",
                    )}
                    style={{
                      top: index * SLOT_PITCH,
                      height: ROW_HEIGHT,
                      gridTemplateColumns:
                        "36px 104px minmax(0,1fr) 76px 76px 76px",
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
                                  width:
                                    total > 0
                                      ? `${(row.active[key] / total) * 100}%`
                                      : 0,
                                  background: COLORS[key],
                                }}
                              />
                            ))
                          ) : (
                            <div
                              className="h-full w-full"
                              style={{ background: COLORS[metric] }}
                            />
                          )}
                        </div>
                      </div>
                      <div
                        className="w-16 flex-none text-right font-display text-[15px]"
                        style={{
                          color:
                            metric === "total"
                              ? "var(--color-lol-gold-50)"
                              : "var(--color-lol-text-secondary)",
                        }}
                      >
                        {formatCompact(total)}
                      </div>
                    </div>

                    <div
                      className="text-right font-display text-[15px]"
                      style={{
                        color: COLORS.physical,
                        opacity: metric === "physical" ? 1 : 0.55,
                      }}
                    >
                      {formatCompact(row.active.physical)}
                    </div>
                    <div
                      className="text-right font-display text-[15px]"
                      style={{
                        color: COLORS.magical,
                        opacity: metric === "magical" ? 1 : 0.55,
                      }}
                    >
                      {formatCompact(row.active.magical)}
                    </div>
                    <div
                      className="text-right font-display text-[15px]"
                      style={{
                        color: COLORS.trueDamage,
                        opacity: metric === "trueDamage" ? 1 : 0.55,
                      }}
                    >
                      {formatCompact(row.active.trueDamage)}
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
                label: `${mode === "perGame" ? "PER GAME" : mode === "total" ? "TOTAL" : "BEST"} ${dmgWord}`,
                value: formatCompact(sumBreakdown(selected.active)),
                highlight: true,
                bordered: false,
              },
              {
                label: "% OF ALL",
                value:
                  seasonGrandTotal > 0
                    ? `${((sumBreakdown(selected.seasonTotal) / seasonGrandTotal) * 100).toFixed(1)}%`
                    : "—",
              },
              {
                label: "PHYSICAL",
                value: formatCompact(selected.active.physical),
              },
              {
                label: "MAGICAL",
                value: formatCompact(selected.active.magical),
              },
              {
                label: "TRUE",
                value: formatCompact(selected.active.trueDamage),
              },
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

export { Damage };
