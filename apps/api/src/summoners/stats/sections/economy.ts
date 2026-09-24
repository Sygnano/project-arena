import { LEGENDARY_ANVIL_ITEM_IDS, PRISMATIC_ANVIL_ITEM_ID, STAT_ANVIL_ITEM_ID } from "@arena/db";
import type { SummonerStatsPayload } from "@arena/types";
import type { ItemCatalog } from "../../../leagueData/index.js";
import { maxOf, sumOf } from "../aggregate.js";
import type { OwnGame } from "../loadStatsData.js";

// The 6 Legendary anvils (one per item class) share one price.
const [LEGENDARY_ANVIL_ITEM_ID] = LEGENDARY_ANVIL_ITEM_IDS;

/** Gold, purchases and anvils. `shardblade` comes from the item section. */
export function buildEconomyStats(
  games: readonly OwnGame[],
  catalog: ItemCatalog,
  shardblade: SummonerStatsPayload["economy"]["shardblade"],
) {
  const anvils = {
    stat: sumOf(games, (game) => game.statAnvilsBought),
    legendary: sumOf(games, (game) => game.legendaryAnvilsBought),
    prismatic: sumOf(games, (game) => game.prismaticAnvilsBought),
  };
  return {
    totalGoldEarned: sumOf(games, (game) => game.goldEarned),
    mostGoldInOneGame: maxOf(games, (game) => game.goldEarned),
    itemsPurchased: sumOf(games, (game) => game.itemsPurchased),
    consumablesPurchased: sumOf(games, (game) => game.consumablesPurchased),
    anvils,
    mostStatAnvilsInOneMatch: maxOf(games, (game) => game.statAnvilsBought),
    anvilGoldSpent: {
      stat: anvils.stat * catalog.get(STAT_ANVIL_ITEM_ID).goldTotal,
      legendary: anvils.legendary * catalog.get(LEGENDARY_ANVIL_ITEM_ID!).goldTotal,
      prismatic: anvils.prismatic * catalog.get(PRISMATIC_ANVIL_ITEM_ID).goldTotal,
    },
    shardblade,
  };
}
