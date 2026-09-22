import type { AbilityCastBreakdown, DamageBestGames, DamageBreakdown } from "@arena/types";
import { maxBy, maxOf, sumOf } from "../aggregate.js";
import type { OwnGame } from "../loadStatsData.js";

/**
 * Totals and single-game records built the same way for the whole account
 * and for each champion, so both are one function over a list of games.
 */

const NO_DAMAGE: DamageBreakdown = { physical: 0, magical: 0, trueDamage: 0 };
const NO_CASTS: AbilityCastBreakdown = { q: 0, w: 0, e: 0, r: 0 };

type DamageSide = "dealt" | "taken";

function damageOf(game: OwnGame, side: DamageSide): DamageBreakdown {
  return side === "dealt"
    ? {
        physical: game.damageDealtToChampionsPhysical ?? 0,
        magical: game.damageDealtToChampionsMagic ?? 0,
        trueDamage: game.damageDealtToChampionsTrue ?? 0,
      }
    : {
        physical: game.damageTakenPhysical ?? 0,
        magical: game.damageTakenMagic ?? 0,
        trueDamage: game.damageTakenTrue ?? 0,
      };
}

const sumDamage = (damage: DamageBreakdown) => damage.physical + damage.magical + damage.trueDamage;

/**
 * Damage dealt to or taken from champions: the total, the split of the one
 * game with the most (a real game's split, never per-type maxima stitched
 * from different games), and for each type the game where that type peaked.
 * "Most dealt" ranks by Riot's own total, which can sit a point or two above
 * the sum of the three splits.
 */
export function damageStats(games: readonly OwnGame[], side: DamageSide) {
  const splits = games.map((game) => damageOf(game, side));
  const maxGame =
    side === "dealt"
      ? maxBy(games, (game) => game.damageDealtToChampions)
      : maxBy(games, (game) => sumDamage(damageOf(game, "taken")));
  const bestOfType = (type: keyof DamageBreakdown) =>
    splits.reduce<DamageBreakdown>((best, split) => (split[type] > best[type] ? split : best), NO_DAMAGE);
  const bestGameByType: DamageBestGames = {
    physical: bestOfType("physical"),
    magical: bestOfType("magical"),
    trueDamage: bestOfType("trueDamage"),
  };
  return {
    total: {
      physical: sumOf(splits, (split) => split.physical),
      magical: sumOf(splits, (split) => split.magical),
      trueDamage: sumOf(splits, (split) => split.trueDamage),
    },
    maxGame: maxGame ? damageOf(maxGame, side) : NO_DAMAGE,
    bestGameByType,
  };
}

function castsOf(game: OwnGame): AbilityCastBreakdown {
  return { q: game.qCasts ?? 0, w: game.wCasts ?? 0, e: game.eCasts ?? 0, r: game.rCasts ?? 0 };
}

/** Q/W/E/R casts: the total, and the split of the game with the most casts. */
export function abilityCasts(games: readonly OwnGame[]) {
  const best = maxBy(games, (game) => {
    const casts = castsOf(game);
    return casts.q + casts.w + casts.e + casts.r;
  });
  return {
    total: {
      q: sumOf(games, (game) => game.qCasts),
      w: sumOf(games, (game) => game.wCasts),
      e: sumOf(games, (game) => game.eCasts),
      r: sumOf(games, (game) => game.rCasts),
    },
    maxGame: best ? castsOf(best) : NO_CASTS,
  };
}

/** Healing/shielding, CC and saves: totals, and each one's best game on its
 * own (they rarely peak in the same game). */
export function utilityStats(games: readonly OwnGame[]) {
  return {
    total: {
      healingAndShielding: sumOf(games, (game) => game.healingAndShielding),
      ccScoreSeconds: sumOf(games, (game) => game.ccScoreSeconds),
      ccTimeDealt: sumOf(games, (game) => game.ccTotalTimeDealt),
      savesFromDeath: sumOf(games, (game) => game.saveAllyFromDeath),
    },
    bestByType: {
      healingAndShielding: maxOf(games, (game) => game.healingAndShielding),
      ccScoreSeconds: maxOf(games, (game) => game.ccScoreSeconds),
      ccTimeDealt: maxOf(games, (game) => game.ccTotalTimeDealt),
      savesFromDeath: maxOf(games, (game) => game.saveAllyFromDeath),
    },
  };
}
