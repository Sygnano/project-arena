import type { AbilityCastBreakdown } from "@arena/types";

type SpellKey = keyof AbilityCastBreakdown;

type Mode = "perGame" | "total" | "best";

type Metric = "total" | SpellKey;

type Row = {
  championId: number;
  championName: string;
  matchesPlayed: number;
  /** Mode-dependent (season total or single best-game breakdown) — drives
   * the stacked bar and the TOTAL column. */
  active: AbilityCastBreakdown;
  seasonTotal: AbilityCastBreakdown;
  bestGame: AbilityCastBreakdown;
  /** Unlike Damage's `bestByType`, there's no independently-per-key-maxed
   * field for ability casts — `ChampionAbilityStats` only carries `total`
   * and one single-match `maxGame` breakdown (see .claude/rules/arena-data.md on why: Riot
   * gives ability casts as a flat total per match, not per-type maxes). So
   * in BEST mode this is just `maxGame` again, the same single game's
   * numbers the stacked bar already reads — not an independent per-key best
   * the way Damage's PHYS/MAGIC/TRUE columns are. */
  activeByType: AbilityCastBreakdown;
};

type SortDir = "asc" | "desc";

export type { Metric, Mode, Row, SortDir, SpellKey };
