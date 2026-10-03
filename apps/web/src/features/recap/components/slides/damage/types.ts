import type { DamageBreakdown } from "@arena/types";

type Mode = "perGame" | "total" | "best";

type Metric = "total" | "physical" | "magical" | "trueDamage";

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

type SortDir = "asc" | "desc";

export type { Metric, Mode, Row, SortDir };
