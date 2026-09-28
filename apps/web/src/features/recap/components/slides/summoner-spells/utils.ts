import type { SummonerSpellCasts } from "@arena/types";
import { formatCompact } from "@/utils/format";
import type { Mode } from "./types";

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

export { sumCasts, perGameCasts, formatCasts };
