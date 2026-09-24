import type { BannedChampionStats } from "@arena/types";
import { increment } from "../aggregate.js";
import type { StatsData } from "../loadStatsData.js";

/**
 * The bans the summoner's lobbies made. Bans are lobby-wide, stored once per
 * match (`matches.bannedChampionIds`, see CLAUDE.md §2), with `-1` for a slot
 * nobody used and the same champion possibly banned twice.
 */
export function buildBanStats({ games, participantsByMatch }: StatsData, championKey: (championId: number) => string) {
  // Ban rate counts a champion once per match, so it can't pass 100%.
  const matchesBanned = new Map<number, number>();
  // Raw slots, duplicates included, for the "X BANS" figure and the counters.
  const slotsByChampion = new Map<number, number>();
  let totalBans = 0;
  let noBanCount = 0;
  let duplicateBanCount = 0;

  const matchBans = games.map((game) => {
    const raw = game.bannedChampionIds ?? [];
    const banned = new Set<number>();
    for (const id of raw) {
      if (id <= 0) {
        noBanCount += 1;
        continue;
      }
      totalBans += 1;
      increment(slotsByChampion, id);
      if (banned.has(id)) duplicateBanCount += 1;
      else banned.add(id);
    }
    for (const id of banned) increment(matchesBanned, id);
    return {
      banned,
      isTop3: game.placement <= 3,
      // A champion only says something about a game if someone played it.
      picked: new Set((participantsByMatch.get(game.matchId) ?? []).map((player) => player.championId)),
    };
  });

  const champions: BannedChampionStats[] = [...matchesBanned]
    .map(([championId, bannedMatches]) => {
      let openAndPicked = 0;
      let openAndPickedTop3 = 0;
      for (const { banned, isTop3, picked } of matchBans) {
        if (banned.has(championId) || !picked.has(championId)) continue;
        openAndPicked += 1;
        if (isTop3) openAndPickedTop3 += 1;
      }
      return {
        championId,
        championName: championKey(championId),
        banRate: (bannedMatches / games.length) * 100,
        totalBans: slotsByChampion.get(championId) ?? 0,
        winRateWhenNotBanned: openAndPicked > 0 ? (openAndPickedTop3 / openAndPicked) * 100 : null,
        gamesOpenAndPicked: openAndPicked,
      };
    })
    .sort((a, b) => b.banRate - a.banRate || a.championId - b.championId);

  return { champions, totalBans, noBanCount, duplicateBanCount };
}
