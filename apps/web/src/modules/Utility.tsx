"use client";

import { useMemo, useRef, useState } from "react";
import { cn } from "cn";
import { motion, MotionConfig } from "motion/react";
import type {
  ChampionStats,
  UtilityBreakdown,
  UtilityStats,
} from "@arena/types";
import { CategorySection } from "@/components/category-section";
import { HextechPanel } from "@/components/hextech-panel";
import { Dial } from "@/components/dial";
import { DiamondTabs } from "@/components/diamond-tabs";
import { PanelToolbar, ToolbarDivider } from "@/components/panel-toolbar";
import { LowSampleSwitch } from "@/components/low-sample-switch";
import { DetailBand } from "@/components/detail-band";
import { SidebarStatRows } from "@/components/sidebar-stat-row";
import { SortHeaderLabel } from "@/components/sortable-stat-row";
import { championIconUrl } from "@/lib/riot";
import { formatCompact, formatDuration } from "@/lib/format";
import { pressable } from "@/lib/a11y";
import { useDragScroll } from "@/hooks/use-drag-scroll";
import { useChampionName } from "@/lib/champion-names";
import { DossierLink } from "@/lib/champion-dossier";
import { perGame } from "@/lib/per-game";
import { MIN_SAMPLE, isLowSample, sortByRate } from "@/lib/sample";
import { SECTION_BACKGROUNDS } from "@/lib/section-backgrounds";

type Props = UtilityStats & {
  champions: Record<number, ChampionStats>;
};

type Mode = "perGame" | "total" | "best";
type Metric = "heal" | "cc";
type SortDir = "asc" | "desc";

const HEAL_COLOR = "var(--color-lol-heal)";
const CC_COLOR = "#ba00fb";

/** Same fractional-power width scaling as Damage/Ability's row-list bars — a
 * plain linear ratio makes anything short of the leader look
 * disproportionately tiny, so the ratio is raised to a fractional power
 * first: still pins 0 -> 0% and 1 (the leader) -> 100%, but compresses the
 * low end upward so real gaps still read as gaps. Applied independently per
 * side (heal vs CC each scale against their own leader), since the two axes
 * aren't the same unit. */
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
  /** Mode-dependent (season total or independently-per-field best) — drives
   * the bars. */
  active: UtilityBreakdown;
  seasonTotal: UtilityBreakdown;
};

function metricValue(row: Row, metric: Metric): number {
  return metric === "heal"
    ? row.active.healingAndShielding
    : row.active.ccScoreSeconds;
}

const ROW_GRID = "72px minmax(0,1fr) 96px minmax(0,1fr) 72px";
const COLUMN_GAP = 16;

/** Row height and the list's fixed slot pitch (row height + inter-row gap),
 * in px — same idea as Damage/Ability's identical constants, just shorter
 * since a row here is only a bar + value (no champion name underneath the
 * icon — see the icon layer below). */
const ROW_HEIGHT = 40;
const ROW_GAP = 4;
const SLOT_PITCH = ROW_HEIGHT + ROW_GAP;
const ICON_SIZE = 32;

/**
 * Utility — a "tornado chart" row list: every champion gets one row with two
 * bars pointing inward at a centered portrait, heal & shielding on the left
 * and CC score on the right, rather than the single-direction bars every
 * other row-list section (Damage, Ability, Banned Champions) uses.
 *
 * Bars and portraits are split into two decoupled layers over one fixed-
 * height relative container, the same technique Damage/Ability use for their
 * row lists (see `Damage.tsx`'s doc comment): the bar layer is keyed by RANK
 * (slot index), so a re-sort never slides a bar sideways — it just changes
 * which champion's numbers that slot renders, and the bar's width tweens to
 * the new value in place via a CSS transition. The portrait layer is keyed
 * by championId with Motion's `layout="position"` FLIP, so portraits slide
 * vertically to their new rank on top of the (positionally static) bars.
 * Unlike Damage/Ability, the portrait sits in the MIDDLE column between two
 * fluid `minmax(0,1fr)` bar tracks rather than a fixed-width leading column,
 * so its pixel x-position isn't a constant to hand Motion directly — the
 * portrait layer is instead a real CSS Grid using the exact same
 * `ROW_GRID`/`COLUMN_GAP` template as each bar row, so the grid engine
 * resolves the middle column's pixel bounds identically in both layers
 * (same container width, same column template) without any manual math.
 */
const Utility = ({ total, bestByType, champions }: Props) => {
  const [mode, setMode] = useState<Mode>("total");
  const displayName = useChampionName();
  const [metric, setMetric] = useState<Metric>("heal");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  // PER GAME: rank champions under MIN_SAMPLE games with the rest (still dimmed).
  const [mixLowSample, setMixLowSample] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  useDragScroll(listRef, "y");

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
      Object.values(champions).map((champion) => ({
        championId: champion.championId,
        championName: champion.championName,
        matchesPlayed: champion.matchesPlayed,
        active:
          mode === "best"
            ? champion.utility.bestByType
            : mode === "perGame"
              ? perGame(champion.utility.total, champion.matchesPlayed, [
                  "savesFromDeath",
                ])
              : champion.utility.total,
        seasonTotal: champion.utility.total,
      })),
    [champions, mode],
  );

  const rows = useMemo(() => {
    // Per-game averages from a handful of games rank after every champion
    // with enough games, and render dimmed (see lib/sample.ts).
    if (mode === "perGame") {
      return sortByRate(
        roster,
        (row) => metricValue(row, metric),
        (row) => row.matchesPlayed,
        sortDir,
        mixLowSample ? "mixed" : "after",
      );
    }
    const dirSign = sortDir === "desc" ? 1 : -1;
    return [...roster].sort(
      (a, b) => dirSign * (metricValue(b, metric) - metricValue(a, metric)),
    );
  }, [roster, metric, sortDir, mode, mixLowSample]);

  const [selectedChampionId, setSelectedChampionId] = useState<number | null>(
    () => rows[0]?.championId ?? null,
  );
  const selected =
    roster.find((r) => r.championId === selectedChampionId) ?? rows[0] ?? null;

  // Scale from champions with enough games in PER GAME mode (see Damage).
  const eligible =
    mode === "perGame" && !mixLowSample
      ? rows.filter((r) => !isLowSample(r.matchesPlayed))
      : rows;
  const scaleRows = eligible.length > 0 ? eligible : rows;
  const maxHeal = Math.max(
    1,
    ...scaleRows.map((r) => r.active.healingAndShielding),
  );
  const maxCc = Math.max(1, ...scaleRows.map((r) => r.active.ccScoreSeconds));

  const totalGames = Object.values(champions).reduce(
    (sum, c) => sum + c.matchesPlayed,
    0,
  );
  const sidebarBreakdown =
    mode === "best"
      ? bestByType
      : mode === "perGame"
        ? perGame(total, totalGames, ["savesFromDeath"])
        : total;
  const dialBreakdown = sidebarBreakdown;

  const modeCaption =
    mode === "perGame"
      ? `PER GAME · UNDER ${MIN_SAMPLE} GAMES DIMMED`
      : mode === "total"
        ? "ALL GAMES"
        : "BEST SINGLE GAME";
  const metricLabel = metric === "heal" ? "HEAL & SHIELD" : "CC SCORE";


  return (
    <CategorySection
      title="UTILITY"
      quote="To heal and protect."
      imageUrl={SECTION_BACKGROUNDS.utility}
      sidebar={
        <>
          <Dial
            value={dialBreakdown.savesFromDeath}
            label={`${mode === "perGame" ? "SAVES / GAME" : mode === "total" ? "TOTAL SAVES" : "BEST SAVES"}`}
            formatValue={(v) =>
              mode === "perGame" ? v.toFixed(1) : v.toLocaleString()
            }
          />

          <div className="mt-auto">

            <SidebarStatRows
              rows={[
                {
                  label: "HEAL & SHIELDING",
                  value: formatCompact(sidebarBreakdown.healingAndShielding),
                },
                {
                  label: "CC SCORE",
                  value: formatCompact(sidebarBreakdown.ccScoreSeconds),
                },
                {
                  label: "CC TIME DEALT",
                  value: formatDuration(sidebarBreakdown.ccTimeDealt),
                },
              ]}
            />
          </div>
        </>
      }
    >
      <HextechPanel contentMinWidth={600}>
        <PanelToolbar
          caption={`${modeCaption} · SORTED · BY ${metricLabel}`}
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
            tabs={[
              { key: "heal", label: "HEAL & SHIELD" },
              { key: "cc", label: "CC SCORE" },
            ]}
            active={metric}
            onChange={sortBy}
            gap={18}
          />
        </PanelToolbar>

        <div
          className="grid items-center gap-4 pb-2"
          style={{
            gridTemplateColumns: ROW_GRID,
            borderBottom: "1px solid rgba(200,170,110,.16)",
          }}
        >
          <div />
          <button
            type="button"
            onClick={() => sortBy("heal")}
            className="cursor-pointer text-right select-none hover:opacity-100"
            style={{ color: HEAL_COLOR, opacity: metric === "heal" ? 1 : 0.55 }}
          >
            <SortHeaderLabel
              label="◀ HEAL & SHIELD"
              active={metric === "heal"}
              dir={sortDir}
            />
          </button>
          <div className="text-center text-[11px] tracking-[.22em] text-[#a09b8c]">
            CHAMPION
          </div>
          <button
            type="button"
            onClick={() => sortBy("cc")}
            className="cursor-pointer select-none hover:opacity-100"
            style={{ color: CC_COLOR, opacity: metric === "cc" ? 1 : 0.55 }}
          >
            <SortHeaderLabel
              label="CC SCORE ▶"
              active={metric === "cc"}
              dir={sortDir}
            />
          </button>
          <div />
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
            <div
              className="relative"
              style={{ height: rows.length * SLOT_PITCH - ROW_GAP }}
            >
              {rows.map((row, index) => {
                const isSelected = row.championId === selectedChampionId;
                const healPct = barWidthPercent(
                  row.active.healingAndShielding,
                  maxHeal,
                );
                const ccPct = barWidthPercent(row.active.ccScoreSeconds, maxCc);

                return (
                  <div
                    key={index}
                    {...pressable(() => setSelectedChampionId(row.championId), {
                      pressed: isSelected,
                    })}
                    aria-label={`${displayName(row.championName)}, ${row.matchesPlayed} games`}
                    title={displayName(row.championName)}
                    className={cn(
                      "absolute inset-x-0 grid cursor-pointer items-center gap-4 px-1.5 transition-[background,opacity] duration-150",
                      mode === "perGame" &&
                        isLowSample(row.matchesPlayed) &&
                        "opacity-45",
                    )}
                    style={{
                      top: index * SLOT_PITCH,
                      height: ROW_HEIGHT,
                      gridTemplateColumns: ROW_GRID,
                      background: isSelected
                        ? "rgba(200,170,110,.09)"
                        : "transparent",
                      boxShadow: isSelected
                        ? "inset 0 0 0 1px rgba(200,170,110,.45)"
                        : undefined,
                    }}
                  >
                    <div
                      className="text-right font-display text-[15px]"
                      style={{ color: HEAL_COLOR }}
                    >
                      {formatCompact(row.active.healingAndShielding)}
                    </div>

                    <div
                      className="relative h-2.5"
                      style={{ background: "rgba(240,230,210,.05)" }}
                    >
                      <div
                        className="absolute inset-y-0 right-0 h-2.5 transition-[width] duration-300 ease-out"
                        style={{
                          width: `${healPct}%`,
                          background: HEAL_COLOR,
                          borderTop: `1px solid ${HEAL_COLOR}`,
                          boxShadow: "0 0 10px rgba(34,197,94,.55)",
                        }}
                      />
                    </div>

                    {/* Portrait sits in the layer above — this reserves its column. */}
                    <div />

                    <div
                      className="relative h-2.5"
                      style={{ background: "rgba(240,230,210,.05)" }}
                    >
                      <div
                        className="absolute inset-y-0 left-0 h-2.5 transition-[width] duration-300 ease-out"
                        style={{
                          width: `${ccPct}%`,
                          background: CC_COLOR,
                          borderTop: `1px solid ${CC_COLOR}`,
                          boxShadow: "0 0 10px rgba(186,0,251,.55)",
                        }}
                      />
                    </div>

                    <div
                      className="text-left font-display text-[15px]"
                      style={{ color: CC_COLOR }}
                    >
                      {formatCompact(row.active.ccScoreSeconds)}
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
                <div
                  className="pointer-events-none absolute inset-x-1.5 top-0 grid"
                  style={{
                    gridTemplateColumns: ROW_GRID,
                    columnGap: COLUMN_GAP,
                    gridTemplateRows: `repeat(${rows.length}, ${ROW_HEIGHT}px)`,
                    rowGap: ROW_GAP,
                  }}
                >
                  {rows.map((row, index) => (
                    <motion.div
                      key={row.championId}
                      layout="position"
                      aria-hidden
                      onClick={() => setSelectedChampionId(row.championId)}
                      title={displayName(row.championName)}
                      className="pointer-events-auto flex cursor-pointer items-center justify-center"
                      style={{ gridColumn: 3, gridRow: index + 1 }}
                    >
                      <img
                        loading="lazy"
                        decoding="async"
                        src={championIconUrl(row.championName)}
                        alt=""
                        width={ICON_SIZE}
                        height={ICON_SIZE}
                        className="h-8 w-8 flex-none"
                      />
                    </motion.div>
                  ))}
                </div>
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
                label: "HEAL & SHIELD",
                value: formatCompact(selected.active.healingAndShielding),
                highlight: metric === "heal",
                bordered: false,
              },
              {
                label: "CC SCORE",
                value: formatCompact(selected.active.ccScoreSeconds),
                highlight: metric === "cc",
              },
              {
                label: "CC TIME DEALT",
                value: formatDuration(selected.active.ccTimeDealt),
                nowrap: true,
              },
              {
                label: "SAVES",
                value: selected.active.savesFromDeath.toLocaleString(),
              },
            ]}
          />
        ) : null}
      </HextechPanel>
    </CategorySection>
  );
};

export { Utility };
