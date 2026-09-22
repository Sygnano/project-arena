/**
 * League static data: champions, items, summoner spells, Arena augments.
 * Everything comes from CommunityDragon's `latest` (the live patch), fetched
 * once per process on first use. Import from here. See README.md.
 */
export { getChampionCatalog, type ChampionCatalog } from "./champions.js";
export { getSummonerSpells, type SummonerSpellInfo } from "./summonerSpells.js";
export { getItemCatalog, ItemCatalog, type Item } from "./items/itemCatalog.js";
export { SHARDBLADE_ITEM_ID, SPECIAL_ITEM_IDS } from "./items/itemIds.js";
export { getAugmentCatalog, AugmentCatalog, type Augment } from "./augments/augmentCatalog.js";
export { GUEST_OF_HONOR_CHAMPIONS } from "./augments/augmentGroups.js";
export { getGameCatalogJson } from "./gameCatalog.js";
