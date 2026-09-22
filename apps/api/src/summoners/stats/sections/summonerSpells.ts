import type {
  ChampionSummonerSpellStats,
  SummonerSpellCasts,
  SummonerSpellsStats,
} from "@arena/types";
import type { SummonerSpellInfo } from "../../../leagueData/index.js";
import type { OwnGame } from "../loadStatsData.js";

function gameCasts(game: OwnGame): SummonerSpellCasts {
  const casts: SummonerSpellCasts = {};
  // Slot order varies between players (Flash is D for some, F for others),
  // so each slot's casts go to that slot's own spell id.
  for (const [id, count] of [
    [game.summonerSpell1Id, game.summonerSpell1Casts],
    [game.summonerSpell2Id, game.summonerSpell2Casts],
  ] as const) {
    if (id !== null && id > 0) casts[id] = (casts[id] ?? 0) + (count ?? 0);
  }
  return casts;
}

function addInto(target: SummonerSpellCasts, casts: SummonerSpellCasts) {
  for (const [id, count] of Object.entries(casts)) {
    target[Number(id)] = (target[Number(id)] ?? 0) + count;
  }
}

function sumCasts(casts: SummonerSpellCasts): number {
  return Object.values(casts).reduce((sum, count) => sum + count, 0);
}

/** Summoner spell casts, overall and per champion. Games parsed before spell
 * ids were stored (null ids) contribute nothing. */
export function buildSummonerSpellStats(
  rows: readonly OwnGame[],
  spellInfo: ReadonlyMap<number, SummonerSpellInfo>,
): SummonerSpellsStats {
  const total: SummonerSpellCasts = {};
  const gamesBySpell = new Map<number, number>();
  let maxGame: SummonerSpellCasts = {};
  const byChampion = new Map<number, ChampionSummonerSpellStats>();

  for (const row of rows) {
    const casts = gameCasts(row);
    addInto(total, casts);
    for (const id of Object.keys(casts)) {
      gamesBySpell.set(Number(id), (gamesBySpell.get(Number(id)) ?? 0) + 1);
    }
    if (sumCasts(casts) > sumCasts(maxGame)) maxGame = casts;

    let champion = byChampion.get(row.championId);
    if (!champion) {
      champion = {
        championId: row.championId,
        championName: row.championName,
        matchesPlayed: 0,
        total: {},
        maxGame: {},
      };
      byChampion.set(row.championId, champion);
    }
    champion.matchesPlayed += 1;
    addInto(champion.total, casts);
    if (sumCasts(casts) > sumCasts(champion.maxGame)) champion.maxGame = casts;
  }

  const spells = [...gamesBySpell.entries()]
    .map(([spellId, games]) => {
      const info = spellInfo.get(spellId);
      return {
        spellId,
        name: info?.name ?? `Spell ${spellId}`,
        iconUrl: info?.iconUrl ?? "",
        games,
      };
    })
    .sort((a, b) => (total[b.spellId] ?? 0) - (total[a.spellId] ?? 0));

  return {
    spells,
    total,
    maxGame,
    champions: [...byChampion.values()].sort(
      (a, b) => b.matchesPlayed - a.matchesPlayed || a.championId - b.championId,
    ),
  };
}
