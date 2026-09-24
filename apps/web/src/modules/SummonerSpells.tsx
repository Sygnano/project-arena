"use client";

import { useMemo, useRef, useState } from "react";
import { cn } from "cn";
import { motion, MotionConfig } from "motion/react";
import type { SummonerSpellCasts, SummonerSpellsStats } from "@arena/types";
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
import { formatCompact } from "@/lib/format";
import { pressable } from "@/lib/a11y";
import { useChampionName } from "@/lib/champion-names";
import { DossierLink } from "@/lib/champion-dossier";
import { useDragScroll } from "@/hooks/use-drag-scroll";
import { MIN_SAMPLE, isLowSample, sortByRate } from "@/lib/sample";
import { SECTION_BACKGROUNDS } from "@/lib/section-backgrounds";

type Props = {
  summonerSpells: SummonerSpellsStats;
};

type Mode = "total" | "best" | "perGame";
/** "total" or a spell id. */
type Metric = "total" | `${number}`;

/** Each spell keeps the color of its in-game icon. Arena's own ids (2202
 * Flash, 2201 Flee) are the only two seen so far; anything else Riot ever
 * adds falls back to the palette below, in the order the API lists spells. */
const SPELL_COLORS: Record<number, string> = {
  2202: "#f5c542",
  2201: "#4fa3ff",
};
const FALLBACK_COLORS = ["#0ac8b9", "#d946ef", "#22c55e", "#ff8c34"];

const ROW_HEIGHT = 46;
const ROW_GAP = 3;
const SLOT_PITCH = ROW_HEIGHT + ROW_GAP;
const ICON_SIZE = 36;
const ROW_PADDING_X = 6;
const SPELL_COLUMN_WIDTH = 72;

function sumCasts(casts: SummonerSpellCasts, spellIds: readonly number[]): number {
  return spellIds.reduce((sum, id) => sum + (casts[id] ?? 0), 0);
}

function perGameCasts(casts: SummonerSpellCasts, games: number): SummonerSpellCasts {
  const result: SummonerSpellCasts = {};
  for (const [id, count] of Object.entries(casts)) {
    result[Number(id)] = games > 0 ? count / games : 0;
  }
  return result;
}

function formatCasts(value: number, mode: Mode): string {
  return mode === "perGame" ? value.toFixed(1) : formatCompact(value);
}

type Row = {
  championId: number;
  championName: string;
  matchesPlayed: number;
  /** Mode-dependent: season total, best single game, or per-game average. */
  active: SummonerSpellCasts;
  seasonTotal: SummonerSpellCasts;
  bestGame: SummonerSpellCasts;
};

/**
 * Summoner Spells — Arena's two spells (Flash and Flee) on the same row-list
 * template as Ability Casts: a stacked bar per champion split by spell, one
 * value column per spell, TOTAL / BEST GAME / PER GAME, and a selected-
 * champion detail band. Spells come from the data rather than a fixed list,
 * each spell's casts read from whichever slot (D or F) the player put it in.
 */
const SummonerSpells = ({ summonerSpells }: Props) => {
  const { spells, champions } = summonerSpells;
  const spellIds = useMemo(() => spells.map((spell) => spell.spellId), [spells]);
  const colorOf = (spellId: number) =>
    SPELL_COLORS[spellId] ?? FALLBACK_COLORS[spellIds.indexOf(spellId) % FALLBACK_COLORS.length];

  const [mode, setMode] = useState<Mode>("total");
  const displayName = useChampionName();
  const [metric, setMetric] = useState<Metric>("total");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
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

  const columnValue = (row: Row, m: Metric) =>
    m === "total" ? sumCasts(row.active, spellIds) : (row.active[Number(m)] ?? 0);

  const roster = useMemo<Row[]>(
    () =>
      champions.map((champion) => ({
        championId: champion.championId,
        championName: champion.championName,
        matchesPlayed: champion.matchesPlayed,
        active:
          mode === "best"
            ? champion.maxGame
            : mode === "perGame"
              ? perGameCasts(champion.total, champion.matchesPlayed)
              : champion.total,
        seasonTotal: champion.total,
        bestGame: champion.maxGame,
      })),
    [champions, mode],
  );

  const rows = useMemo(() => {
    const value = (row: Row) =>
      metric === "total" ? sumCasts(row.active, spellIds) : (row.active[Number(metric)] ?? 0);
    if (mode === "perGame") {
      return sortByRate(roster, value, (row) => row.matchesPlayed, sortDir, mixLowSample ? "mixed" : "after");
    }
    const dirSign = sortDir === "desc" ? 1 : -1;
    return [...roster].sort((a, b) => dirSign * (value(b) - value(a)));
  }, [roster, metric, sortDir, mode, mixLowSample, spellIds]);

  const [selectedChampionId, setSelectedChampionId] = useState<number | null>(() => rows[0]?.championId ?? null);
  const selected = roster.find((r) => r.championId === selectedChampionId) ?? rows[0] ?? null;

  const scaleRows = mode === "perGame" && !mixLowSample ? rows.filter((r) => !isLowSample(r.matchesPlayed)) : rows;
  const maxMetricValue = Math.max(1, ...(scaleRows.length > 0 ? scaleRows : rows).map((r) => columnValue(r, metric)));

  const totalGames = champions.reduce((sum, c) => sum + c.matchesPlayed, 0);
  const sidebarCasts =
    mode === "best"
      ? summonerSpells.maxGame
      : mode === "perGame"
        ? perGameCasts(summonerSpells.total, totalGames)
        : summonerSpells.total;
  const sidebarTotal = sumCasts(sidebarCasts, spellIds);
  const seasonGrandTotal = sumCasts(summonerSpells.total, spellIds);

  // "2.7 : 1" — how many of the most-cast spell per one of the runner-up,
  // season-wide whatever the mode (a ratio from one game says little).
  const [first, second] = spells;
  const secondTotal = second ? (summonerSpells.total[second.spellId] ?? 0) : 0;
  const ratioRow =
    first && second && secondTotal > 0
      ? {
          label: `${first.name.toUpperCase()} PER ${second.name.toUpperCase()}`,
          value: ((summonerSpells.total[first.spellId] ?? 0) / secondTotal).toFixed(1),
        }
      : null;

  const modeCaption =
    mode === "perGame"
      ? `PER GAME · UNDER ${MIN_SAMPLE} GAMES DIMMED`
      : mode === "total"
        ? "ALL GAMES"
        : "BEST SINGLE GAME";
  const metricLabel =
    metric === "total" ? "TOTAL" : (spells.find((s) => String(s.spellId) === metric)?.name.toUpperCase() ?? "");
  const modeWord = mode === "perGame" ? "PER GAME" : mode === "total" ? "TOTAL" : "BEST";
  const gridTemplateColumns = `36px 104px minmax(0,1fr) ${spellIds.map(() => `${SPELL_COLUMN_WIDTH}px`).join(" ")}`;

  return (
    <CategorySection
      title="SUMMONERS"
      quote="It's nearly time."
      imageUrl={SECTION_BACKGROUNDS.summonerSpells}
      sidebar={
        <>
          <Dial
            value={sidebarTotal}
            label={`${modeWord} CASTS`}
            labelPosition="bottom"
            formatValue={(value) => formatCasts(value, mode)}
          />

          <div className="mt-auto">
            <SidebarStatRows
              rows={[
                ...spells.map((spell) => {
                  const value = sidebarCasts[spell.spellId] ?? 0;
                  return {
                    label: spell.name.toUpperCase(),
                    valueColor: colorOf(spell.spellId),
                    value:
                      mode !== "best" ? (
                        <ValuePercentRow
                          value={formatCasts(value, mode)}
                          pct={sidebarTotal > 0 ? (value / sidebarTotal) * 100 : 0}
                        />
                      ) : (
                        formatCasts(value, mode)
                      ),
                  };
                }),
                ...(ratioRow ? [ratioRow] : []),
              ]}
            />
          </div>
        </>
      }
    >
      <HextechPanel contentMinWidth={620}>
        <PanelToolbar
          caption={`${modeCaption} · SORTED · BY ${metricLabel}`}
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
            tabs={[
              { key: "total" as Metric, label: "TOTAL" },
              ...spells.map((spell) => ({
                key: String(spell.spellId) as Metric,
                label: spell.name.toUpperCase(),
              })),
            ]}
            active={metric}
            onChange={sortBy}
            gap={18}
          />
        </PanelToolbar>

        <div
          className="grid items-center gap-4 pb-2 pl-1.5 pr-2.5"
          style={{
            gridTemplateColumns,
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
          {spells.map((spell) => {
            const key = String(spell.spellId) as Metric;
            return (
              <button
                key={spell.spellId}
                type="button"
                onClick={() => sortBy(key)}
                className="flex cursor-pointer items-center justify-end gap-1.5 select-none hover:opacity-100"
                style={{
                  color: colorOf(spell.spellId),
                  opacity: metric === key ? 1 : 0.55,
                }}
              >
                {spell.iconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={spell.iconUrl} alt="" width={16} height={16} className="size-4" />
                ) : null}
                <SortHeaderLabel label={spell.name.toUpperCase()} active={metric === key} dir={sortDir} />
              </button>
            );
          })}
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
                const isSelected = row.championId === selected?.championId;
                const total = sumCasts(row.active, spellIds);
                const barWidthPct = Math.min(100, (columnValue(row, metric) / maxMetricValue) * 100);
                // The sorted-by spell leads the bar, so it reads in list order.
                const order =
                  metric === "total" ? spellIds : [Number(metric), ...spellIds.filter((id) => String(id) !== metric)];

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
                      gridTemplateColumns,
                      background: isSelected ? "rgba(200,170,110,.09)" : "transparent",
                      boxShadow: isSelected ? "inset 0 0 0 1px rgba(200,170,110,.45)" : undefined,
                    }}
                  >
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
                            order.map((id) => (
                              <div
                                key={id}
                                className="h-full transition-[width] duration-300 ease-out"
                                style={{
                                  width: total > 0 ? `${((row.active[id] ?? 0) / total) * 100}%` : 0,
                                  background: colorOf(id),
                                }}
                              />
                            ))
                          ) : (
                            <div className="h-full w-full" style={{ background: colorOf(Number(metric)) }} />
                          )}
                        </div>
                      </div>
                      <div
                        className="w-16 flex-none text-right font-display text-[15px]"
                        style={{
                          color: metric === "total" ? "var(--color-lol-gold-50)" : "var(--color-lol-text-secondary)",
                        }}
                      >
                        {formatCasts(total, mode)}
                      </div>
                    </div>

                    {spellIds.map((id) => (
                      <div
                        key={id}
                        className="text-right font-display text-[15px]"
                        style={{
                          color: colorOf(id),
                          opacity: metric === String(id) ? 1 : 0.55,
                        }}
                      >
                        {formatCasts(row.active[id] ?? 0, mode)}
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
                    {/* eslint-disable-next-line @next/next/no-img-element */}
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
                {/* eslint-disable-next-line @next/next/no-img-element */}
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
                label: `${modeWord} CASTS`,
                value: formatCasts(sumCasts(selected.active, spellIds), mode),
                highlight: true,
                bordered: false,
              },
              {
                label: "% OF TOTAL",
                value:
                  seasonGrandTotal > 0
                    ? `${((sumCasts(selected.seasonTotal, spellIds) / seasonGrandTotal) * 100).toFixed(1)}%`
                    : "—",
              },
              ...spells.map((spell) => ({
                label: spell.name.toUpperCase(),
                value: formatCasts(selected.active[spell.spellId] ?? 0, mode),
              })),
              {
                label: "BEST GAME",
                value: formatCompact(sumCasts(selected.bestGame, spellIds)),
                nowrap: true,
              },
            ]}
          />
        ) : null}
      </HextechPanel>
    </CategorySection>
  );
};

export { SummonerSpells };
