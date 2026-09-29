import type { UtilityBreakdown } from "@arena/types";

type Mode = "perGame" | "total" | "best";

type Metric = "heal" | "cc";

type SortDir = "asc" | "desc";

type Row = {
  championId: number;
  championName: string;
  matchesPlayed: number;
  /** Mode-dependent (season total or independently-per-field best) — drives
   * the bars. */
  active: UtilityBreakdown;
  seasonTotal: UtilityBreakdown;
};

export type { Mode, Metric, SortDir, Row };
