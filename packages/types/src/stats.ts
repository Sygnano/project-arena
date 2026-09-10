export interface SummonerProfile {
  puuid: string;
  riotIdGameName: string;
  riotIdTagline: string;
  region: string;
  profileIconId: number | null;
  summonerLevel: number | null;
  matchesPlayed: number;
}

/**
 * One tracked-match-day's activity, keyed by calendar date. Days with no
 * tracked matches simply don't appear here (the frontend calendar grid
 * treats any date missing from this list as 0 games). `date` is a UTC
 * calendar day (`matches.gameCreation` truncated to `YYYY-MM-DD` in UTC) —
 * a simplification that doesn't account for the player's own timezone, but
 * keeps day bucketing simple and consistent for a friend-group tool.
 */
export interface CalendarDayStats {
  date: string;
  gamesPlayed: number;
  /** Top3-finish rate (the same "win" definition as `PlacementStats.top3Finishes`)
   * across this day's matches only, 0-100. */
  top3Rate: number;
}

export interface CalendarStats {
  days: CalendarDayStats[];
}

export interface KdaStats {
  kills: number;
  deaths: number;
  assists: number;
  /** (kills + assists) / deaths, or kills + assists when deaths is 0. */
  kda: number;
  /** Highest kills/deaths/assists in any single tracked match (not a sum). */
  mostKills: number;
  mostDeaths: number;
  mostAssists: number;
  /** Highest single-match KDA — (kills + assists) / deaths for one match,
   * or kills + assists when that match's deaths is 0. Distinct from `kda`,
   * which is the average across every tracked match. */
  bestKda: number;
}

/** Multi-kill/kill-highlight stats — distinct from `KdaStats`, which covers
 * plain kills/deaths/assists. All summed across every tracked match except
 * `largestKillingSpree`/`largestMultiKill` (single-match maxes, not sums).
 */
export interface KillsStats {
  doubleKills: number;
  tripleKills: number;
  quadraKills: number;
  pentaKills: number;
  /** Verified against real data as always 0 across every tracked match
   * (329/329, none null) despite `largestKillingSpree` reaching double
   * digits — Riot's `killingSprees` counter apparently doesn't fire in
   * Arena the way it does on Summoner's Rift. Kept for completeness/in case
   * this changes in a future patch, not because it's currently meaningful. */
  killingSprees: number;
  largestKillingSpree: number;
  largestMultiKill: number;
  firstBloodKills: number;
  firstBloodAssists: number;
  soloKills: number;
  /** Aces (whole enemy team eliminated) with zero deaths on the summoner's
   * own team that match. */
  flawlessAces: number;
}

/** Anvil purchases split by type (see CLAUDE.md §2 on why these three
 * columns exist rather than one total), summed across every tracked match. */
export interface AnvilsBreakdown {
  stat: number;
  legendary: number;
  prismatic: number;
}

export interface EconomyStats {
  totalGoldEarned: number;
  /** Highest single-match gold total (not a share of the sum above). */
  mostGoldInOneGame: number;
  itemsPurchased: number;
  consumablesPurchased: number;
  anvils: AnvilsBreakdown;
}

/** Healing/shielding/CC/save stats — summed across every tracked match. */
export interface UtilityStats {
  totalHealingAndShielding: number;
  /** "CC Score" per the in-client scoreboard (matches.timeCCingOthers). */
  totalCcScoreSeconds: number;
  /** Raw summed CC duration — can exceed `totalCcScoreSeconds` since it
   * doesn't de-duplicate overlapping CC effects (see CLAUDE.md §2). */
  totalCcTimeDealt: number;
  totalSavesFromDeath: number;
}

/** Ability casts, split by slot — summed across every tracked match except
 * per-`ChampionAbilityStats.maxGame`, which is a single-match breakdown. */
export interface AbilityCastBreakdown {
  q: number;
  w: number;
  e: number;
  r: number;
}

/** A champion's ability-cast stats — the per-champion analog of
 * `AbilityStats`, same shape as `ChampionDamageStats` but for casts. */
export interface ChampionAbilityStats {
  total: AbilityCastBreakdown;
  /** The single tracked match with the most total ability casts on this
   * champion — all four fields come from that same match. */
  maxGame: AbilityCastBreakdown;
}

export interface AbilityStats {
  total: AbilityCastBreakdown;
  maxGame: AbilityCastBreakdown;
  /** Not a cast type, so not part of the breakdown above — shown alongside
   * it since it's still an ability-usage metric. */
  totalSkillshotsHit: number;
}

/** Grab-bag "fun" stats — summed across every tracked match. `totalPings` is
 * every ping type combined into one number; see `PingsStats` for the
 * per-type breakdown. */
export interface FunStats {
  totalFistBumps: number;
  totalPings: number;
  totalSkillshotsDodged: number;
}

/** All 14 of Riot's ping counters (see CLAUDE.md §2 — stored as one jsonb
 * object on match_participants, not 13 columns), summed across every
 * tracked match. */
export interface PingBreakdown {
  allIn: number;
  assistMe: number;
  basic: number;
  command: number;
  danger: number;
  enemyMissing: number;
  enemyVision: number;
  getBack: number;
  hold: number;
  needVision: number;
  onMyWay: number;
  push: number;
  retreat: number;
  visionCleared: number;
}

export interface PingsStats {
  pings: PingBreakdown;
}

export interface TimePlayedStats {
  /** Sum of match_participants.timePlayedSeconds across every tracked match —
   * real per-participant playtime, not gameDuration (see CLAUDE.md §2 on why
   * those differ in Arena). */
  timePlayedSeconds: number;
  /** timePlayedSeconds / matchesPlayed, 0 if there are no tracked matches. */
  averageGameSeconds: number;
  /** Longest single tracked match, by that match's own timePlayedSeconds
   * (not gameDuration, same reasoning as the sum above). */
  longestGameSeconds: number;
  /** Longest run of consecutive UTC calendar days with at least one tracked
   * match, derived from the same per-day grouping as CalendarStats. */
  longestStreakDays: number;
  /** Length of the streak ending on the most recently tracked match day —
   * 0 if that day isn't today or yesterday (UTC), so a streak from weeks ago
   * doesn't still read as "current". */
  currentStreakDays: number;
  /** Most matches played in any single UTC calendar day. */
  mostGamesInADay: number;
  /** UTC weekday with the most tracked matches summed across all days
   * (e.g. "Saturday"), or null if there's no tracked match at all. */
  favoriteDayOfWeek: string | null;
}

export interface PlacementStats {
  /** Placement 1st-3rd — this is a UI-defined "win" for Arena, distinct
   * from Riot's own per-participant `win` flag stored on match_participants. */
  top3Finishes: number;
  /** Placement exactly 1st. */
  top1Finishes: number;
  /** Count of tracked matches finished at each placement, keyed by placement
   * number (1st, 2nd, ...). Deliberately not assumed to run 1-N of any fixed
   * length — Arena's team count has changed before (see CLAUDE.md §2), so
   * this only contains whatever placements actually appear in the data. */
  byPlacement: Record<number, number>;
  /** Longest run of consecutive tracked matches (in chronological order)
   * finishing top3 — the same "win" definition as `top3Finishes`. */
  longestWinStreak: number;
  /** Longest run of consecutive tracked matches (in chronological order)
   * finishing exactly 1st. */
  longestTop1Streak: number;
}

/**
 * One breakdown row for `TeamSlotStats` — how matches assigned to this
 * `teamId` (Riot's `playerSubteamId`, the lobby slot the summoner started
 * the match in — an arbitrary per-match label, not a durable identity
 * across matches) turned out. `top1` and `top3ExclTop1` are disjoint
 * (`top3ExclTop1` covers 2nd-3rd only), and `remaining` covers every
 * placement after that — not hardcoded to "4th-6th", since Arena's team
 * count (and therefore the worst possible placement) has changed before,
 * see CLAUDE.md §2.
 */
export interface TeamSlotBreakdown {
  teamId: number;
  top1: number;
  top3ExclTop1: number;
  remaining: number;
}

export interface TeamSlotStats {
  byTeamId: TeamSlotBreakdown[];
}

/** A champion's KDA totals — the per-champion analog of `KdaStats`. */
export interface ChampionKdaStats {
  totalKills: number;
  totalDeaths: number;
  totalAssists: number;
  /** Highest kills/deaths/assists in any single tracked match on this
   * champion (not a sum) — the per-champion analog of `KdaStats.mostKills`
   * etc. */
  mostKills: number;
  mostDeaths: number;
  mostAssists: number;
  /** Highest single-match KDA on this champion — the per-champion analog of
   * `KdaStats.bestKda`. The average-KDA analog of `KdaStats.kda` isn't
   * stored here since it's cheap to derive from the totals above. */
  bestKda: number;
}

/** Damage dealt to champions, split by type — physical/magical/trueDamage
 * always sum to the match's `damageDealtToChampions` total (see CLAUDE.md
 * §2). Named `trueDamage` rather than `true` since the latter isn't usable
 * as a plain destructured identifier in TS/JS. */
export interface DamageBreakdown {
  physical: number;
  magical: number;
  trueDamage: number;
}

/** A champion's damage stats — the per-champion analog of `DamageStats`. */
export interface ChampionDamageStats {
  /** Summed across every tracked match played as this champion. */
  total: DamageBreakdown;
  /** The type breakdown of this champion's single highest-damage tracked
   * match — all three fields come from that same match (not independently
   * maxed per type, which could mix numbers from different matches). */
  maxGame: DamageBreakdown;
}

/**
 * One champion's aggregated stats across every tracked match played as
 * that champion, nested by category the same way `SummonerStatsResponse`
 * is — grows over time as more categories get built (augments, ...), each
 * becoming another key here alongside `kda`/`damage`.
 */
export interface ChampionStats {
  championId: number;
  championName: string;
  matchesPlayed: number;
  kda: ChampionKdaStats;
  damage: ChampionDamageStats;
  /** Same `ChampionDamageStats` shape as `damage`, but for damage the
   * champion took rather than dealt. */
  damageTaken: ChampionDamageStats;
  ability: ChampionAbilityStats;
}

/** The page-wide analog of `ChampionDamageStats` — same shape, aggregated
 * across every tracked match regardless of champion. */
export interface DamageStats {
  total: DamageBreakdown;
  maxGame: DamageBreakdown;
}

/**
 * One champion's ban-related stats across the summoner's tracked matches.
 * `banRate` is the % of tracked matches where this champion appeared
 * anywhere in the lobby-wide ban list (`matches.bannedChampionIds`) — a
 * champion banned by more than one player in the same match still counts
 * once for that match, so this can't exceed 100.
 * `winRateWhenNotBanned` is the summoner's top3-finish rate (the same
 * "win" definition as `PlacementStats.top3Finishes`) across only the
 * matches where this champion was NOT banned, i.e. was actually available
 * to be picked — null if the champion was banned in every one of the
 * summoner's tracked matches (no such matches exist to sample).
 */
export interface BannedChampionStats {
  championId: number;
  championName: string;
  banRate: number;
  winRateWhenNotBanned: number | null;
}

export interface BannedChampionsStats {
  champions: BannedChampionStats[];
}

/**
 * One entry in the full Arena augment catalog (currently 225 augments,
 * sourced from Community Dragon — see CLAUDE.md §2, Data Dragon doesn't
 * publish augment data at all), enriched with how often the summoner
 * actually picked it. Unlike `ChampionStats`/`BannedChampionStats`, this
 * covers every augment that exists, not just ones the summoner has picked —
 * `timesPicked` is 0 for the rest.
 */
export interface AugmentStats {
  augmentId: number;
  augmentName: string;
  iconUrl: string;
  /** Community Dragon's own numeric rarity tiers: 0 = Silver, 1 = Gold,
   * 2 = Prismatic (verified against real augment data). A 4th value, 3,
   * doesn't appear at all; a 5th, 4, covers 25 augments with names like
   * "Gain an Augment slot" and "Replace Augment" — internal/meta entries
   * not part of the normal in-game augment offer pool, not yet otherwise
   * identified. */
  rarity: number;
  /** Number of tracked matches where the summoner picked this augment.
   * Players hold up to 4 augments per match (see CLAUDE.md §2), so this
   * can exceed `SummonerProfile.matchesPlayed`. */
  timesPicked: number;
}

export interface AugmentsStats {
  augments: AugmentStats[];
}

/**
 * One entry in the full Arena Prismatic Item catalog (49 items, see
 * CLAUDE.md §2 for how this list was verified — there's no field anywhere
 * in Riot's API or Data Dragon that flags item rarity, so it's a curated ID
 * list), enriched with how often the summoner has held it at match end.
 * Same "full catalog, not just picked ones" shape as `AugmentStats`.
 */
export interface PrismaticItemStats {
  itemId: number;
  itemName: string;
  iconUrl: string;
  /** Number of tracked matches where the summoner ended the match holding
   * this item. */
  timesHeld: number;
}

export interface PrismaticItemsStats {
  items: PrismaticItemStats[];
}

/**
 * One entry in the full champion catalog (currently ~171 champions, sourced
 * from Data Dragon — same source as `apps/api/src/championData.ts`'s
 * champion-name lookup), enriched with how many tracked matches the
 * summoner has played that champion in. Same "full catalog, not just ones
 * actually played" shape as `AugmentStats`/`PrismaticItemStats` — icon URLs
 * aren't included here since the frontend already builds them client-side
 * via `championIconUrl()`, the same way KDA/Damage/BannedChampions do.
 */
export interface ChampionCatalogEntry {
  championId: number;
  championName: string;
  timesPlayed: number;
}

export interface ChampionCatalogStats {
  champions: ChampionCatalogEntry[];
}

/**
 * One champion's placement breakdown across the summoner's tracked
 * matches — same `top1`/`top3ExclTop1`/`remaining` split as
 * `TeamSlotBreakdown`, grouped by champion instead of lobby slot. Unlike
 * `ChampionCatalogEntry`, this only covers champions actually played (a
 * champion with zero picks has no placements to break down), so `timesPicked`
 * always equals `top1 + top3ExclTop1 + remaining`.
 */
export interface ChampionPickBreakdown {
  championId: number;
  championName: string;
  timesPicked: number;
  top1: number;
  top3ExclTop1: number;
  remaining: number;
}

export interface ChampionPicksStats {
  champions: ChampionPickBreakdown[];
}

/**
 * Response shape for GET /summoners/:puuid/stats (apps/api), consumed by
 * apps/web. Nested by category rather than one flat object — each category
 * here corresponds to a CategorySection + module on the summoner page (see
 * CLAUDE.md's component layering notes), so a module takes exactly its
 * slice (e.g. `<KDA {...stats.kda} />`) instead of the page hand-picking
 * individual fields out of a large flat response. `profile` holds identity/
 * overview fields shared across the whole page, not owned by one category.
 */
export interface SummonerStatsResponse {
  profile: SummonerProfile;
  kda: KdaStats;
  timePlayed: TimePlayedStats;
  calendar: CalendarStats;
  placements: PlacementStats;
  teamSlot: TeamSlotStats;
  bannedChampions: BannedChampionsStats;
  damage: DamageStats;
  /** Same `DamageStats` shape as `damage`, but page-wide damage *taken*
   * rather than dealt. */
  damageTaken: DamageStats;
  augments: AugmentsStats;
  prismaticItems: PrismaticItemsStats;
  championCatalog: ChampionCatalogStats;
  championPicks: ChampionPicksStats;
  kills: KillsStats;
  economy: EconomyStats;
  utility: UtilityStats;
  ability: AbilityStats;
  fun: FunStats;
  pings: PingsStats;
  /** Keyed by championId (numeric key — JSON serializes it as a string,
   * access it the same way either side: `champions[75]`). */
  champions: Record<number, ChampionStats>;
}
