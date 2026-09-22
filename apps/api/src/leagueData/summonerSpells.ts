import { fetchSummonerSpells } from "./communityDragon/fetch.js";
import { gameDataAssetUrl } from "./communityDragon/urls.js";
import { memoizeAsync } from "./memoize.js";

export interface SummonerSpellInfo {
  name: string;
  iconUrl: string;
}

/**
 * Summoner spell id (Match-V5's `summoner1Id`/`summoner2Id`) -> name and
 * icon. Arena has its own two, `2202` Flash and `2201` Flee, listed beside
 * the Summoner's Rift ones.
 */
export const getSummonerSpells = memoizeAsync(async () => {
  const byId = new Map<number, SummonerSpellInfo>();
  for (const spell of await fetchSummonerSpells()) {
    byId.set(spell.id, { name: spell.name, iconUrl: gameDataAssetUrl(spell.iconPath) });
  }
  return byId;
});
