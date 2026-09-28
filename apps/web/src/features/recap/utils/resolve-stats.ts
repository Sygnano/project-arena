import type { GameCatalog, SummonerStatsPayload, SummonerStatsResponse } from "@arena/types";

/**
 * Turns a recap as the API sends it (items and augments as ids, no champion
 * list) into the shape the page's modules read, by looking every id up in the
 * game catalog. The names and icons are references into the catalog, not
 * copies. An id missing from the catalog (a new patch not picked up yet)
 * gets a placeholder name and no icon.
 */
export function resolveStats(payload: SummonerStatsPayload, catalog: GameCatalog): SummonerStatsResponse {
  const item = (itemId: number) => {
    const entry = catalog.items[itemId];
    return { itemName: entry?.name ?? `Item ${itemId}`, iconUrl: entry?.iconUrl ?? "" };
  };
  const augment = (augmentId: number) => {
    const entry = catalog.augments[augmentId];
    return {
      augmentName: entry?.name ?? `Augment ${augmentId}`,
      iconUrl: entry?.iconUrl ?? "",
      rarity: entry?.rarity ?? -1,
    };
  };
  const withItem = <T extends { itemId: number }>(row: T) => ({ ...row, ...item(row.itemId) });
  const withAugment = <T extends { augmentId: number }>(row: T) => ({ ...row, ...augment(row.augmentId) });
  const withAugmentName = <T extends { augmentId: number }>(row: T) => ({
    ...row,
    augmentName: augment(row.augmentId).augmentName,
  });
  const withAugmentFace = <T extends { augmentId: number }>(row: T) => {
    const { augmentName, iconUrl } = augment(row.augmentId);
    return { ...row, augmentName, iconUrl };
  };

  const champions = Object.entries(catalog.champions);
  return {
    ...payload,
    augments: { augments: payload.augments.augments.map(withAugment) },
    augmentPicks: { augments: payload.augmentPicks.augments.map(withAugmentName) },
    guestOfHonor: {
      champions: payload.guestOfHonor.champions.map((champion) => ({
        ...champion,
        rows: champion.rows.map((row) => ({ ...row, augments: row.augments.map(withAugmentFace) })),
      })),
    },
    metaAugments: { augments: payload.metaAugments.augments.map(withAugmentFace) },
    prismaticItems: { items: payload.prismaticItems.items.map(withItem) },
    prismaticItemPicks: {
      items: payload.prismaticItemPicks.items.map((row) => ({ ...row, itemName: item(row.itemId).itemName })),
    },
    specialItems: payload.specialItems.map(withItem),
    legendaryItems: payload.legendaryItems.map(withItem),
    boots: { ...payload.boots, boots: payload.boots.boots.map(withItem) },
    economy: { ...payload.economy, shardblade: withItem(payload.economy.shardblade) },
    champions: Object.fromEntries(
      Object.entries(payload.champions).map(([id, champion]) => [
        id,
        {
          ...champion,
          items: {
            legendary: champion.items.legendary.map(withItem),
            prismatic: champion.items.prismatic.map(withItem),
            special: champion.items.special.map(withItem),
            boots: champion.items.boots.map(withItem),
          },
          augments: champion.augments.map(withAugment),
        },
      ]),
    ),
    championCatalog: {
      champions: champions
        .map(([id, { key }]) => ({ championId: Number(id), championName: key }))
        .sort((a, b) => a.championName.localeCompare(b.championName)),
    },
    championDisplayNames: Object.fromEntries(champions.map(([, { key, name }]) => [key.toLowerCase(), name])),
  };
}
