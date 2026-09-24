"use client";

import { useMemo, useState } from "react";
import type { ChampionStats } from "@arena/types";
import { CategorySection } from "@/components/category-section";
import { HextechPanel } from "@/components/hextech-panel";
import { HextechBarChart, type BarColumn } from "@/components/hextech-bar-chart";
import { championIconUrl } from "@/lib/riot";
import { Dial } from "@/components/dial";
import { DetailBand } from "@/components/detail-band";
import { DiamondTabs } from "@/components/diamond-tabs";
import { LowSampleSwitch } from "@/components/low-sample-switch";
import { PanelToolbar, ToolbarDivider } from "@/components/panel-toolbar";
import { TIER_STYLE, type TierStyle } from "@/lib/tier-bars";
import { barHeight } from "@/lib/bar-scale";
import { MIN_SAMPLE, isLowSample, sortByRate } from "@/lib/sample";
import { useChampionName } from "@/lib/champion-names";
import { DossierLink } from "@/lib/champion-dossier";
import { CursorTooltip } from "@/components/cursor-tooltip";
import { ChampionResultsCard } from "@/modules/ChampionResultsCard";
import { useChartHover } from "@/hooks/use-chart-hover";
import { SECTION_BACKGROUNDS } from "@/lib/section-backgrounds";
import { SidebarStatRows } from "@/components/sidebar-stat-row";

type Props = {
  kills: number;
  deaths: number;
  assists: number;
  kda: number;
  mostKills: number;
  bestKda: number;
  champions: Record<number, ChampionStats>;
};

export type Metric = "kills" | "deaths" | "assists" | "kda";
export type Mode = "perGame" | "total" | "best";

/**
 * One champion's derived per-metric numbers for this chart — `kills`/
 * `deaths`/`assists`/`kda` are season totals (from `ChampionStats.kda`),
 * `best` is the single best-KDA match's boxscore (`ChampionKdaStats.bestGame`,
 * all three stats from the SAME match) plus that match's own KDA.
 * `soloKills`/`largestKillingSpree` come straight from `ChampionKdaStats` —
 * summed and single-match-max respectively, same as their page-wide
 * `KillsStats` analogs.
 */
export type ChampionRosterEntry = {
  championId: number;
  championName: string;
  games: number;
  kills: number;
  deaths: number;
  assists: number;
  kda: number;
  /** Single-match records, each independently the best for its own metric:
   * most kills, FEWEST deaths, most assists, best KDA. (Previously all four
   * came from the best-KDA match, so "best game · kills" ranked by the kill
   * count of whichever game had the best KDA, not the most kills.) */
  best: { kills: number; deaths: number; assists: number; kda: number };
  /** The best-KDA match's own K/D/A line, for the detail band. */
  bestKdaLine: { kills: number; deaths: number; assists: number };
  soloKills: number;
  largestKillingSpree: number;
};

export type ChartRow = {
  entry: ChampionRosterEntry;
  value: number;
  height: number;
  isLeader: boolean;
  isSelected: boolean;
};

const METRICS: Metric[] = ["kills", "deaths", "assists", "kda"];
const METRIC_LABEL: Record<Metric, string> = {
  kills: "KILLS",
  deaths: "DEATHS",
  assists: "ASSISTS",
  kda: "KDA",
};

// Percentages of the chart's own bar track (`HextechBarChart`'s
// `heightUnit="percent"`), not px — the leader bar is deliberately capped
// below 100% rather than always touching the track's top edge, leaving
// headroom above the tallest column.
const BAR_MIN_HEIGHT = 5;
const BAR_MAX_HEIGHT = 70;

function formatValue(value: number, metric: Metric, mode: Mode): string {
  if (metric === "kda" || mode === "perGame") return value.toFixed(metric === "kda" ? 2 : 1);
  return Math.round(value).toLocaleString();
}

/**
 * 1st place gets Prismatic, 2nd gets Gold, and every rank from 3rd on down
 * gets Silver (the `.tier-bar-*` classes in globals.css) — 3rd used to be
 * the only Silver rank, with everyone past it falling back to a plain cyan
 * gradient; now that fallback is gone and Silver just covers "everyone not
 * top two" instead. `edge`/`glow` are the bar's own `border-top` color and
 * box-shadow, which still need a real value even when the fill comes from a
 * class (an unset `border-top` color would default to black against these
 * bright fills).
 */
function tierForBar(index: number): TierStyle {
  if (index === 0) return TIER_STYLE.prismatic;
  if (index === 1) return TIER_STYLE.gold;
  return TIER_STYLE.silver;
}

/**
 * Adapts a ranked `ChartRow[]` into the generic `HextechBarChart`'s
 * `BarColumn[]` shape — one single-segment column per champion.
 */
function toBarColumns(rows: ChartRow[], metric: Metric, mode: Mode, displayName: (key: string) => string): BarColumn[] {
  return rows.map((row, index) => {
    const tier = tierForBar(index);
    const lowSample = mode !== "total" && isLowSample(row.entry.games);
    return {
      id: row.entry.championId,
      topLabel: formatValue(row.value, metric, mode),
      dimmed: lowSample,
      ariaLabel: `${displayName(row.entry.championName)}: ${formatValue(row.value, metric, mode)} ${METRIC_LABEL[metric].toLowerCase()}, ${row.entry.games} games`,
      isLeader: row.isLeader,
      isSelected: row.isSelected,
      icon: (
        <img
          loading="lazy"
          decoding="async"
          src={championIconUrl(row.entry.championName)}
          alt=""
          width={36}
          height={36}
        />
      ),
      segments: [
        {
          key: "value",
          height: row.height,
          fillClassName: tier.fillClass,
          borderColor: tier.edge,
          boxShadow: tier.glow,
        },
      ],
    };
  });
}

/** Hover card for one KDA column: the champion's name (the chart shows only
 * an icon) and how its games FINISHED. Complements the detail band below,
 * which carries the combat line for whichever champion is pinned. */
function KdaHoverCard({
  stats,
  rank,
  total,
  sortLabel,
  modeLabel,
}: {
  stats: ChampionStats;
  rank: number;
  total: number;
  sortLabel: string;
  modeLabel: string;
}) {
  return (
    <ChampionResultsCard
      stats={stats}
      subtitle={
        <span className="mt-1.5 block">
          #{rank} of {total} · {modeLabel.toLowerCase()} · by {sortLabel.toLowerCase()}
          {isLowSample(stats.matchesPlayed) ? " · few games" : ""}
        </span>
      }
      footer={<div className="mt-2.5 text-[10px] tracking-[.2em] text-lol-text-muted/70">CLICK TO PIN BELOW</div>}
    />
  );
}

/**
 * `champions` is the per-champion KDA/damage/ability totals slice of the
 * stats response — `championPicks` isn't needed here anymore, since
 * `soloKills`/`largestKillingSpree` live directly on `ChampionKdaStats`.
 */
function buildRoster(champions: Record<number, ChampionStats>): ChampionRosterEntry[] {
  return Object.values(champions).map((champion) => {
    const {
      totalKills,
      totalDeaths,
      totalAssists,
      bestGame,
      soloKills,
      largestKillingSpree,
      mostKills,
      fewestDeaths,
      mostAssists,
    } = champion.kda;
    const kda = totalDeaths === 0 ? totalKills + totalAssists : (totalKills + totalAssists) / totalDeaths;
    const bestKda = (bestGame.kills + bestGame.assists) / Math.max(1, bestGame.deaths);
    return {
      championId: champion.championId,
      championName: champion.championName,
      games: champion.matchesPlayed,
      kills: totalKills,
      deaths: totalDeaths,
      assists: totalAssists,
      kda,
      best: {
        kills: mostKills,
        deaths: fewestDeaths,
        assists: mostAssists,
        kda: bestKda,
      },
      bestKdaLine: bestGame,
      soloKills,
      largestKillingSpree,
    };
  });
}

function metricValue(entry: ChampionRosterEntry, metric: Metric, mode: Mode): number {
  if (mode === "best") return entry.best[metric];
  if (mode === "perGame" && metric !== "kda") {
    return entry.games > 0 ? entry[metric] / entry.games : 0;
  }
  return entry[metric];
}

/**
 * Ranks the roster by the active metric/mode and maps each value to a bar
 * height. Three rules carry meaning here (see the design handoff's
 * "Ranking rules" section) and must not be simplified away:
 * - DEATHS+BEST GAME sorts ascending (fewest deaths wins) *and* inverts the
 *   height mapping, so the best result still renders as the tallest bar —
 *   taller must always mean better.
 * - KDA uses a raised floor (`lo - (hi-lo)*0.45`, clamped to 0) rather than
 *   scaling from 0, since KDA values cluster in a narrow band and scaling
 *   from a true zero baseline would flatten every bar to nearly the same
 *   height.
 * - Heights are mapped via `barHeight` (log scale), not linearly, so a
 *   single outlier leader doesn't crater the 2nd/3rd bars down near
 *   `BAR_MIN_HEIGHT` — see that function's doc comment.
 */
function buildChartRows(
  roster: ChampionRosterEntry[],
  metric: Metric,
  mode: Mode,
  selectedChampionId: number | null,
  mixLowSample = false,
): ChartRow[] {
  if (roster.length === 0) return [];

  // Fewer deaths is better per game and in a best game; a season TOTAL of
  // deaths isn't a performance ranking at all, so it sorts by volume instead.
  const lowestIsBest = metric === "deaths" && mode !== "total";
  const withValues = roster.map((entry) => ({ entry, value: metricValue(entry, metric, mode) }));
  // Averages and ratios from a handful of games are noise: those rank after
  // every champion with enough games (and are dimmed in the chart).
  const ranked =
    mode === "total"
      ? withValues.sort((a, b) => b.value - a.value)
      : sortByRate(
          withValues,
          (row) => row.value,
          (row) => row.entry.games,
          lowestIsBest ? "asc" : "desc",
          mixLowSample ? "mixed" : "after",
        );

  // The scale comes from champions with enough games: a dimmed 1-game
  // outlier (say, 20 kills in its only game) would otherwise set the
  // ceiling and flatten every real bar. Outliers are clamped to the scale.
  // Once the viewer mixes them in, they rank among the rest and must scale
  // too — clamped, every mixed-in outlier would render as an equal max bar.
  const scaled = ranked.filter((row) => mode === "total" || mixLowSample || !isLowSample(row.entry.games));
  const values = (scaled.length > 0 ? scaled : ranked).map((row) => row.value);
  const hi = Math.max(...values);
  const lo = Math.min(...values);

  const heightFor = (v: number) =>
    lowestIsBest
      ? barHeight(hi - v, Math.max(0.001, hi - lo), BAR_MAX_HEIGHT, BAR_MIN_HEIGHT)
      : barHeight(v, hi, BAR_MAX_HEIGHT, BAR_MIN_HEIGHT);

  return ranked.map(({ entry, value }, index) => ({
    entry,
    value,
    height: heightFor(value),
    isLeader: index === 0,
    isSelected: entry.championId === selectedChampionId,
  }));
}

/**
 * KDA section — recreated from the Claude Design handoff in
 * `design_handoff_arena_kda/` (option 2a). High-fidelity: a full-bleed
 * blurred arena background, a left identity column (title, KDA dial, K/D/A
 * totals), and a right "instrument panel" holding a horizontally-scrolling
 * per-champion bar chart plus a detail readout for whichever champion is
 * selected. The background/header/bottom-cue chrome lives in
 * `CategorySection` (lifted from this section so later sections can reuse
 * it); this component only owns the identity column's dial/totals
 * (`sidebar`) and the instrument panel itself (`children`).
 */
const KDA = ({ kills, deaths, assists, kda, mostKills, bestKda, champions }: Props) => {
  const [metric, setMetric] = useState<Metric>("kills");
  const [mode, setMode] = useState<Mode>("total");
  // Outside TOTAL: rank champions under MIN_SAMPLE games with the rest (still dimmed).
  const [mixLowSample, setMixLowSample] = useState(false);
  const displayName = useChampionName();

  const roster = useMemo(() => buildRoster(champions), [champions]);

  const [selectedChampionId, setSelectedChampionId] = useState<number | null>(
    () => buildChartRows(roster, "kills", "perGame", null)[0]?.entry.championId ?? null,
  );

  const chartRows = useMemo(
    () => buildChartRows(roster, metric, mode, selectedChampionId, mixLowSample),
    [roster, metric, mode, selectedChampionId, mixLowSample],
  );

  const barColumns = useMemo(
    () => toBarColumns(chartRows, metric, mode, displayName),
    [chartRows, metric, mode, displayName],
  );

  const { hover, onHover, containerRef: hoverRef } = useChartHover<number>();
  const hoveredIndex = hover ? chartRows.findIndex((row) => row.entry.championId === hover.id) : -1;
  const hoveredRow = hoveredIndex === -1 ? null : chartRows[hoveredIndex];

  const selectedEntry = roster.find((entry) => entry.championId === selectedChampionId) ?? roster[0] ?? null;

  const modeLabel = mode === "perGame" ? "PER GAME" : mode === "total" ? "ALL GAMES" : "BEST SINGLE GAME";
  // Deaths sort ascending outside TOTAL (see `buildChartRows`) — called out
  // as "FEWEST" since lower-is-better is the opposite of every other column.
  const sortLabel = mode !== "total" && metric === "deaths" ? "FEWEST DEATHS" : METRIC_LABEL[metric];
  const modeCaption =
    mode === "total"
      ? `${modeLabel} · BY ${sortLabel}`
      : `${modeLabel} · BY ${sortLabel} · UNDER ${MIN_SAMPLE} GAMES DIMMED`;

  return (
    <CategorySection
      title="KDA"
      quote="Everyone's got a plan, 'til they get slammed into the ground."
      imageUrl={SECTION_BACKGROUNDS.kda}
      sidebar={
        <>
          <Dial value={kda} label="KDA" />

          <div className="mt-auto">
            <SidebarStatRows
              rows={[
                { label: "KILLS", value: kills.toLocaleString() },
                { label: "DEATHS", value: deaths.toLocaleString() },
                { label: "ASSISTS", value: assists.toLocaleString() },
                { label: "MOST KILLS · 1 GAME", value: mostKills.toLocaleString() },
                { label: "BEST KDA · 1 GAME", value: bestKda.toFixed(1) },
              ]}
            />
          </div>
        </>
      }
    >
      <HextechPanel>
        <PanelToolbar
          caption={modeCaption}
          trailing={mode !== "total" ? <LowSampleSwitch checked={mixLowSample} onChange={setMixLowSample} /> : null}
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
            onChange={setMetric}
            gap={18}
          />
        </PanelToolbar>

        {roster.length === 0 ? (
          <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-lol-text-muted">
            No tracked matches yet.
          </div>
        ) : (
          <div ref={hoverRef} className="flex min-h-0 min-w-0 w-full flex-1 flex-col">
            <HextechBarChart
              columns={barColumns}
              onSelect={(id) => setSelectedChampionId(id as number)}
              onHover={onHover}
              highlightedId={hover?.id ?? null}
              heightUnit="percent"
            />
            <CursorTooltip point={hoveredRow && champions[hoveredRow.entry.championId] ? hover!.point : null}>
              {hoveredRow && champions[hoveredRow.entry.championId] ? (
                <KdaHoverCard
                  stats={champions[hoveredRow.entry.championId]}
                  rank={hoveredIndex + 1}
                  total={chartRows.length}
                  sortLabel={sortLabel}
                  modeLabel={modeLabel}
                />
              ) : null}
            </CursorTooltip>
          </div>
        )}

        {selectedEntry ? (
          <DetailBand
            icon={
              <div className="relative flex-none">
                <img
                  loading="lazy"
                  decoding="async"
                  src={championIconUrl(selectedEntry.championName)}
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
            title={displayName(selectedEntry.championName)}
            action={<DossierLink championId={selectedEntry.championId} />}
            subtitle={`${selectedEntry.games.toLocaleString()} GAMES`}
            stats={[
              {
                label: "KDA",
                value: selectedEntry.kda.toFixed(2),
                highlight: true,
                bordered: false,
              },
              {
                label: "KILLS",
                value: selectedEntry.kills.toLocaleString(),
              },
              {
                label: "DEATHS",
                value: selectedEntry.deaths.toLocaleString(),
              },
              {
                label: "ASSISTS",
                value: selectedEntry.assists.toLocaleString(),
              },
              {
                label: "BEST KDA GAME",
                value: `${selectedEntry.bestKdaLine.kills} / ${selectedEntry.bestKdaLine.deaths} / ${selectedEntry.bestKdaLine.assists}`,
                nowrap: true,
              },
              {
                label: "SOLO KILLS",
                value: selectedEntry.soloKills.toLocaleString(),
                nowrap: true,
              },
              {
                label: "LARGEST SPREE",
                value: selectedEntry.largestKillingSpree.toLocaleString(),
                nowrap: true,
              },
            ]}
            statsGrid="repeat(5,minmax(0,1fr)) 1.5fr 1fr"
          />
        ) : null}
      </HextechPanel>
    </CategorySection>
  );
};

export { KDA };
