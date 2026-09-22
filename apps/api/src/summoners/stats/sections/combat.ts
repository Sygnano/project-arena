import type { PingBreakdown } from "@arena/types";
import { countOf, kdaRatio, maxOf, sumOf } from "../aggregate.js";
import type { OwnGame } from "../loadStatsData.js";
import { abilityCasts, damageStats, utilityStats } from "./gameTotals.js";

const PING_TYPES = [
  "allIn", "assistMe", "basic", "command", "danger", "enemyMissing", "enemyVision",
  "getBack", "hold", "needVision", "onMyWay", "push", "retreat", "visionCleared",
] as const satisfies readonly (keyof PingBreakdown)[];

function pingStats(games: readonly OwnGame[]) {
  const pings: PingBreakdown = {
    allIn: 0, assistMe: 0, basic: 0, command: 0, danger: 0, enemyMissing: 0, enemyVision: 0,
    getBack: 0, hold: 0, needVision: 0, onMyWay: 0, push: 0, retreat: 0, visionCleared: 0,
  };
  let total = 0;
  for (const game of games) {
    if (!game.pings) continue;
    for (const type of PING_TYPES) {
      const count = game.pings[type] ?? 0;
      pings[type] += count;
      total += count;
    }
  }
  return { pings, total };
}

/** Account-wide KDA, kills, damage, casts, utility, pings and trivia. */
export function buildCombatStats(games: readonly OwnGame[]) {
  const kills = sumOf(games, (game) => game.kills);
  const deaths = sumOf(games, (game) => game.deaths);
  const assists = sumOf(games, (game) => game.assists);
  const pings = pingStats(games);

  return {
    kda: {
      kills,
      deaths,
      assists,
      kda: kdaRatio(kills, deaths, assists),
      mostKills: maxOf(games, (game) => game.kills),
      mostAssists: maxOf(games, (game) => game.assists),
      bestKda: maxOf(games, (game) => kdaRatio(game.kills, game.deaths, game.assists)),
    },
    kills: {
      doubleKills: sumOf(games, (game) => game.doubleKills),
      tripleKills: sumOf(games, (game) => game.tripleKills),
      quadraKills: sumOf(games, (game) => game.quadraKills),
      pentaKills: sumOf(games, (game) => game.pentaKills),
      largestKillingSpree: maxOf(games, (game) => game.largestKillingSpree),
      firstBloodKills: countOf(games, (game) => game.firstBloodKill === true),
      firstBloodAssists: countOf(games, (game) => game.firstBloodAssist === true),
      soloKills: sumOf(games, (game) => game.soloKills),
      flawlessAces: sumOf(games, (game) => game.flawlessAces),
    },
    damage: damageStats(games, "dealt"),
    damageTaken: damageStats(games, "taken"),
    utility: utilityStats(games),
    ability: {
      ...abilityCasts(games),
      totalSkillshotsHit: sumOf(games, (game) => game.skillshotsHit),
      bestSkillshotsHit: maxOf(games, (game) => game.skillshotsHit),
    },
    fun: {
      totalFistBumps: sumOf(games, (game) => game.fistBumps),
      totalPings: pings.total,
      totalSkillshotsDodged: sumOf(games, (game) => game.skillshotsDodged),
      bestSkillshotsDodged: maxOf(games, (game) => game.skillshotsDodged),
    },
    pings: { pings: pings.pings },
  };
}
