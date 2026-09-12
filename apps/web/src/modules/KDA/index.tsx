"use client";

import { useMemo, useState } from "react";
import type { ChampionStats } from "@arena/types";
import { CategorySection } from "@/components/category-section";
import { HextechPanel } from "@/components/hextech-panel";
import {
  HextechBarChart,
  type BarColumn,
} from "@/components/hextech-bar-chart";
import { championIconUrl } from "@/lib/riot";
import { Dial } from "@/components/dial";
import { DetailBand } from "@/components/detail-band";
import { DiamondTabs } from "@/components/diamond-tabs";
import { FadingRule } from "@/components/fading-rule";
import { TIER_STYLE, type TierStyle } from "@/lib/tier-bars";

type Props = {
  kills: number;
  deaths: number;
  assists: number;
  kda: number;
  champions: Record<number, ChampionStats>;
  /** Label shown on the bottom handoff cue — the section this scrolls to
   * when clicked. Defaults to whatever module actually follows KDA on the
   * summoner page today; pass explicitly if that ever changes rather than
   * relying on the default silently going stale. */
  nextSectionLabel?: string;
};

export type Metric = "kills" | "deaths" | "assists" | "kda";
export type Mode = "total" | "best";

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
  best: { kills: number; deaths: number; assists: number; kda: number };
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

const BAR_MIN_HEIGHT = 14;
const BAR_MAX_HEIGHT = 300;

function formatValue(value: number, metric: Metric): string {
  return metric === "kda"
    ? value.toFixed(2)
    : Math.round(value).toLocaleString();
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
function toBarColumns(rows: ChartRow[], metric: Metric): BarColumn[] {
  return rows.map((row, index) => {
    const tier = tierForBar(index);
    return {
      id: row.entry.championId,
      topLabel: formatValue(row.value, metric),
      isLeader: row.isLeader,
      isSelected: row.isSelected,
      icon: (
        <img
          src={championIconUrl(row.entry.championName)}
          alt={row.entry.championName}
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

/**
 * `champions` is the per-champion KDA/damage/ability totals slice of the
 * stats response — `championPicks` isn't needed here anymore, since
 * `soloKills`/`largestKillingSpree` live directly on `ChampionKdaStats`.
 */
function buildRoster(
  champions: Record<number, ChampionStats>,
): ChampionRosterEntry[] {
  return Object.values(champions).map((champion) => {
    const {
      totalKills,
      totalDeaths,
      totalAssists,
      bestGame,
      soloKills,
      largestKillingSpree,
    } = champion.kda;
    const kda =
      totalDeaths === 0
        ? totalKills + totalAssists
        : (totalKills + totalAssists) / totalDeaths;
    const bestKda =
      (bestGame.kills + bestGame.assists) / Math.max(1, bestGame.deaths);
    return {
      championId: champion.championId,
      championName: champion.championName,
      games: champion.matchesPlayed,
      kills: totalKills,
      deaths: totalDeaths,
      assists: totalAssists,
      kda,
      best: {
        kills: bestGame.kills,
        deaths: bestGame.deaths,
        assists: bestGame.assists,
        kda: bestKda,
      },
      soloKills,
      largestKillingSpree,
    };
  });
}

function metricValue(
  entry: ChampionRosterEntry,
  metric: Metric,
  mode: Mode,
): number {
  return mode === "best" ? entry.best[metric] : entry[metric];
}

/**
 * Ranks the roster by the active metric/mode and maps each value to a bar
 * height. Two rules carry meaning here (see the design handoff's
 * "Ranking rules" section) and must not be simplified away:
 * - DEATHS+BEST GAME sorts ascending (fewest deaths wins) *and* inverts the
 *   height mapping, so the best result still renders as the tallest bar —
 *   taller must always mean better.
 * - KDA uses a raised floor (`lo - (hi-lo)*0.45`, clamped to 0) rather than
 *   scaling from 0, since KDA values cluster in a narrow band and scaling
 *   from a true zero baseline would flatten every bar to nearly the same
 *   height.
 */
function buildChartRows(
  roster: ChampionRosterEntry[],
  metric: Metric,
  mode: Mode,
  selectedChampionId: number | null,
): ChartRow[] {
  if (roster.length === 0) return [];

  const lowestIsBest = metric === "deaths" && mode === "best";
  const ranked = roster
    .map((entry) => ({ entry, value: metricValue(entry, metric, mode) }))
    .sort((a, b) => (lowestIsBest ? a.value - b.value : b.value - a.value));

  const values = ranked.map((row) => row.value);
  const hi = Math.max(...values);
  const lo = Math.min(...values);
  const floor = metric === "kda" ? Math.max(0, lo - (hi - lo) * 0.45) : 0;
  const span = Math.max(0.001, hi - floor);

  const heightFor = (v: number) =>
    lowestIsBest
      ? Math.max(
          BAR_MIN_HEIGHT,
          Math.round(((hi + 1 - v) / (hi + 1 - lo)) * BAR_MAX_HEIGHT),
        )
      : Math.max(
          BAR_MIN_HEIGHT,
          Math.round(((v - floor) / span) * BAR_MAX_HEIGHT),
        );

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
const KDA = ({
  kills,
  deaths,
  assists,
  kda,
  champions,
  nextSectionLabel = "KILLS",
}: Props) => {
  const [metric, setMetric] = useState<Metric>("kills");
  const [mode, setMode] = useState<Mode>("total");

  const roster = useMemo(() => buildRoster(champions), [champions]);

  const [selectedChampionId, setSelectedChampionId] = useState<number | null>(
    () =>
      buildChartRows(roster, "kills", "total", null)[0]?.entry.championId ??
      null,
  );

  const chartRows = useMemo(
    () => buildChartRows(roster, metric, mode, selectedChampionId),
    [roster, metric, mode, selectedChampionId],
  );

  const barColumns = useMemo(
    () => toBarColumns(chartRows, metric),
    [chartRows, metric],
  );

  const selectedEntry =
    roster.find((entry) => entry.championId === selectedChampionId) ??
    roster[0] ??
    null;

  const modeLabel = mode === "total" ? "SEASON TOTAL" : "BEST SINGLE GAME";
  // DEATHS+BEST sorts ascending (see `buildChartRows`'s doc comment) — called
  // out as "FEWEST" rather than just naming the metric, since lower-is-better
  // is the opposite of every other column here.
  const sortLabel =
    mode === "best" && metric === "deaths"
      ? "FEWEST DEATHS"
      : METRIC_LABEL[metric];
  const modeCaption = `${modeLabel} · SORTED · BY ${sortLabel}`;

  return (
    <CategorySection
      title="KDA"
      quote="Everyone's got a plan, 'til they get slammed into the ground."
      imageUrl="/images/kda-bg.jpg"
      nextSectionLabel={nextSectionLabel}
      sidebar={
        <>
          <Dial value={kda} label="KDA" />

          <div className="mt-auto flex flex-col gap-0.5">
            {(
              [
                ["KILLS", kills],
                ["DEATHS", deaths],
                ["ASSISTS", assists],
              ] as const
            ).map(([label, value], index, all) => (
              <div
                key={label}
                className="flex items-center gap-3.5 px-1 py-3.25"
                style={{
                  borderTop: "1px solid rgba(200,170,110,.14)",
                  borderBottom:
                    index === all.length - 1
                      ? "1px solid rgba(200,170,110,.14)"
                      : undefined,
                }}
              >
                <div className="h-1.75 w-1.75 flex-none rotate-45 bg-lol-gold-300" />
                <div className="flex-1 text-sm tracking-[.12em] text-lol-text-secondary">
                  {label}
                </div>
                <div className="font-display text-[22px] text-lol-gold-50">
                  {value.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </>
      }
    >
      <HextechPanel>
        <div className="mb-5 flex items-center gap-6">
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
            onChange={setMetric}
            gap={18}
          />
          <FadingRule />
          <div className="text-[11px] tracking-[.28em] text-lol-text-muted">
            {modeCaption}
          </div>
        </div>

        {roster.length === 0 ? (
          <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-lol-text-muted">
            No tracked matches yet.
          </div>
        ) : (
          <HextechBarChart
            columns={barColumns}
            onSelect={(id) => setSelectedChampionId(id as number)}
          />
        )}

        {selectedEntry ? (
          <DetailBand
            icon={
              <div className="relative flex-none">
                <img
                  src={championIconUrl(selectedEntry.championName)}
                  alt={selectedEntry.championName}
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
            title={selectedEntry.championName}
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
                label: "BEST GAME",
                value: `${selectedEntry.best.kills} / ${selectedEntry.best.deaths} / ${selectedEntry.best.assists}`,
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
