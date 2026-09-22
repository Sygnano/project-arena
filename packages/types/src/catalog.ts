import type {
  AugmentPickBreakdown,
  AugmentStats,
  BootsStats,
  BootStats,
  ChampionAugmentStats,
  ChampionItemBuckets,
  ChampionItemStats,
  ChampionStats,
  EconomyStats,
  GuestOfHonorAugmentStats,
  GuestOfHonorChampionStats,
  GuestOfHonorRow,
  ItemOutcomeStats,
  MetaAugmentStats,
  PrismaticItemPickBreakdown,
  PrismaticItemStats,
  SummonerStatsResponse,
} from "./stats.js";

/**
 * The names and icons behind the ids in a recap (`GET /catalog`), sent to
 * the web app once instead of repeated in every recap. The API builds it from
 * CommunityDragon (apps/api/src/leagueData); the web app resolves a
 * `SummonerStatsPayload` against it into a `SummonerStatsResponse`.
 */
export interface GameCatalog {
  /** Every playable champion. `key` is Riot's (`MonkeyKing`), for icon URLs;
   * `name` is the one to show (`Wukong`). */
  champions: Record<number, { key: string; name: string }>;
  /** The items a recap can show: Legendary, Prismatic, special, boots, Shardblade. */
  items: Record<number, { name: string; iconUrl: string }>;
  /** Every Arena augment. `rarity`: 0 Silver, 1 Gold, 2 Prismatic, 4 internal. */
  augments: Record<number, { name: string; iconUrl: string; rarity: number }>;
}

type ItemRef<T> = Omit<T, Extract<keyof T, "itemName" | "iconUrl">>;
type AugmentRef<T> = Omit<T, Extract<keyof T, "augmentName" | "iconUrl" | "rarity">>;

export type ChampionStatsPayload = Omit<ChampionStats, "items" | "augments"> & {
  items: { [Bucket in keyof ChampionItemBuckets]: ItemRef<ChampionItemStats>[] };
  augments: AugmentRef<ChampionAugmentStats>[];
};

/**
 * A recap as the API sends it (`GET .../stats`, the refresh stream's `stats`
 * event): `SummonerStatsResponse` with items and augments reduced to their
 * ids, and without the champion list and display names, all of which the
 * web app takes from the `GameCatalog`.
 */
export type SummonerStatsPayload = Omit<
  SummonerStatsResponse,
  | "augments"
  | "augmentPicks"
  | "guestOfHonor"
  | "metaAugments"
  | "prismaticItems"
  | "prismaticItemPicks"
  | "specialItems"
  | "legendaryItems"
  | "boots"
  | "economy"
  | "champions"
  | "championCatalog"
  | "championDisplayNames"
> & {
  augments: { augments: AugmentRef<AugmentStats>[] };
  augmentPicks: { augments: AugmentRef<AugmentPickBreakdown>[] };
  guestOfHonor: {
    champions: (Omit<GuestOfHonorChampionStats, "rows"> & {
      rows: (Omit<GuestOfHonorRow, "augments"> & { augments: AugmentRef<GuestOfHonorAugmentStats>[] })[];
    })[];
  };
  metaAugments: { augments: AugmentRef<MetaAugmentStats>[] };
  prismaticItems: { items: ItemRef<PrismaticItemStats>[] };
  prismaticItemPicks: { items: ItemRef<PrismaticItemPickBreakdown>[] };
  specialItems: ItemRef<ItemOutcomeStats>[];
  legendaryItems: ItemRef<ItemOutcomeStats>[];
  boots: Omit<BootsStats, "boots"> & { boots: ItemRef<BootStats>[] };
  economy: Omit<EconomyStats, "shardblade"> & { shardblade: ItemRef<ItemOutcomeStats> };
  champions: Record<number, ChampionStatsPayload>;
};
