import { fetchChampions } from "./communityDragon/fetch.js";
import { memoizeAsync } from "./memoize.js";

export interface ChampionCatalog {
  /** Champion id -> Riot key (`62` -> `"MonkeyKing"`), the form Match-V5's
   * `championName` and apps/web's `championIconUrl()` use. Covers champions
   * no tracked match has ever seen, e.g. one banned in every game. */
  keysById: Map<number, string>;
  /** Lowercased Riot key -> display name (`"monkeyking"` -> `"Wukong"`). The
   * key is right for asset URLs, never to show a person. Lowercased because
   * sources disagree on casing (`FiddleSticks` / `Fiddlesticks`). */
  displayNames: Record<string, string>;
}

/** The list also carries `-1` "None" and mode-only variants (`Jade_Annie`,
 * ids 60000+); no real champion's key has an underscore. */
function isPlayableChampion(champion: { id: number; alias: string }) {
  return champion.id > 0 && !champion.alias.includes("_");
}

export const getChampionCatalog = memoizeAsync(async (): Promise<ChampionCatalog> => {
  const keysById = new Map<number, string>();
  const displayNames: Record<string, string> = {};
  for (const champion of (await fetchChampions()).filter(isPlayableChampion)) {
    keysById.set(champion.id, champion.alias);
    displayNames[champion.alias.toLowerCase()] = champion.name;
  }
  return { keysById, displayNames };
});
