import type { ChampionStats } from "@arena/types";
import type { BarColumn } from "@/components/hextech-bar-chart";
import { championIconUrl } from "@/utils/riot";
import { type TierStyle, TIER_STYLE } from "@/utils/tier-bars";
import { barHeight } from "@/utils/bar-scale";
import { isLowSample, sortByRate } from "@/features/recap/utils/sample";
import { BAR_MAX_HEIGHT, BAR_MIN_HEIGHT, METRIC_LABEL } from "./constants";
import type { ChampionRosterEntry, ChartRow, Metric, Mode } from "./types";

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

export { toBarColumns, buildRoster, buildChartRows };
