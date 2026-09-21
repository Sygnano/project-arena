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

/**
 * Arena's boots. Arena doesn't sell the normal game's boot tree at all — no
 * tier-1 `1001` "Boots", no `3006`/`3020`/etc. — it serves its own
 * `2230xx`/`2231xx` variants, one flat 500g purchase each (the same
 * `22xxxx`-prefixed re-skinning Arena applies to ordinary items, see
 * CLAUDE.md §2). Verified against every ingested match: across 333 matches /
 * ~6000 participants, these 8 ids are the ONLY items Data Dragon tags
 * `Boots` that ever appear in a timeline event — no other boot id was seen
 * once. Kept here as a literal set rather than read off Data Dragon's tag
 * because parseMatch() is pure and synchronous (it runs inside the backfill
 * script too); apps/api re-uses this same list for names/icons.
 */
const ARENA_BOOT_ITEM_IDS: readonly number[] = [
  223005, // Ghostcrawlers
  223006, // Berserker's Greaves
  223008, // Gluttonous Greaves
  223009, // Boots of Swiftness
  223020, // Sorcerer's Shoes
  223047, // Plated Steelcaps
  223111, // Mercury's Treads
  223158, // Ionian Boots of Lucidity
];
const ARENA_BOOT_ITEM_ID_SET = new Set(ARENA_BOOT_ITEM_IDS);

interface BootTransactions {
  bought: number[];
  sold: number[];
}

/**
 * participantId -> the boots they bought and sold across the match, in
 * event order.
 *
 * Undos are applied rather than ignored, which is not a rounding detail:
 * across the current dataset 366 boot purchases and 277 boot sales were
 * undone (~10% of each), so counting raw ITEM_PURCHASED/ITEM_SOLD events
 * overstates both. Riot models an undo as a single ITEM_UNDO carrying
 * `beforeId`/`afterId` rather than a typed "undo purchase"/"undo sale"
 * event: undoing a purchase reads `{beforeId: boot, afterId: 0}` with a
 * positive `goldGain` (the refund), undoing a sale reads
 * `{beforeId: 0, afterId: boot}` with a negative one — confirmed against
 * real data, where all 643 boot-related undos fell into exactly those two
 * shapes. An undo always cancels that participant's most recent matching
 * transaction, so the correction pops from the tail of the relevant list.
 *
 * ITEM_DESTROYED is deliberately NOT treated as a removal — it fires for
 * boots only a couple of times across the whole dataset (an item being
 * consumed/replaced rather than sold), and folding it in would conflate
 * "the player chose to sell" with "the game took it", which is what the
 * sold count is for. Anything that needs true end-of-match footwear should
 * read `match_participants.items`, which is exact.
 */
function bootTransactionsByParticipant(
  timelineDto: RiotMatchTimelineDto,
): Map<number, BootTransactions> {
  const byParticipant = new Map<number, BootTransactions>();
  const entry = (participantId: number) => {
    let existing = byParticipant.get(participantId);
    if (!existing) {
      existing = { bought: [], sold: [] };
      byParticipant.set(participantId, existing);
    }
    return existing;
  };
  /** Removes the most recent occurrence of `itemId`, i.e. the one undone. */
  const popLast = (ids: number[], itemId: number) => {
    const index = ids.lastIndexOf(itemId);
    if (index !== -1) ids.splice(index, 1);
  };

  for (const frame of timelineDto.info.frames) {
    for (const event of frame.events) {
      if (typeof event.participantId !== "number") continue;
      const participantId = event.participantId;

      if (event.type === "ITEM_PURCHASED" || event.type === "ITEM_SOLD") {
        const itemId = event.itemId;
        if (typeof itemId !== "number" || !ARENA_BOOT_ITEM_ID_SET.has(itemId)) continue;
        if (event.type === "ITEM_PURCHASED") entry(participantId).bought.push(itemId);
        else entry(participantId).sold.push(itemId);
      } else if (event.type === "ITEM_UNDO") {
        const beforeId = typeof event.beforeId === "number" ? event.beforeId : 0;
        const afterId = typeof event.afterId === "number" ? event.afterId : 0;
        if (afterId === 0 && ARENA_BOOT_ITEM_ID_SET.has(beforeId)) {
          popLast(entry(participantId).bought, beforeId);
        } else if (beforeId === 0 && ARENA_BOOT_ITEM_ID_SET.has(afterId)) {
          popLast(entry(participantId).sold, afterId);
        }
      }
    }
  }
  return byParticipant;
}

/**
 * participantId -> every item id they bought across the match, in event
 * order, with undone purchases removed (same ITEM_UNDO `{beforeId: item,
 * afterId: 0}` shape as `bootTransactionsByParticipant`). Sales are NOT
 * subtracted — this answers "what did they buy", which is exactly the
 * question end-of-match `items` can't answer for anything sold later.
 * Items the game grants rather than sells (Prismatic Items from an anvil,
 * upgrades like Void Immolation, the Shardblade) never emit ITEM_PURCHASED
 * and so never appear here — read `items` for those.
 */
function purchasedItemsByParticipant(timelineDto: RiotMatchTimelineDto): Map<number, number[]> {
  const byParticipant = new Map<number, number[]>();
  for (const frame of timelineDto.info.frames) {
    for (const event of frame.events) {
      if (typeof event.participantId !== "number") continue;
      const list = byParticipant.get(event.participantId) ?? [];
      if (event.type === "ITEM_PURCHASED" && typeof event.itemId === "number") {
        list.push(event.itemId);
      } else if (event.type === "ITEM_UNDO") {
        const beforeId = typeof event.beforeId === "number" ? event.beforeId : 0;
        const afterId = typeof event.afterId === "number" ? event.afterId : 0;
        if (afterId === 0 && beforeId !== 0) {
          const index = list.lastIndexOf(beforeId);
          if (index !== -1) list.splice(index, 1);
        }
      } else continue;
      byParticipant.set(event.participantId, list);
    }
  }
  return byParticipant;
}

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

/** This participant's `[t, physical, magical, true]` cumulative damage to
 * champions at each timeline frame (~1/minute) — see schema.ts's comment on
 * matchParticipants.frames for why only these are kept. */
function buildFrameSeries(
  timelineDto: RiotMatchTimelineDto,
  participantId: number,
): Array<[number, number, number, number]> {
  const key = String(participantId);
  return timelineDto.info.frames.map((frame) => {
    const damage = frame.participantFrames[key].damageStats;
    return [
      frame.timestamp,
      damage.physicalDamageDoneToChampions,
      damage.magicDamageDoneToChampions,
      damage.trueDamageDoneToChampions,
    ];
  });
}

export { ARENA_BOOT_ITEM_IDS };

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
    gameCreation: new Date(info.gameCreation),
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
  const bootsByParticipantId = timelineDto
    ? bootTransactionsByParticipant(timelineDto)
    : new Map<number, BootTransactions>();
  const purchasesByParticipantId = timelineDto
    ? purchasedItemsByParticipant(timelineDto)
    : new Map<number, number[]>();

  const participants: NewParticipant[] = info.participants.map((p) => {
    const participantId = participantIdByPuuid.get(p.puuid);
    const anvilCounts = participantId !== undefined ? anvilCountsByParticipantId.get(participantId) : undefined;
    const statAnvilsBought = participantId !== undefined ? (anvilCounts?.stat ?? 0) : null;
    const legendaryAnvilsBought = participantId !== undefined ? (anvilCounts?.legendary ?? 0) : null;
    const prismaticAnvilsBought = participantId !== undefined ? (anvilCounts?.prismatic ?? 0) : null;
    const boots = participantId !== undefined ? bootsByParticipantId.get(participantId) : undefined;
    // `[]` (not null) when the timeline exists but this player bought no
    // boots at all — a real, meaningful zero, unlike the null that means
    // "this match predates timeline ingestion, we don't know".
    const bootsBought = participantId !== undefined ? (boots?.bought ?? []) : null;
    const bootsSold = participantId !== undefined ? (boots?.sold ?? []) : null;
    const purchasedItemIds =
      participantId !== undefined ? (purchasesByParticipantId.get(participantId) ?? []) : null;
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
      augments: participantAugments(p),
      items: participantItems(p),
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      goldEarned: p.goldEarned,
      damageDealtToChampions: p.totalDamageDealtToChampions,

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
      summonerSpell1Id: p.summoner1Id,
      summonerSpell2Id: p.summoner2Id,
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
      bootsBought,
      bootsSold,
      purchasedItemIds,

      damageSelfMitigated: p.damageSelfMitigated,
      doubleKills: p.doubleKills,
      tripleKills: p.tripleKills,
      quadraKills: p.quadraKills,
      pentaKills: p.pentaKills,
      largestKillingSpree: p.largestKillingSpree,
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
