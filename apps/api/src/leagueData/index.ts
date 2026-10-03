/**
 * League static data: champions, items, summoner spells, Arena augments.
 * Everything comes from CommunityDragon's `latest` (the live patch), fetched
 * once per process on first use. Import from here. See README.md.
 */

export { type Augment, AugmentCatalog, getAugmentCatalog } from "./augments/augmentCatalog.js";
export { GUEST_OF_HONOR_CHAMPIONS } from "./augments/augmentGroups.js";
export { type ChampionCatalog, getChampionCatalog } from "./champions.js";
export { getGameCatalogJson } from "./gameCatalog.js";
export { getItemCatalog, type Item, ItemCatalog } from "./items/itemCatalog.js";
export { SHARDBLADE_ITEM_ID, SPECIAL_ITEM_IDS } from "./items/itemIds.js";
export { getSummonerSpells, type SummonerSpellInfo } from "./summonerSpells.js";
