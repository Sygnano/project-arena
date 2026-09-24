import { GUEST_OF_HONOR_CHAMPIONS, type AugmentCatalog } from "../../../leagueData/index.js";
import {
  addToSplit,
  addToTally,
  emptySplit,
  emptyTally,
  increment,
  type PlacementSplit,
  type WinTally,
} from "../aggregate.js";
import type { OwnGame } from "../loadStatsData.js";

/** Champions shown in an augment's hover card. */
const TOP_CHAMPIONS_PER_AUGMENT = 3;

/**
 * Augment picks. A player holds up to 4 per match, so these count picks, not
 * matches, and an augment's result is its match's placement. Augments are
 * sent as ids: names, icons and rarity come from the web app's catalog.
 */
export function buildAugmentStats(
  games: readonly OwnGame[],
  catalog: AugmentCatalog,
  championKey: (championId: number) => string,
) {
  const picks = new Map<number, number>();
  const splits = new Map<number, PlacementSplit>();
  /** championId -> augmentId -> tally. */
  const byChampion = new Map<number, Map<number, WinTally>>();

  for (const game of games) {
    let championTallies = byChampion.get(game.championId);
    if (!championTallies) byChampion.set(game.championId, (championTallies = new Map()));
    for (const augmentId of game.augments) {
      increment(picks, augmentId);
      let split = splits.get(augmentId);
      if (!split) splits.set(augmentId, (split = emptySplit()));
      addToSplit(split, game.placement);
      let tally = championTallies.get(augmentId);
      if (!tally) championTallies.set(augmentId, (tally = emptyTally()));
      addToTally(tally, game.placement);
    }
  }

  /** augmentId -> the champions it was picked on. */
  const championsByAugment = new Map<number, { championId: number; tally: WinTally }[]>();
  for (const [championId, tallies] of byChampion) {
    for (const [augmentId, tally] of tallies) {
      const list = championsByAugment.get(augmentId) ?? [];
      list.push({ championId, tally });
      championsByAugment.set(augmentId, list);
    }
  }

  // Guest of Honor and crafting augments aren't draft picks: they get their
  // own sections and stay out of the normal lists.
  const draftable = catalog.draftable();
  const draftableIds = new Set(draftable.map((augment) => augment.id));

  const augmentPicks = draftable
    .filter((augment) => picks.has(augment.id))
    .map((augment) => {
      const champions = championsByAugment.get(augment.id) ?? [];
      return {
        augmentId: augment.id,
        timesPicked: picks.get(augment.id)!,
        ...splits.get(augment.id)!,
        topChampions: [...champions]
          .sort((a, b) => b.tally.count - a.tally.count || b.tally.top3 - a.tally.top3 || a.championId - b.championId)
          .slice(0, TOP_CHAMPIONS_PER_AUGMENT)
          .map(({ championId, tally }) => ({
            championName: championKey(championId),
            games: tally.count,
            top3: tally.top3,
          })),
        championCount: champions.length,
      };
    })
    .sort((a, b) => b.timesPicked - a.timesPicked);

  const guestOfHonor = GUEST_OF_HONOR_CHAMPIONS.map((champion) => ({
    championId: champion.championId,
    championName: champion.championName,
    rows: champion.rows.map((row) => ({
      key: row.key,
      label: row.label,
      augments: row.augmentIds.map((augmentId) => ({
        augmentId,
        timesPicked: picks.get(augmentId) ?? 0,
        ...(splits.get(augmentId) ?? emptySplit()),
      })),
    })),
  }));

  const metaAugments = catalog.meta().map((augment) => ({
    augmentId: augment.id,
    timesPicked: picks.get(augment.id) ?? 0,
    ...(splits.get(augment.id) ?? emptySplit()),
  }));

  /** The champion dossier's list: draft picks only, most picked first. */
  const championAugments = (championId: number) =>
    [...(byChampion.get(championId) ?? [])]
      .filter(([augmentId]) => draftableIds.has(augmentId))
      .sort((a, b) => b[1].count - a[1].count || b[1].top3 - a[1].top3 || a[0] - b[0])
      .map(([augmentId, tally]) => ({ augmentId, timesPicked: tally.count, top1: tally.top1, top3: tally.top3 }));

  return {
    // Every draft augment, picked or not.
    augments: {
      augments: draftable.map((augment) => ({ augmentId: augment.id, timesPicked: picks.get(augment.id) ?? 0 })),
    },
    augmentPicks: { augments: augmentPicks },
    guestOfHonor: { champions: guestOfHonor },
    metaAugments: { augments: metaAugments },
    championAugments,
  };
}
