/**
 * Partial shapes for the Riot API responses the ingestion pipeline reads.
 * These are intentionally NOT full DTOs (Riot's real payloads have many more
 * fields) — only what apps/api's parser actually consumes. Widen as needed
 * when a new stat requires a field that isn't here yet.
 */

export interface RiotAccountDto {
  puuid: string;
  gameName: string;
  tagLine: string;
}

/**
 * Summoner-V4. Unlike Account-V1 and Match-V5 (regional-cluster routed —
 * europe/americas/asia), this endpoint is platform routed (e.g. euw1) —
 * see RiotClient.getSummonerByPuuid.
 */
export interface RiotSummonerDto {
  puuid: string;
  profileIconId: number;
  summonerLevel: number;
  revisionDate: number;
}

export interface RiotArenaParticipantDto {
  puuid: string;
  riotIdGameName: string;
  riotIdTagline: string;
  /** The player's profile icon and account level at the time of the match —
   * what the crawler stores for summoners it discovers here, so it needs
   * no Summoner-V4 call per player. */
  profileIcon: number;
  summonerLevel: number;
  /** Groups participants into their Arena team for this match. Team size
   * is derived by counting participants that share a playerSubteamId —
   * never assume a fixed number per team (confirmed via real match data:
   * 6 teams of 3 as of patch 16.10, was 8 teams of 2 in earlier patches). */
  playerSubteamId: number;
  /** Team's finishing place (1st, 2nd, ...). Shared by every participant
   * with the same playerSubteamId. (`placement` also exists on the DTO and
   * currently mirrors this, but `subteamPlacement` is the field to use.) */
  subteamPlacement: number;
  championId: number;
  championName: string;
  champLevel: number;
  // Riot's DTO has 6 augment slots; only the first 4 are populated as of
  // the current patch (5/6 come back as 0). Keep all 6 rather than
  // assuming a fixed active count.
  playerAugment1: number;
  playerAugment2: number;
  playerAugment3: number;
  playerAugment4: number;
  playerAugment5: number;
  playerAugment6: number;
  item0: number;
  item1: number;
  item2: number;
  item3: number;
  item4: number;
  item5: number;
  item6: number;
  kills: number;
  deaths: number;
  assists: number;
  goldEarned: number;
  totalDamageDealtToChampions: number;
  win: boolean;
  /** Riot's own end-of-game "time played" for this participant (seconds) —
   * already accounts for teams being eliminated at different points in
   * Arena, so it's the right field to use directly rather than re-deriving
   * elimination time from timeline KILL_ACE events. */
  timePlayed: number;
  physicalDamageDealtToChampions: number;
  magicDamageDealtToChampions: number;
  trueDamageDealtToChampions: number;
  physicalDamageTaken: number;
  magicDamageTaken: number;
  trueDamageTaken: number;
  /** Closest available field to "biggest single hit" — Riot doesn't expose
   * a true max-single-damage-instance stat outside of crits. */
  largestCriticalStrike: number;
  totalHeal: number;
  totalHealsOnTeammates: number;
  totalDamageShieldedOnTeammates: number;
  /** "CC Score" as shown on the in-client scoreboard. */
  timeCCingOthers: number;
  /** Raw summed CC duration — can exceed timeCCingOthers if CC effects
   * overlap (that field de-duplicates overlapping time, this doesn't). */
  totalTimeCCDealt: number;
  spell1Casts: number;
  spell2Casts: number;
  spell3Casts: number;
  spell4Casts: number;
  /** Summoner spell id in each slot (Data Dragon summoner.json `key`).
   * Arena offers only two spells, Flash (2202) and Flee (2201), and every
   * player has both; the slot order varies, so read the id, never assume. */
  summoner1Id: number;
  summoner2Id: number;
  summoner1Casts: number;
  summoner2Casts: number;
  allInPings: number;
  assistMePings: number;
  basicPings: number;
  commandPings: number;
  dangerPings: number;
  enemyMissingPings: number;
  enemyVisionPings: number;
  getBackPings: number;
  holdPings: number;
  needVisionPings: number;
  onMyWayPings: number;
  pushPings: number;
  retreatPings: number;
  visionClearedPings: number;
  totalTimeSpentDead: number;
  damageSelfMitigated: number;
  doubleKills: number;
  tripleKills: number;
  quadraKills: number;
  pentaKills: number;
  killingSprees: number;
  largestKillingSpree: number;
  largestMultiKill: number;
  firstBloodKill: boolean;
  firstBloodAssist: boolean;
  itemsPurchased: number;
  consumablesPurchased: number;
  // Riot's "challenges" object is shared across every game mode and mostly
  // full of Summoner's Rift-specific fields that are always 0 in Arena
  // (baronTakedowns, jungleCsBefore10Minutes, ...) — only pulling the ones
  // that are actually meaningful here. Optional since very old matches
  // predate the challenges system.
  challenges?: {
    /** Count of fist-bump interactions the player participated in. */
    fistBumpParticipation?: number;
    /** Riot's own combined healing+shielding metric — the canonical
     * answer to "healing and shielding," rather than manually summing
     * totalHeal/totalHealsOnTeammates/totalDamageShieldedOnTeammates
     * (which double-count in different ways). */
    effectiveHealAndShielding?: number;
    soloKills?: number;
    skillshotsHit?: number;
    skillshotsDodged?: number;
    /** Aced the enemy team without losing anyone — fits Arena's
     * team-elimination mechanic well. */
    flawlessAces?: number;
    saveAllyFromDeath?: number;
  };
}

export interface RiotArenaMatchDto {
  metadata: {
    matchId: string;
  };
  info: {
    gameCreation: number;
    gameDuration: number;
    queueId: number;
    gameVersion: string;
    participants: RiotArenaParticipantDto[];
    /**
     * Arena's ban list is lobby-wide, not per-team — despite living under
     * `teams[]` (a vestige of the shared Match-V5 schema; Arena's `teams`
     * here don't correspond to the real per-match subteams at all, just a
     * legacy win/loss pair). Each of the 18 players bans one champion from
     * the whole lobby's roll pool; there's no participantId attached to
     * tell us who banned what, only pickTurn order.
     */
    teams: Array<{
      bans: Array<{ championId: number; pickTurn: number }>;
    }>;
  };
}

/**
 * A timeline event. Confirmed event types seen on real Arena matches:
 * PAUSE_END, LEVEL_UP, SKILL_LEVEL_UP, ITEM_PURCHASED, ITEM_SOLD,
 * ITEM_DESTROYED, ITEM_UNDO, WARD_PLACED, WARD_KILL, CHAMPION_KILL,
 * CHAMPION_SPECIAL_KILL, GAME_END. Each type carries different extra
 * fields (e.g. `itemId` for item events, `killerId`/`victimId` for
 * CHAMPION_KILL) — left open here since we're only storing raw timelines
 * for now, not parsing specific event types yet.
 */
export interface RiotTimelineEvent {
  type: string;
  timestamp: number;
  participantId?: number;
  [key: string]: unknown;
}

/**
 * A per-participant snapshot at the end of one frame. Riot's real payload
 * has more fields (championStats, minionsKilled, ...) — only pulling what
 * builds gold/xp/level/damage-over-time graphs and position data, per the
 * cost/design analysis in this session (kept out championStats: that's
 * build-order/replay-tool data, not stats-site data, and would meaningfully
 * grow storage for no current use).
 */
export interface RiotParticipantFrame {
  totalGold: number;
  xp: number;
  level: number;
  position: { x: number; y: number };
  damageStats: {
    totalDamageDoneToChampions: number;
    physicalDamageDoneToChampions: number;
    magicDamageDoneToChampions: number;
    trueDamageDoneToChampions: number;
    totalDamageTaken: number;
  };
}

export interface RiotTimelineFrame {
  timestamp: number;
  events: RiotTimelineEvent[];
  /** Keyed by participantId as a string ("1".."18"). */
  participantFrames: Record<string, RiotParticipantFrame>;
}

export interface RiotMatchTimelineDto {
  metadata: {
    matchId: string;
  };
  info: {
    frameInterval: number;
    // Maps participantId (used throughout timeline events) to puuid —
    // needed to join timeline events back to match_participants rows.
    participants: Array<{ participantId: number; puuid: string }>;
    frames: RiotTimelineFrame[];
  };
}
