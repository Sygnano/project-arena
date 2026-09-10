import type { RiotArenaMatchDto, RiotArenaParticipantDto, RiotMatchTimelineDto } from "@arena/types";
import { compressJson } from "./compression.js";
import type { matches, matchParticipants } from "./schema.js";

type NewMatch = typeof matches.$inferInsert;
type NewParticipant = typeof matchParticipants.$inferInsert;

// The 8 Arena anvil/consumable item IDs, confirmed via Data Dragon's item
// descriptions (each is "Active - Consume: ... a permanent stat
// bonus/item") — see schema.ts's comment on the anvil columns.
const STAT_ANVIL_ITEM_ID = 220000; // "Stat Bonus"
const LEGENDARY_ANVIL_ITEM_IDS = new Set([220001, 220002, 220003, 220004, 220005, 220006]); // "Legendary [Class] Item" x6
const PRISMATIC_ANVIL_ITEM_ID = 220007; // "Prismatic Item"

function participantAugments(p: RiotArenaParticipantDto): number[] {
  return [
    p.playerAugment1,
    p.playerAugment2,
    p.playerAugment3,
    p.playerAugment4,
    p.playerAugment5,
    p.playerAugment6,
  ].filter((augmentId) => augmentId !== 0);
}

function participantItems(p: RiotArenaParticipantDto): number[] {
  return [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6];
}

function bannedChampionIds(dto: RiotArenaMatchDto): number[] {
  return dto.info.teams.flatMap((team) => team.bans.map((b) => b.championId));
}

interface AnvilCounts {
  stat: number;
  legendary: number;
  prismatic: number;
}

/** participantId -> anvil purchase counts, split by anvil type. */
function countAnvilPurchasesByParticipant(timelineDto: RiotMatchTimelineDto): Map<number, AnvilCounts> {
  const counts = new Map<number, AnvilCounts>();
  const bump = (participantId: number, key: keyof AnvilCounts) => {
    const entry = counts.get(participantId) ?? { stat: 0, legendary: 0, prismatic: 0 };
    entry[key]++;
    counts.set(participantId, entry);
  };

  for (const frame of timelineDto.info.frames) {
    for (const event of frame.events) {
      if (event.type !== "ITEM_PURCHASED" || typeof event.participantId !== "number") continue;
      if (event.itemId === STAT_ANVIL_ITEM_ID) bump(event.participantId, "stat");
      else if (typeof event.itemId === "number" && LEGENDARY_ANVIL_ITEM_IDS.has(event.itemId)) {
        bump(event.participantId, "legendary");
      } else if (event.itemId === PRISMATIC_ANVIL_ITEM_ID) bump(event.participantId, "prismatic");
    }
  }
  return counts;
}

/** This participant's gold/xp/level/position/damage at each timeline frame
 * (~1/minute) — see schema.ts's comment on matchParticipants.frames for
 * why only these fields are kept (not the full Riot participantFrame). */
function buildFrameSeries(timelineDto: RiotMatchTimelineDto, participantId: number) {
  const key = String(participantId);
  return timelineDto.info.frames.map((frame) => {
    const pf = frame.participantFrames[key];
    return {
      t: frame.timestamp,
      gold: pf.totalGold,
      xp: pf.xp,
      level: pf.level,
      x: pf.position.x,
      y: pf.position.y,
      dmgToChamps: pf.damageStats.totalDamageDoneToChampions,
      dmgTaken: pf.damageStats.totalDamageTaken,
    };
  });
}

export function parseMatch(
  matchId: string,
  region: string,
  dto: RiotArenaMatchDto,
  // Optional because a handful of matches were ingested before timelines
  // were fetched at all — re-parsing those can still recover everything
  // except the anvil counts and frames (which need timeline events).
  timelineDto: RiotMatchTimelineDto | null,
): { match: NewMatch; participants: NewParticipant[] } {
  const { info } = dto;

  const match: NewMatch = {
    matchId,
    region,
    queueId: info.queueId,
    gameCreation: new Date(info.gameCreation),
    gameDuration: info.gameDuration,
    patch: info.gameVersion,
    raw: compressJson(dto),
    ...(timelineDto ? { timeline: compressJson(timelineDto) } : {}),
    bannedChampionIds: bannedChampionIds(dto),
  };

  // puuid -> participantId, needed to look up this participant's anvil
  // count (timeline events are keyed by participantId, not puuid).
  const participantIdByPuuid = new Map(
    timelineDto ? timelineDto.info.participants.map((p) => [p.puuid, p.participantId]) : [],
  );
  const anvilCountsByParticipantId = timelineDto
    ? countAnvilPurchasesByParticipant(timelineDto)
    : new Map<number, AnvilCounts>();

  const participants: NewParticipant[] = info.participants.map((p) => {
    const participantId = participantIdByPuuid.get(p.puuid);
    const anvilCounts = participantId !== undefined ? anvilCountsByParticipantId.get(participantId) : undefined;
    const statAnvilsBought = participantId !== undefined ? (anvilCounts?.stat ?? 0) : null;
    const legendaryAnvilsBought = participantId !== undefined ? (anvilCounts?.legendary ?? 0) : null;
    const prismaticAnvilsBought = participantId !== undefined ? (anvilCounts?.prismatic ?? 0) : null;
    const frames =
      participantId !== undefined && timelineDto
        ? buildFrameSeries(timelineDto, participantId)
        : null;

    return {
      matchId,
      puuid: p.puuid,
      riotIdGameName: p.riotIdGameName,
      riotIdTagline: p.riotIdTagline,
      teamId: p.playerSubteamId,
      placement: p.subteamPlacement,
      championId: p.championId,
      championName: p.championName,
      champLevel: p.champLevel,
      augments: participantAugments(p),
      items: participantItems(p),
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      goldEarned: p.goldEarned,
      damageDealtToChampions: p.totalDamageDealtToChampions,
      win: p.win,

      timePlayedSeconds: p.timePlayed,
      damageDealtToChampionsPhysical: p.physicalDamageDealtToChampions,
      damageDealtToChampionsMagic: p.magicDamageDealtToChampions,
      damageDealtToChampionsTrue: p.trueDamageDealtToChampions,
      damageTakenPhysical: p.physicalDamageTaken,
      damageTakenMagic: p.magicDamageTaken,
      damageTakenTrue: p.trueDamageTaken,
      largestCriticalStrike: p.largestCriticalStrike,
      // Riot returns this as a float (e.g. 11569.416...) — rounded since
      // fractional healing/shielding isn't meaningful for display.
      healingAndShielding:
        p.challenges?.effectiveHealAndShielding !== undefined
          ? Math.round(p.challenges.effectiveHealAndShielding)
          : null,
      ccScoreSeconds: p.timeCCingOthers,
      ccTotalTimeDealt: p.totalTimeCCDealt,
      fistBumps: p.challenges?.fistBumpParticipation ?? null,
      qCasts: p.spell1Casts,
      wCasts: p.spell2Casts,
      eCasts: p.spell3Casts,
      rCasts: p.spell4Casts,
      summonerSpell1Casts: p.summoner1Casts,
      summonerSpell2Casts: p.summoner2Casts,
      pings: {
        allIn: p.allInPings,
        assistMe: p.assistMePings,
        basic: p.basicPings,
        command: p.commandPings,
        danger: p.dangerPings,
        enemyMissing: p.enemyMissingPings,
        enemyVision: p.enemyVisionPings,
        getBack: p.getBackPings,
        hold: p.holdPings,
        needVision: p.needVisionPings,
        onMyWay: p.onMyWayPings,
        push: p.pushPings,
        retreat: p.retreatPings,
        visionCleared: p.visionClearedPings,
      },
      statAnvilsBought,
      legendaryAnvilsBought,
      prismaticAnvilsBought,

      totalTimeSpentDead: p.totalTimeSpentDead,
      damageSelfMitigated: p.damageSelfMitigated,
      doubleKills: p.doubleKills,
      tripleKills: p.tripleKills,
      quadraKills: p.quadraKills,
      pentaKills: p.pentaKills,
      killingSprees: p.killingSprees,
      largestKillingSpree: p.largestKillingSpree,
      largestMultiKill: p.largestMultiKill,
      firstBloodKill: p.firstBloodKill,
      firstBloodAssist: p.firstBloodAssist,
      itemsPurchased: p.itemsPurchased,
      consumablesPurchased: p.consumablesPurchased,
      soloKills: p.challenges?.soloKills ?? null,
      skillshotsHit: p.challenges?.skillshotsHit ?? null,
      skillshotsDodged: p.challenges?.skillshotsDodged ?? null,
      flawlessAces: p.challenges?.flawlessAces ?? null,
      saveAllyFromDeath: p.challenges?.saveAllyFromDeath ?? null,
      frames,
    };
  });

  return { match, participants };
}
