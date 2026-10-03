import type { SummonerSpellCasts } from "@arena/types";

type Mode = "total" | "best" | "perGame";

/** "total" or a spell id. */
type Metric = "total" | `${number}`;

type Row = {
  championId: number;
  championName: string;
  matchesPlayed: number;
  /** Mode-dependent: season total, best single game, or per-game average. */
  active: SummonerSpellCasts;
  seasonTotal: SummonerSpellCasts;
  bestGame: SummonerSpellCasts;
};

export type { Metric, Mode, Row };
