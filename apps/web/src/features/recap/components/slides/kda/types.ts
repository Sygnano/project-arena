type Metric = "kills" | "deaths" | "assists" | "kda";

type Mode = "perGame" | "total" | "best";

/**
 * One champion's derived per-metric numbers for this chart — `kills`/
 * `deaths`/`assists`/`kda` are season totals (from `ChampionStats.kda`),
 * `best` is the single best-KDA match's boxscore (`ChampionKdaStats.bestGame`,
 * all three stats from the SAME match) plus that match's own KDA.
 * `soloKills`/`largestKillingSpree` come straight from `ChampionKdaStats` —
 * summed and single-match-max respectively, same as their page-wide
 * `KillsStats` analogs.
 */
type ChampionRosterEntry = {
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

type ChartRow = {
  entry: ChampionRosterEntry;
  value: number;
  height: number;
  isLeader: boolean;
  isSelected: boolean;
};

export type { ChampionRosterEntry, ChartRow, Metric, Mode };
