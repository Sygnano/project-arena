import { ARENA_BOOT_ITEM_IDS } from "@arena/db";
import type { BootsStats } from "@arena/types";
import { SHARDBLADE_ITEM_ID, SPECIAL_ITEM_IDS, type ItemCatalog } from "../../../leagueData/index.js";
import { addToSplit, addToTally, emptySplit, emptyTally, increment, type PlacementSplit, type WinTally } from "../aggregate.js";
import type { OwnGame } from "../loadStatsData.js";

const bootIds = new Set(ARENA_BOOT_ITEM_IDS);
/** Items only ever granted, never bought: end-of-match `items` is their only trace. */
const heldOnlyIds = new Set([SHARDBLADE_ITEM_ID, ...SPECIAL_ITEM_IDS]);

type ChampionItems = Map<number, Map<number, WinTally>>;

function tallyChampionItem(byChampion: ChampionItems, game: OwnGame, itemId: number) {
  let tallies = byChampion.get(game.championId);
  if (!tallies) byChampion.set(game.championId, (tallies = new Map()));
  let tally = tallies.get(itemId);
  if (!tally) tallies.set(itemId, (tally = emptyTally()));
  addToTally(tally, game.placement);
}

/**
 * Items and boots. Arena players sell items mid-match, so "had this item"
 * means bought at any point (`purchasedItemIds`, from the timeline) or held
 * at the end (`items`), except the granted-only items, which only `items`
 * shows. Boots come from the timeline's purchases and sales (CLAUDE.md §2).
 * Items are sent as ids: names and icons come from the web app's catalog.
 */
export function buildItemStats(games: readonly OwnGame[], catalog: ItemCatalog) {
  const prismaticIds = new Set(catalog.prismaticItems().map((item) => item.id));
  /** itemId -> matches it was had in: Legendaries, the Shardblade, special items. */
  const outcomes = new Map<number, WinTally>();
  const prismaticHeld = new Map<number, number>();
  const prismaticSplits = new Map<number, PlacementSplit>();
  const legendaryByChampion: ChampionItems = new Map();
  const prismaticByChampion: ChampionItems = new Map();
  const heldOnlyByChampion: ChampionItems = new Map();
  const bootsByChampion: ChampionItems = new Map();

  const bootsBought = new Map<number, number>();
  const bootsSold = new Map<number, number>();
  const boots = {
    totalBought: 0,
    totalSold: 0,
    matchesWithoutBoots: 0,
    matchesFinishedBarefoot: 0,
    mostBoughtInOneMatch: 0,
    outcomes: {
      keptOn: { games: 0, top3Finishes: 0 },
      soldOff: { games: 0, top3Finishes: 0 },
      neverBought: { games: 0, top3Finishes: 0 },
    } satisfies BootsStats["outcomes"],
  };

  for (const game of games) {
    for (const itemId of new Set([...game.items, ...(game.purchasedItemIds ?? [])])) {
      const had = heldOnlyIds.has(itemId) ? game.items.includes(itemId) : catalog.isLegendary(itemId);
      if (!had) continue;
      let tally = outcomes.get(itemId);
      if (!tally) outcomes.set(itemId, (tally = emptyTally()));
      addToTally(tally, game.placement);
      if (!heldOnlyIds.has(itemId)) tallyChampionItem(legendaryByChampion, game, itemId);
    }

    for (const itemId of new Set(game.items)) {
      if (heldOnlyIds.has(itemId)) tallyChampionItem(heldOnlyByChampion, game, itemId);
      if (!prismaticIds.has(itemId)) continue;
      tallyChampionItem(prismaticByChampion, game, itemId);
      increment(prismaticHeld, itemId);
      let split = prismaticSplits.get(itemId);
      if (!split) prismaticSplits.set(itemId, (split = emptySplit()));
      addToSplit(split, game.placement);
    }

    // Null: a match from before timelines were stored, where "no boots" is
    // unknown rather than zero, so it's left out.
    if (game.bootsBought && game.bootsSold) {
      for (const itemId of game.bootsBought) increment(bootsBought, itemId);
      for (const itemId of new Set(game.bootsBought)) tallyChampionItem(bootsByChampion, game, itemId);
      for (const itemId of game.bootsSold) increment(bootsSold, itemId);
      boots.totalBought += game.bootsBought.length;
      boots.totalSold += game.bootsSold.length;
      boots.mostBoughtInOneMatch = Math.max(boots.mostBoughtInOneMatch, game.bootsBought.length);
      if (game.bootsBought.length === 0) boots.matchesWithoutBoots += 1;
      const barefoot = !game.items.some((itemId) => bootIds.has(itemId));
      if (barefoot) boots.matchesFinishedBarefoot += 1;
      const outcome =
        game.bootsBought.length === 0
          ? boots.outcomes.neverBought
          : barefoot
            ? boots.outcomes.soldOff
            : boots.outcomes.keptOn;
      outcome.games += 1;
      if (game.placement <= 3) outcome.top3Finishes += 1;
    }
  }

  const toOutcome = (itemId: number) => {
    const tally = outcomes.get(itemId) ?? emptyTally();
    return { itemId, timesPicked: tally.count, top1: tally.top1, top3: tally.top3 };
  };

  const prismaticCatalog = catalog.prismaticItems();
  const prismaticItemPicks = prismaticCatalog
    .filter((item) => prismaticHeld.has(item.id))
    .map((item) => ({
      itemId: item.id,
      timesHeld: prismaticHeld.get(item.id)!,
      ...prismaticSplits.get(item.id)!,
    }))
    .sort((a, b) => b.timesHeld - a.timesHeld);

  // Every boot, bought or not, so the chart's legend shows the unused ones too.
  const bootCatalog = catalog.arenaBoots();

  /** A champion's items, most games first (ties by id, for a stable order). */
  const ranked = (tallies: Map<number, WinTally> | undefined) =>
    [...(tallies ?? [])]
      .sort((a, b) => b[1].count - a[1].count || a[0] - b[0])
      .map(([itemId, tally]) => ({ itemId, count: tally.count, top1: tally.top1, top3: tally.top3 }));

  return {
    specialItems: SPECIAL_ITEM_IDS.map(toOutcome),
    legendaryItems: [...outcomes.keys()]
      .filter((itemId) => catalog.isLegendary(itemId))
      .map(toOutcome)
      .sort((a, b) => b.timesPicked - a.timesPicked || b.top3 - a.top3 || a.itemId - b.itemId),
    prismaticItems: {
      items: prismaticCatalog.map((item) => ({
        itemId: item.id,
        timesHeld: prismaticHeld.get(item.id) ?? 0,
      })),
    },
    prismaticItemPicks: { items: prismaticItemPicks },
    boots: {
      boots: bootCatalog
        .map((boot) => ({
          itemId: boot.id,
          timesBought: bootsBought.get(boot.id) ?? 0,
          timesSold: bootsSold.get(boot.id) ?? 0,
        }))
        .sort((a, b) => b.timesBought - a.timesBought || a.itemId - b.itemId),
      goldSpent: bootCatalog.reduce((total, boot) => total + (bootsBought.get(boot.id) ?? 0) * boot.goldTotal, 0),
      ...boots,
    },
    shardblade: toOutcome(SHARDBLADE_ITEM_ID),
    championItems: (championId: number) => ({
      legendary: ranked(legendaryByChampion.get(championId)),
      prismatic: ranked(prismaticByChampion.get(championId)),
      special: ranked(heldOnlyByChampion.get(championId)),
      boots: ranked(bootsByChampion.get(championId)),
    }),
  };
}
