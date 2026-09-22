import type { GameCatalog } from "@arena/types";
import { getAugmentCatalog } from "./augments/augmentCatalog.js";
import { getChampionCatalog } from "./champions.js";
import { getItemCatalog } from "./items/itemCatalog.js";
import { SHARDBLADE_ITEM_ID, SPECIAL_ITEM_IDS } from "./items/itemIds.js";
import { memoizeAsync } from "./memoize.js";

/**
 * The names and icons behind a recap's ids, for the web app (`GET /catalog`):
 * sent once and cached there, so recaps carry only ids. Items are limited to
 * the ones a recap can show (Legendary, Prismatic, special, boots,
 * Shardblade), not CommunityDragon's whole list. Serialized once too.
 */
export const getGameCatalogJson = memoizeAsync(async () => {
  const [champions, items, augments] = await Promise.all([getChampionCatalog(), getItemCatalog(), getAugmentCatalog()]);

  const displayNameByKey = champions.displayNames;
  const recapItems = new Map<number, { name: string; iconUrl: string }>();
  const add = (id: number) => {
    const item = items.get(id);
    recapItems.set(id, { name: item.name, iconUrl: item.iconUrl });
  };
  for (const item of items.all()) if (items.isLegendary(item.id)) add(item.id);
  for (const item of [...items.prismaticItems(), ...items.arenaBoots()]) add(item.id);
  for (const id of [...SPECIAL_ITEM_IDS, SHARDBLADE_ITEM_ID]) add(id);

  const catalog: GameCatalog = {
    champions: Object.fromEntries(
      [...champions.keysById].map(([id, key]) => [id, { key, name: displayNameByKey[key.toLowerCase()] ?? key }]),
    ),
    items: Object.fromEntries(recapItems),
    augments: Object.fromEntries(
      augments.all().map((augment) => [augment.id, { name: augment.name, iconUrl: augment.iconUrl, rarity: augment.rarity }]),
    ),
  };
  return JSON.stringify(catalog);
});
