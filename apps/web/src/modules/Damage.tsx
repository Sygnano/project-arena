"use client";

import { useMemo, useState } from "react";
import { motion, MotionConfig } from "motion/react";
import type { ChampionStats, DamageBreakdown, DamageStats } from "@arena/types";
import { CategorySection } from "@/components/category-section";
import { HextechPanel } from "@/components/hextech-panel";
import { Dial } from "@/components/dial";
import { DiamondTabs } from "@/components/diamond-tabs";
import { FadingRule } from "@/components/fading-rule";
import { DetailBand } from "@/components/detail-band";
import { SidebarStatRows } from "@/components/sidebar-stat-row";
import { championIconUrl } from "@/lib/riot";
import { formatCompact } from "@/lib/format";

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
  nextSectionLabel?: string;
};

type Mode = "total" | "best";
type Metric = "total" | "physical" | "magical" | "trueDamage";

const METRICS: Metric[] = ["total", "physical", "magical", "trueDamage"];
const METRIC_LABEL: Record<Metric, string> = {
  total: "TOTAL",
  physical: "PHYSICAL",
  magical: "MAGICAL",
  trueDamage: "TRUE",
};

const COLORS = {
  physical: "#ff8c34",
  magical: "#00b0f0",
  trueDamage: "#ffffff",
} as const;

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
const BAR_WIDTH_EXPONENT = 0.55;
function barWidthPercent(value: number, max: number): number {
  if (max <= 0) return 0;
  const ratio = Math.min(1, Math.max(0, value / max));
  return Math.pow(ratio, BAR_WIDTH_EXPONENT) * 100;
}

type Row = {
  championId: number;
  championName: string;
  matchesPlayed: number;
  /** Mode-dependent (season total or single best-game breakdown) — drives
   * the stacked bar and the TOTAL column (both need one coherent breakdown
   * that actually sums to a real total, not three independently-maxed
   * numbers). */
  active: DamageBreakdown;
  seasonTotal: DamageBreakdown;
  bestGame: DamageBreakdown;
  /** Mode-dependent: in "best" mode, each field is independently maxed
   * across every game (see `ChampionDamageStats.bestByType`); in "total"
   * mode this is the same as `seasonTotal` (a season sum is already its own
   * independent-per-type total). Drives the PHYS/MAGIC/TRUE columns. */
  activeByType: DamageBreakdown;
};

function columnValue(row: Row, metric: Metric): number {
  return metric === "total"
    ? sumBreakdown(row.active)
    : row.activeByType[metric];
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

/** "value | pct%" sidebar row, laid out as fixed-width grid columns rather
 * than one string — same reasoning as `BannedChampions`' `CountPercentValue`:
 * right-aligning free text puts the "|" at a different x position per row
 * whenever the value/percent digit counts differ. Only meaningful in TOTAL
 * mode: BEST GAME's three numbers are each an independent per-game max (see
 * `Row.activeByType`), so they don't actually sum back to a "total" the way
 * a percentage-of-total implies — callers only pass this in that mode.
 * The pct column is 72px, same as `CountPercentValue`'s — narrower (it used
 * to be 52px) left no slack for a right-aligned "38.8%" to breathe against
 * the "|" column, since the digits ran all the way to that column's edge. */
function ValuePercentRow({ value, pct }: { value: string; pct: number }) {
  return (
    <div
      className="grid items-baseline font-display text-[22px] text-lol-gold-50"
      style={{ gridTemplateColumns: "60px 4px 72px" }}
    >
      <span className="text-left tabular-nums">{value}</span>
      <span className="text-center text-lol-text-muted">|</span>
      <span className="text-right tabular-nums">{pct.toFixed(1)}%</span>
    </div>
  );
}

/**
 * A right-aligned, sortable column header label: the label itself plus (when
 * this column is the active sort key) a small ▲/▼ showing direction.
 * `tracking-[.22em]` letter-spacing pads *after* every character including
 * the last, which visibly shifts a right-aligned string's glyphs left of the
 * box's true right edge — the `marginRight` cancels exactly that trailing
 * gap so the label's last glyph (or the indicator, when shown) actually
 * touches the column's right edge, aligned with the value below it.
 */
function SortHeaderLabel({
  label,
  active,
  dir,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
}) {
  return (
    <span className="inline-flex items-center gap-1 text-[9.5px]">
      <span className="tracking-[.22em]" style={{ marginRight: "-.22em" }}>
        {label}
      </span>
      {active && (
        <span className="text-[7px] leading-none">
          {dir === "desc" ? "▼" : "▲"}
        </span>
      )}
    </span>
  );
}

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
  nextSectionLabel = "AUGMENTS",
}: Props) => {
  const dmgWord = variant === "taken" ? "TAKEN" : "DMG";
  const [mode, setMode] = useState<Mode>("total");
  const [metric, setMetric] = useState<Metric>("total");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

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
            mode === "best" ? championDamage.maxGame : championDamage.total,
          activeByType:
            mode === "best" ? championDamage.bestByType : championDamage.total,
          seasonTotal: championDamage.total,
          bestGame: championDamage.maxGame,
        };
      }),
    [champions, mode, variant],
  );

  const rows = useMemo(() => {
    const dirSign = sortDir === "desc" ? 1 : -1;
    return [...roster].sort(
      (a, b) => dirSign * (columnValue(b, metric) - columnValue(a, metric)),
    );
  }, [roster, metric, sortDir]);

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
  const maxMetricValue = Math.max(
    1,
    ...rows.map((r) => columnValue(r, metric)),
  );
  const seasonGrandTotal = sumBreakdown(damage.total);
  const dialValue = sumBreakdown(
    mode === "best" ? damage.maxGame : damage.total,
  );
  // Same independent-per-type correction as the grid's PHYS/MAGIC/TRUE
  // columns (see `Row.activeByType`) — in "best" mode these are each maxed
  // across all games separately, not the breakdown of one single game.
  const sidebarBreakdown = mode === "best" ? damage.bestByType : damage.total;

  const modeCaption = mode === "total" ? "SEASON TOTAL" : "BEST SINGLE GAME";

  // Percentages only make sense against a real total (TOTAL mode) — see
  // `ValuePercentRow`'s doc comment for why BEST GAME skips them.
  const sidebarTotal = sumBreakdown(sidebarBreakdown);
  const sidebarRow = (label: string, value: number) => ({
    label,
    value:
      mode === "total" ? (
        <ValuePercentRow
          value={formatCompact(value)}
          pct={sidebarTotal > 0 ? (value / sidebarTotal) * 100 : 0}
        />
      ) : (
        formatCompact(value)
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
      imageUrl="/images/kda-bg.jpg"
      nextSectionLabel={nextSectionLabel}
      sidebar={
        <>
          <Dial
            value={dialValue}
            label={`${mode === "total" ? "TOTAL" : "BEST"} ${dmgWord}`}
            labelPosition="bottom"
            formatValue={formatCompact}
          />

          <div className="mt-auto">
            <SidebarStatRows
              rows={[
                sidebarRow("PHYSICAL", sidebarBreakdown.physical),
                sidebarRow("MAGICAL", sidebarBreakdown.magical),
                sidebarRow("TRUE", sidebarBreakdown.trueDamage),
              ]}
            />
          </div>
        </>
      }
    >
      <HextechPanel>
        <div className="mb-3.5 flex items-center gap-6">
          <DiamondTabs
            tabs={[
              { key: "total", label: "TOTAL" },
              { key: "best", label: "BEST GAME" },
            ]}
            active={mode}
            onChange={setMode}
          />
          <div className="h-4 w-px flex-none bg-[rgba(200,170,110,.25)]" />
          <DiamondTabs
            tabs={METRICS.map((m) => ({ key: m, label: METRIC_LABEL[m] }))}
            active={metric}
            onChange={sortBy}
            gap={18}
          />
          <FadingRule />
          <div className="text-[11px] tracking-[.28em] text-lol-text-muted">
            {modeCaption} · SORTED · BY {METRIC_LABEL[metric]}
          </div>
        </div>

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
          <div className="text-[9.5px] tracking-[.22em] text-[#7f7a6e]">
            CHAMPION
          </div>
          <div
            onClick={() => sortBy("total")}
            className="cursor-pointer text-right select-none hover:text-lol-gold-100"
            style={{
              color:
                metric === "total" ? "var(--color-lol-gold-50)" : "#7f7a6e",
            }}
          >
            <SortHeaderLabel
              label={variant === "taken" ? "TOTAL TAKEN" : "TOTAL DAMAGE"}
              active={metric === "total"}
              dir={sortDir}
            />
          </div>
          <div
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
          </div>
          <div
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
          </div>
          <div
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
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-lol-text-muted">
            No tracked matches yet.
          </div>
        ) : (
          <div
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
                    onClick={() => setSelectedChampionId(row.championId)}
                    className="absolute inset-x-0 grid cursor-pointer items-center gap-4 px-1.5 transition-colors duration-150"
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
                      {row.championName}
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
                      {formatCompact(row.activeByType.physical)}
                    </div>
                    <div
                      className="text-right font-display text-[15px]"
                      style={{
                        color: COLORS.magical,
                        opacity: metric === "magical" ? 1 : 0.55,
                      }}
                    >
                      {formatCompact(row.activeByType.magical)}
                    </div>
                    <div
                      className="text-right font-display text-[15px]"
                      style={{
                        color: COLORS.trueDamage,
                        opacity: metric === "trueDamage" ? 1 : 0.55,
                      }}
                    >
                      {formatCompact(row.activeByType.trueDamage)}
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
                      src={championIconUrl(row.championName)}
                      alt={row.championName}
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
                  src={championIconUrl(selected.championName)}
                  alt={selected.championName}
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
            title={selected.championName}
            subtitle={`${selected.matchesPlayed.toLocaleString()} GAMES`}
            stats={[
              {
                label: `TOTAL ${dmgWord}`,
                value: formatCompact(sumBreakdown(selected.seasonTotal)),
                highlight: true,
                bordered: false,
              },
              {
                label: "% OF TOTAL",
                value: `${((sumBreakdown(selected.seasonTotal) / seasonGrandTotal) * 100).toFixed(1)}%`,
              },
              {
                label: "PHYSICAL",
                value: formatCompact(selected.seasonTotal.physical),
              },
              {
                label: "MAGICAL",
                value: formatCompact(selected.seasonTotal.magical),
              },
              {
                label: "TRUE",
                value: formatCompact(selected.seasonTotal.trueDamage),
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
