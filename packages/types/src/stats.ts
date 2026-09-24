export interface SummonerProfile {
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
  /** Average placement across this day's matches only (1 = best). */
  avgPlacement: number;
  /** Best (lowest) placement reached on this day. */
  bestPlacement: number;
  /** Sum of match_participants.timePlayedSeconds across this day's matches
   * only — same real-playtime source as `TimePlayedStats.timePlayedSeconds`. */
  timePlayedSeconds: number;
  top1Finishes: number;
  top3Finishes: number;
  /** (kills + assists) / deaths summed over this day's matches, deaths floored at 1. */
  kda: number;
  /** This day's placements in the order the matches were played. */
  placements: number[];
  /** Most-played champions this day, most games first (up to 3). */
  champions: ChampionGames[];
}

/** A champion (Riot key) and how many matches it was played in. */
export interface ChampionGames {
  championName: string;
  games: number;
}

export interface CalendarStats {
  days: CalendarDayStats[];
  /** Tracked matches grouped by the UTC hour-of-day (0-23) they started in —
   * index 0 is matches starting 00:00-00:59 UTC. Powers the summoner page's
   * "by hour" activity view. */
  gamesByHour: number[];
  /** 1st-place finishes per UTC hour, aligned with `gamesByHour`. */
  top1ByHour: number[];
  /** Top 3 finishes (1st included) per UTC hour, aligned with `gamesByHour`. */
  top3ByHour: number[];
  /** Mean placement per UTC hour, null for an hour with no games. */
  avgPlacementByHour: (number | null)[];
  /** (kills + assists) / deaths per UTC hour, deaths floored at 1; null with no games. */
  kdaByHour: (number | null)[];
  /** Mean `timePlayedSeconds` per UTC hour, null with no games. */
  avgGameSecondsByHour: (number | null)[];
  /** Most-played champions per UTC hour, most games first (up to 3 each). */
  championsByHour: ChampionGames[][];
}

export interface KdaStats {
  kills: number;
  deaths: number;
  assists: number;
  /** (kills + assists) / deaths, or kills + assists when deaths is 0. */
  kda: number;
  /** Highest kills/assists in any single tracked match (not a sum). */
  mostKills: number;
  mostAssists: number;
  /** Highest single-match KDA — (kills + assists) / deaths for one match,
   * or kills + assists when that match's deaths is 0. Distinct from `kda`,
   * which is the average across every tracked match. */
  bestKda: number;
}

/** Multi-kill/kill-highlight stats — distinct from `KdaStats`, which covers
 * plain kills/deaths/assists. All summed across every tracked match except
 * `largestKillingSpree` (a single-match max, not a sum).
 */
export interface KillsStats {
  doubleKills: number;
  tripleKills: number;
  quadraKills: number;
  pentaKills: number;
  largestKillingSpree: number;
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
  /** Highest single-match count of `anvils.stat` (not a share of the sum
   * above) — same "single best game" shape as `mostGoldInOneGame`. */
  mostStatAnvilsInOneMatch: number;
  /** Gold spent on each anvil type (count × Data Dragon price). */
  anvilGoldSpent: AnvilsBreakdown;
  /** The Shardblade item (boosts stat shards) — `timesPicked` = tracked
   * matches that ended with it in inventory (it's never bought, so the
   * timeline has no trace of it). */
  shardblade: ItemOutcomeStats;
}

/**
 * One item with how often the summoner had it and how those matches ended.
 * `top3` includes `top1` — "win" is a top-3 finish, the same definition as
 * `PlacementStats.top3Finishes`. Counted once per match.
 */
export interface ItemOutcomeStats {
  itemId: number;
  itemName: string;
  iconUrl: string;
  timesPicked: number;
  top1: number;
  top3: number;
}

/** Healing/shielding/CC/save numbers as one unit — the shared shape behind
 * both `UtilityStats.total`/`.bestByType` and `ChampionUtilityStats`'s same
 * two fields. */
export interface UtilityBreakdown {
  healingAndShielding: number;
  /** "CC Score" per the in-client scoreboard (matches.timeCCingOthers). */
  ccScoreSeconds: number;
  /** Raw summed CC duration — can exceed `ccScoreSeconds` since it doesn't
   * de-duplicate overlapping CC effects (see CLAUDE.md §2). */
  ccTimeDealt: number;
  savesFromDeath: number;
}

/** Healing/shielding/CC/save stats. */
export interface UtilityStats {
  /** Summed across every tracked match. */
  total: UtilityBreakdown;
  /** Each field independently maxed across every tracked match — unlike a
   * single "best game" row, the highest heal & shield game need not be the
   * highest CC score game, so each number here can come from a different
   * match (same idea as `ChampionDamageStats.bestByType`). */
  bestByType: UtilityBreakdown;
}

/** A champion's utility stats — the per-champion analog of `UtilityStats`,
 * same shape, aggregated across every tracked match played as that champion
 * rather than across the whole account. */
export interface ChampionUtilityStats {
  total: UtilityBreakdown;
  bestByType: UtilityBreakdown;
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
  /** Most skillshots landed in a single tracked match. */
  bestSkillshotsHit: number;
}

/** Summoner spell casts keyed by spell id (Data Dragon summoner.json `key`,
 * e.g. 2202 Flash) — a map rather than fixed fields because which spells
 * exist is Riot's data, not ours (Arena has had its own spell ids). JSON
 * serializes the numeric keys as strings; index with the number either way. */
export type SummonerSpellCasts = Record<number, number>;

export interface SummonerSpellInfo {
  spellId: number;
  name: string;
  iconUrl: string;
  /** Tracked matches this spell was taken in. */
  games: number;
}

export interface ChampionSummonerSpellStats {
  championId: number;
  championName: string;
  matchesPlayed: number;
  total: SummonerSpellCasts;
  /** The single match with the most summoner spell casts on this champion —
   * every spell's count comes from that same match. */
  maxGame: SummonerSpellCasts;
}

export interface SummonerSpellsStats {
  /** Every spell taken in a tracked match, most cast first. */
  spells: SummonerSpellInfo[];
  total: SummonerSpellCasts;
  /** Same single-match rule as `ChampionSummonerSpellStats.maxGame`. */
  maxGame: SummonerSpellCasts;
  champions: ChampionSummonerSpellStats[];
}

/** Cumulative damage to champions by minute: index = minute of the match,
 * one array per damage type (all the same length). Parallel arrays rather
 * than an object per minute keep the response small — there's one of these
 * per champion. */
export type DamageCurveSeries = Record<keyof DamageBreakdown, number[]>;

export interface DamageCurveBestGame {
  championName: string;
  placement: number;
  /** When this player's team was knocked out (or the match ended). */
  timePlayedSeconds: number;
  series: DamageCurveSeries;
}

/**
 * Damage over time for one set of games (every game, or one champion's).
 * `total` sums every game's cumulative damage at each minute; a game that has
 * already ended keeps contributing its final total, so the last point equals
 * the season's damage and the curve flattens as games end. Divide by `games`
 * for the average game's curve (same carry-forward rule: the average by
 * minute 25 counts a game that ended at 20 with its final total).
 */
export interface DamageCurve {
  games: number;
  total: DamageCurveSeries;
  /** Highest damage to champions in one game. */
  bestGame: DamageCurveBestGame;
}

export interface ChampionDamageCurve extends DamageCurve {
  championId: number;
  championName: string;
}

export interface DamageCurveStats {
  /** Null until a match with a stored timeline exists. */
  all: DamageCurve | null;
  /** Most games first. */
  champions: ChampionDamageCurve[];
}

/** Grab-bag "fun" stats — summed across every tracked match. `totalPings` is
 * every ping type combined into one number; see `PingsStats` for the
 * per-type breakdown. */
export interface FunStats {
  totalFistBumps: number;
  totalPings: number;
  totalSkillshotsDodged: number;
  /** Most skillshots dodged in a single tracked match. */
  bestSkillshotsDodged: number;
}

/** All 14 of Riot's ping counters (see CLAUDE.md §2 — stored as one
 * smallint array on match_participants, not 14 columns), summed across
 * every tracked match. */
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
  /** Most matches played in any single UTC calendar day. */
  mostGamesInADay: number;
  /** UTC weekday with the most tracked matches summed across all days
   * (e.g. "Saturday"), or null if there's no tracked match at all. */
  favoriteDayOfWeek: string | null;
}

/** What a typical match at one finishing place looks like. */
export interface PlacementDetail {
  /** Mean `timePlayedSeconds` (the team's own elimination time, not the lobby's game length). */
  avgGameSeconds: number;
  /** (kills + assists) / deaths summed over those matches, deaths floored at 1. */
  kda: number;
  avgDamage: number;
  /** Mean number of augments held at the end of the match. */
  avgAugments: number;
  /** The champion (Riot key) with the highest share of its own games
   * finishing at this placement, among champions with 5+ games overall;
   * `games` of `totalGames` ended here. */
  topChampion: { championName: string; games: number; totalGames: number } | null;
}

export interface PlacementStats {
  /** Mean placement across every tracked match (1 = best), 0 with no matches. */
  avgPlacement: number;
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
  /** Averages over the matches finished at each placement, keyed like
   * `byPlacement` — only placements with at least one match are present. */
  detailsByPlacement: Record<number, PlacementDetail>;
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
  /** Mean placement of the matches started in this slot (1 = best). */
  avgPlacement: number;
  /** (kills + assists) / deaths over those matches, deaths floored at 1. */
  kda: number;
  /** Matches per exact placement, keyed like `PlacementStats.byPlacement`
   * (only placements that occurred). */
  byPlacement: Record<number, number>;
}

export interface TeamSlotStats {
  byTeamId: TeamSlotBreakdown[];
}

/** A champion's KDA totals — the per-champion analog of `KdaStats`. */
export interface ChampionKdaStats {
  totalKills: number;
  totalDeaths: number;
  totalAssists: number;
  /** Kills/deaths/assists from this champion's single best-KDA tracked
   * match — all three from that SAME match (the row with the highest
   * (kills+assists)/max(1,deaths)), not independently maxed per stat. The
   * per-champion analog of `ChampionDamageStats.maxGame`, not of
   * `KdaStats.mostKills`/`mostDeaths`/`mostAssists` (which are
   * independently maxed and have no per-champion equivalent here). Both the
   * average-KDA analog of `KdaStats.kda` and the best-single-match-KDA
   * analog of `KdaStats.bestKda` are cheap to derive — from `totalKills`/
   * `totalDeaths`/`totalAssists` and from this object respectively — so
   * neither is stored separately. */
  bestGame: {
    kills: number;
    deaths: number;
    assists: number;
  };
  /** Summed across every tracked match played as this champion — the
   * per-champion analog of `KillsStats.soloKills`. */
  soloKills: number;
  /** Highest single-match `largestKillingSpree` across every tracked match
   * played as this champion (not a sum) — the per-champion analog of
   * `KillsStats.largestKillingSpree`. */
  largestKillingSpree: number;
  /** Single-match records, each independently maxed (like
   * `KdaStats.mostKills`) — the most kills and the most deaths can come from
   * different matches. Power the champion dossier's BEST GAME view. */
  mostKills: number;
  mostDeaths: number;
  /** Fewest deaths in any single match on this champion — the "best game"
   * reading of deaths, where lower is better. */
  fewestDeaths: number;
  mostAssists: number;
  mostSoloKills: number;
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

/** One single-match breakdown per damage type — see `bestGameByType`. */
export type DamageBestGames = Record<keyof DamageBreakdown, DamageBreakdown>;

/** A champion's damage stats — the per-champion analog of `DamageStats`. */
export interface ChampionDamageStats {
  /** Summed across every tracked match played as this champion. */
  total: DamageBreakdown;
  /** The type breakdown of this champion's single highest-damage tracked
   * match — all three fields come from that same match (not independently
   * maxed per type, which could mix numbers from different matches). */
  maxGame: DamageBreakdown;
  /** For each damage type, the full breakdown of the one match where that
   * type peaked — e.g. `physical` is the highest-physical match, with its own
   * magical and true damage beside it. Every breakdown comes from a single
   * match; per-type maxima are never mixed across matches. */
  bestGameByType: DamageBestGames;
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
  /** Summed `match_participants.timePlayedSeconds` across every tracked
   * match played as this champion — Riot's own per-participant figure, which
   * already accounts for a team being eliminated before the match's overall
   * `gameDuration` ends (see CLAUDE.md §2). */
  timePlayedSeconds: number;
  /** Longest single tracked match on this champion, same
   * `timePlayedSeconds` source as the sum above. */
  longestGameSeconds: number;
  /** Mean team placement across every tracked match on this champion
   * (1 = best). */
  avgPlacement: number;
  /** How many tracked matches on this champion finished in each place —
   * index 0 is 1st. Its length is the worst placement seen across ALL of
   * the summoner's tracked matches (not a hardcoded team count, see
   * CLAUDE.md §2), so every champion's array has the same length and a
   * champion that never finished last still gets a zero there. */
  placementCounts: number[];
  kda: ChampionKdaStats;
  damage: ChampionDamageStats;
  /** Same `ChampionDamageStats` shape as `damage`, but for damage the
   * champion took rather than dealt. */
  damageTaken: ChampionDamageStats;
  ability: ChampionAbilityStats;
  utility: ChampionUtilityStats;
  combat: ChampionCombatStats;
  economy: ChampionEconomyStats;
  /** The items this champion builds, split into the dossier's item rows —
   * see `ChampionItemBuckets`. */
  items: ChampionItemBuckets;
  form: ChampionFormStats;
  /** Every normal-pool augment picked on this champion, most picked first. */
  augments: ChampionAugmentStats[];
}

/** One normal-pool augment picked on this champion. */
export interface ChampionAugmentStats {
  augmentId: number;
  augmentName: string;
  iconUrl: string;
  /** Community Dragon rarity: 0 = Silver, 1 = Gold, 2 = Prismatic. */
  rarity: number;
  /** Matches on this champion the augment was picked in. */
  timesPicked: number;
  /** Of those, how many finished 1st. */
  top1: number;
  /** Of those, how many finished top 3 (1st included). */
  top3: number;
}

/** One tracked match on a champion, for the dossier's form chart. */
export interface ChampionRecentGame {
  placement: number;
  /** ISO timestamp of the match's `gameCreation`. */
  playedAt: string;
  kills: number;
  deaths: number;
  assists: number;
}

/** Recent results on one champion. Streaks use the page-wide "win" = top 3
 * finish, walked in match order like the summoner-level streaks. */
export interface ChampionFormStats {
  /** Every tracked match on this champion, newest first. */
  games: ChampionRecentGame[];
  /** Top 3 finishes in a row ending with the most recent match (0 if the
   * last one wasn't a win). */
  currentWinStreak: number;
  longestWinStreak: number;
}

/**
 * A champion's multikill/burst records — the "highlight reel" counterpart to
 * `ChampionKdaStats`'s running totals. Every field except
 * `largestCriticalStrike` and the `most*`/`best*` records is a SUM across
 * every tracked match played as this champion; those are single-match
 * maxima (the biggest one ever, not a total).
 */
export interface ChampionCombatStats {
  doubleKills: number;
  tripleKills: number;
  quadraKills: number;
  pentaKills: number;
  /** Riot's closest available field to "biggest single hit" — crits only. */
  largestCriticalStrike: number;
  damageSelfMitigated: number;
  /** Single-match records, each independently maxed — see
   * `ChampionKdaStats.mostKills`. */
  mostDoubleKills: number;
  mostTripleKills: number;
  mostQuadraKills: number;
  mostPentaKills: number;
  bestDamageSelfMitigated: number;
}

/**
 * A champion's gold/shop stats. The three anvil counters are the same
 * `220000` / `220001`-`220006` / `220007` split `match_participants` stores
 * (see CLAUDE.md §2) and are null-coalesced to 0 here, so a champion only
 * played in matches ingested before timelines were fetched reads as 0 anvils
 * rather than breaking the sum.
 */
export interface ChampionEconomyStats {
  /** Summed across every tracked match played as this champion. */
  goldEarned: number;
  /** Highest single-match `goldEarned` on this champion. */
  bestGameGoldEarned: number;
  itemsPurchased: number;
  statAnvilsBought: number;
  legendaryAnvilsBought: number;
  prismaticAnvilsBought: number;
  /** Highest single-match `itemsPurchased` on this champion. */
  mostItemsPurchased: number;
  /** The anvil split of the single match with the most anvils bought in
   * total — all three from that SAME match, like
   * `ChampionDamageStats.maxGame`. */
  maxGameAnvils: {
    stat: number;
    legendary: number;
    prismatic: number;
  };
}

/**
 * One item this champion finished a tracked match holding. Counted the same
 * "dedupe per match" way as augments/bans elsewhere in this file (a player
 * somehow holding the same item in two slots still counts once for that
 * match), from `match_participants.items`. Empty slots (`0`) and Arena's
 * anvil/voucher consumables (`220000`-`220011`, see CLAUDE.md §2) are
 * excluded — they're shop mechanics rather than a build.
 */
export interface ChampionItemStats {
  itemId: number;
  itemName: string;
  iconUrl: string;
  /** Matches on this champion counted for the item — for `legendary`, built
   * (bought at any point or held at the end); for `prismatic` and
   * `special`, held at the end (they're granted, so there's no purchase to
   * see); for `boots`, bought at least once (timeline purchase events —
   * see `BootStats` for why not inventory). */
  count: number;
  /** Of those matches, how many finished 1st. */
  top1: number;
  /** Of those matches, how many finished top 3 (1st included). */
  top3: number;
}

/**
 * Every item this champion got, highest count first within each bucket.
 *
 * `prismatic` is read from end-of-match inventory: Prismatic items are
 * taken from anvils, which emit no ITEM_PURCHASED event (measured on 40 real
 * matches: 1,255 held at match end vs 107 purchase events).
 *
 * `legendary` is "built": bought at any point (timeline
 * `purchased_item_ids`) or held at the end — the same Legendary definition
 * and source as the page-level `legendaryItems`, so an item bought and later
 * sold still counts and the dossier agrees with the Vault section. Boots
 * come from timeline purchase events.
 *
 * `special` is the Shardblade plus the special upgrade items (Golden
 * Spatula, Wooglet's Witchcap, Void Immolation), held at the end — none of
 * them is ever bought (see CLAUDE.md §2).
 */
export interface ChampionItemBuckets {
  legendary: ChampionItemStats[];
  prismatic: ChampionItemStats[];
  special: ChampionItemStats[];
  boots: ChampionItemStats[];
}

/** The page-wide analog of `ChampionDamageStats` — same shape, aggregated
 * across every tracked match regardless of champion. */
export interface DamageStats {
  total: DamageBreakdown;
  maxGame: DamageBreakdown;
  /** Same as `ChampionDamageStats.bestGameByType`, across every tracked
   * match regardless of champion. */
  bestGameByType: DamageBestGames;
}

/**
 * One champion's ban-related stats across the summoner's tracked matches.
 * `banRate` is the % of tracked matches where this champion appeared
 * anywhere in the lobby-wide ban list (`matches.bannedChampionIds`) — a
 * champion banned by more than one player in the same match still counts
 * once for that match, so this can't exceed 100.
 * `totalBans` is the raw count of ban slots this champion filled across
 * every tracked match, counting duplicates (unlike `banRate`, a champion
 * banned twice in one match adds 2 here, not 1) — used for the "X BANS"
 * detail-row figure rather than a per-match rate.
 * `winRateWhenNotBanned` is the summoner's top3-finish rate (the same
 * "win" definition as `PlacementStats.top3Finishes`) across only the
 * matches where this champion was NOT banned AND was actually picked by
 * someone in the lobby (not just theoretically available) — a match where
 * the champion was open but nobody drafted it can't tell us anything about
 * that champion's effect on the game, so it's excluded from the sample.
 * Null if no such match exists (the champion was banned in every one of the
 * summoner's tracked matches, or was never picked in any of the ones where
 * it was open).
 */
export interface BannedChampionStats {
  championId: number;
  championName: string;
  banRate: number;
  totalBans: number;
  winRateWhenNotBanned: number | null;
  /** The sample behind `winRateWhenNotBanned`: tracked matches where this
   * champion was not banned and was picked by someone in the lobby. */
  gamesOpenAndPicked: number;
}

/**
 * `totalBans` is every filled ban slot across every tracked match, counting
 * duplicates (the same champion banned twice in one match counts twice) —
 * `-1` ("no ban locked in", see CLAUDE.md §2) slots are excluded.
 * `noBanCount` is the count of those excluded `-1` slots — how often a
 * player in a tracked match didn't lock in a ban at all.
 * `duplicateBanCount` is, per match, `max(timesChampionBanned - 1, 0)`
 * summed across every champion and every match — i.e. how many ban slots
 * were "wasted" re-banning something someone else in the same match had
 * already banned.
 */
export interface BannedChampionsStats {
  champions: BannedChampionStats[];
  totalBans: number;
  noBanCount: number;
  duplicateBanCount: number;
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
 * One augment's placement breakdown across the summoner's tracked matches —
 * same `top1`/`top3ExclTop1`/`remaining` split as `ChampionPickBreakdown`,
 * grouped by augment instead of champion. An augment is picked alongside up
 * to 3 others in the same match (see CLAUDE.md §2), so its breakdown is
 * built from the CONTAINING match's placement, not a per-augment placement
 * field (there isn't one). Unlike `AugmentStats`, this only covers augments
 * actually picked (an augment with zero picks has no placements to break
 * down), so `timesPicked` always equals `top1 + top3ExclTop1 + remaining`.
 */
export interface AugmentPickBreakdown {
  augmentId: number;
  augmentName: string;
  timesPicked: number;
  top1: number;
  top3ExclTop1: number;
  remaining: number;
  /** Champions this augment was picked on most (up to 3, most games first). */
  topChampions: AugmentChampionPick[];
  /** How many different champions it was picked on. */
  championCount: number;
}

export interface AugmentChampionPick extends ChampionGames {
  /** Of `games`, how many finished top 3. */
  top3: number;
}

export interface AugmentPicksStats {
  augments: AugmentPickBreakdown[];
}

/**
 * One "Guest of Honor" augment's pick breakdown — same shape as
 * `AugmentPickBreakdown`, but for the champion-exclusive "GoH"-prefixed
 * augments a few champions (Tahm Kench, Vayne, Kindred, Yone) grant a
 * teammate instead of a normal draft pick (see
 * `apps/api/src/leagueData/augments/augmentGroups.ts`'s `GUEST_OF_HONOR_CHAMPIONS`). These are
 * excluded from `AugmentsStats`/`AugmentPicksStats` (they're not part of the
 * normal offer pool) but still get picked up in real match data whenever the
 * mechanic actually fires, so `timesPicked`/`top1`/`top3ExclTop1`/`remaining`
 * are real, not placeholders — 0 simply means the summoner has never
 * received this particular augment.
 */
export interface GuestOfHonorAugmentStats {
  augmentId: number;
  augmentName: string;
  iconUrl: string;
  timesPicked: number;
  top1: number;
  top3ExclTop1: number;
  remaining: number;
}

/** One row of a `GuestOfHonorChampionStats` slide — usually one line of
 * cards (e.g. Vayne's 7 item-echo augments), except Tahm Kench's own set,
 * which uses 3 rows (Power/Risk/Wealth) instead of 1. */
export interface GuestOfHonorRow {
  key: string;
  label: string;
  augments: GuestOfHonorAugmentStats[];
}

/** One carousel slide: the champion whose "Guest of Honor" mechanic this is,
 * plus its augment row(s). */
export interface GuestOfHonorChampionStats {
  championId: number;
  championName: string;
  rows: GuestOfHonorRow[];
}

export interface GuestOfHonorStats {
  champions: GuestOfHonorChampionStats[];
}

/**
 * One "meta" augment's pick breakdown — the other real, structured subset of
 * the removed-augment pile besides Guest of Honor: Arena's augment-crafting
 * mechanic, which lets a draft pick be spent on something other than a
 * normal augment offer (gaining a stat anvil, an extra augment slot,
 * upgrading/"leveling" an existing augment, or rerolling one) instead of a
 * champion-exclusive line (see `apps/api/src/leagueData/augments/augmentGroups.ts`'s
 * `META_AUGMENT_API_NAMES`). Same shape as `GuestOfHonorAugmentStats` — these are
 * excluded from `AugmentsStats`/`AugmentPicksStats` (not part of the normal
 * offer pool) but genuinely picked in real match data, so the counts here are
 * real, not placeholders.
 */
export interface MetaAugmentStats {
  augmentId: number;
  augmentName: string;
  iconUrl: string;
  timesPicked: number;
  top1: number;
  top3ExclTop1: number;
  remaining: number;
}

export interface MetaAugmentsStats {
  augments: MetaAugmentStats[];
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
 * One of Arena's 8 boots, with how often the summoner bought and sold it.
 * Both counts come from `match_participants.boots_bought`/`.boots_sold`,
 * i.e. from timeline purchase/sale events — NOT from end-of-match inventory:
 * Arena players routinely sell their boots late in a match, so a pair that
 * was bought and then sold leaves nothing behind in `items` to count. Buying
 * the same pair twice in one match counts twice (it's a purchase stat, not a
 * match stat), unlike the "dedupe per match" rule that applies to
 * augments/bans/held items elsewhere in this file.
 */
export interface BootStats {
  itemId: number;
  itemName: string;
  iconUrl: string;
  timesBought: number;
  timesSold: number;
}

/**
 * The boots section's data. `boots` is the full 8-boot Arena catalog, every
 * entry present even at zero — same "full catalog, not just ones used" shape
 * as `AugmentStats`/`PrismaticItemStats`.
 *
 * Note the two "no boots" numbers measure different things and are NOT
 * subsets of each other in the obvious direction: `matchesWithoutBoots`
 * counts matches where no pair was ever bought, while
 * `matchesFinishedBarefoot` counts matches that ENDED with no boots in the
 * inventory (read from `match_participants.items`, which is exact) — the
 * latter includes the former plus every match where a pair was bought and
 * later sold.
 */
export interface BootsStats {
  boots: BootStats[];
  totalBought: number;
  totalSold: number;
  /** Summed Data Dragon purchase price of every pair bought (each Arena
   * boot is a flat one-step buy, so this is gold actually spent). Sales
   * refund only part of that and are not netted off. */
  goldSpent: number;
  /** Matches where no pair was bought at all. */
  matchesWithoutBoots: number;
  /** Matches that ended with no boots in the end-of-match inventory. */
  matchesFinishedBarefoot: number;
  /** Highest number of pairs bought within a single match. */
  mostBoughtInOneMatch: number;
  /** Top-3 outcome split by what happened to boots that match: bought and
   * still worn at the end (`keptOn`), bought but the match ended barefoot
   * (`soldOff`, i.e. sold or replaced), or never bought (`neverBought`).
   * Matches without a timeline are left out of all three. */
  outcomes: Record<"keptOn" | "soldOff" | "neverBought", BootsOutcome>;
}

export interface BootsOutcome {
  games: number;
  top3Finishes: number;
}

/**
 * One Prismatic Item's placement breakdown across the summoner's tracked
 * matches — same `top1`/`top3ExclTop1`/`remaining` split as
 * `AugmentPickBreakdown`, grouped by item instead of augment. A held item
 * has no placement field of its own, so its breakdown is tallied from the
 * CONTAINING match's placement, same approach as augments. Unlike
 * `PrismaticItemStats`, this only covers items actually held (an item with
 * zero holds has no placements to break down), so `timesHeld` always equals
 * `top1 + top3ExclTop1 + remaining`.
 */
export interface PrismaticItemPickBreakdown {
  itemId: number;
  itemName: string;
  timesHeld: number;
  top1: number;
  top3ExclTop1: number;
  remaining: number;
}

export interface PrismaticItemPicksStats {
  items: PrismaticItemPickBreakdown[];
}

/**
 * One entry in the full champion catalog (currently 173 champions, sourced
 * from CommunityDragon via `apps/api/src/leagueData/champions.ts`'s
 * champion-name lookup). Same "full catalog, not just ones actually played"
 * shape as `AugmentStats`/`PrismaticItemStats` — icon URLs aren't included
 * here since the frontend already builds them client-side via
 * `championIconUrl()`, the same way KDA/Damage/BannedChampions do.
 */
export interface ChampionCatalogEntry {
  championId: number;
  championName: string;
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
 * One teammate the summoner has shared an Arena team with — found by
 * self-joining match_participants on (matchId, teamId), since Arena teams
 * are per-match groups, not durable rosters (see CLAUDE.md §2 on team size).
 * `riotIdGameName`/`riotIdTagline` come from that teammate's most recent
 * tracked-match row rather than an arbitrary one, in case they've since
 * renamed. Same `top1`/`top3ExclTop1`/`remaining` split as
 * `ChampionPickBreakdown` — since placement is team-level, these numbers are
 * necessarily identical to the summoner's own placement in every match they
 * shared.
 */
export interface TeammateStats {
  /** The row's position in the server's list, which the page selects rows
   * by. Not the player's PUUID: PUUIDs stay server-side (Riot's policies
   * don't allow publishing them). */
  id: number;
  riotIdGameName: string;
  riotIdTagline: string;
  gamesPlayed: number;
  top1: number;
  top3ExclTop1: number;
  remaining: number;
  /** Round duels won together, derived from timelines (`match_rounds`) —
   * 0 for matches without one. */
  roundsWon: number;
  /** Round duels lost together. */
  roundsLost: number;
}

export interface TeammatesStats {
  /** Teammates shared at least 2 games with. */
  teammates: TeammateStats[];
  /** Every distinct teammate ever, including one-off matchmade names. */
  totalTeammates: number;
}

/**
 * One opponent the summoner has faced — shared a tracked match with, but on
 * a DIFFERENT Arena team (the "Nemesis" counterpart to `TeammateStats`,
 * found the same way via a self-join on match_participants, just requiring
 * `teamId` to differ instead of match). `top1`/`top3ExclTop1`/`remaining`
 * are this OPPONENT's own placement breakdown across the shared matches —
 * same shape as `TeammateStats`, but NOT a head-to-head result (their team's
 * placement, not a result versus the summoner specifically). For the actual
 * head-to-head record, see `timesBeat`/`timesBeatenBy`, tallied by comparing
 * the two teams' placements in each shared match — a tie between the two
 * teams' placements (not observed in practice, but not impossible) counts
 * toward neither.
 */
export interface OpponentStats {
  /** Row position, as `TeammateStats.id`: never the PUUID. */
  id: number;
  riotIdGameName: string;
  riotIdTagline: string;
  gamesFaced: number;
  top1: number;
  top3ExclTop1: number;
  remaining: number;
  /** The SUMMONER's own placement breakdown across these same shared
   * matches (mirrors `top1`/`top3ExclTop1` above, but for the summoner's
   * team rather than the opponent's) — also not a head-to-head result,
   * see `timesBeat`/`timesBeatenBy` for that. */
  ownTop1: number;
  ownTop3ExclTop1: number;
  /** Matches where the summoner's team finished ahead of this opponent's team. */
  timesBeat: number;
  /** Matches where this opponent's team finished ahead of the summoner's team. */
  timesBeatenBy: number;
  /** Round duels against this opponent's team that the summoner's team won,
   * derived from timelines (`match_rounds`) — 0 for matches without one. */
  roundsWon: number;
  /** Round duels against this opponent's team that the summoner's team lost. */
  roundsLost: number;
}

export interface NemesisStats {
  /** Opponents faced at least 2 times. */
  opponents: OpponentStats[];
  /** Every distinct opponent ever faced. */
  totalOpponents: number;
}

/**
 * One enemy champion the summoner's team fought in round duels
 * (`match_rounds`, derived by `parseRounds()`), counted from the summoner's
 * side: `duelsWon` are duels their team won against a team this champion
 * was on. A duel against a team of N players counts once for each of the N
 * champions on it, so these don't sum to `VersusStats.duelsWon`. Matches
 * without a stored timeline contribute nothing.
 */
export interface VersusChampionStats {
  championId: number;
  championName: string;
  duelsWon: number;
  duelsLost: number;
  /** Matches with at least one duel against this champion. */
  gamesFaced: number;
}

export interface VersusStats {
  /** Every enemy champion duelled at least once, most duels first. */
  champions: VersusChampionStats[];
  /** Every duel the summoner's team fought, each counted once. */
  duelsWon: number;
  duelsLost: number;
}

/**
 * One champion that has shared the tracked summoner's Arena team (their own
 * picks included, not just teammates') across every tracked match — a node
 * in `TeamSynergyStats.matrix`. `gamesOnTeam` counts matches, not picks: a
 * champion appearing twice on the same team in one match (theoretically
 * possible, though not observed) would still count once for that match, the
 * same "dedupe per match" approach as bans/augments/items elsewhere in this
 * file. Team membership is derived per match from Riot's `playerSubteamId`
 * (see CLAUDE.md §2 — never assume a fixed team size), not a hardcoded
 * roster size.
 *
 * `championId: -1` is a reserved sentinel (the same convention Riot's own
 * ban data uses `-1` for "no champion", see CLAUDE.md §2) for the aggregate
 * "Other" node covering every champion past the chart's per-arc cap — see
 * `apps/api/src/routes/summoners.ts`'s `TEAM_SYNERGY_MAX_CHAMPIONS`.
 * `championCount` distinguishes the two cases: always 1 for a real champion,
 * greater than 1 only for the "Other" node (how many distinct champions are
 * folded into it).
 */
export interface TeamSynergyChampionNode {
  championId: number;
  championName: string;
  gamesOnTeam: number;
  /** 1st-place finishes in those `gamesOnTeam` matches. */
  top1OnTeam: number;
  /** Top 3 finishes (1st included) in those matches. */
  top3OnTeam: number;
  championCount: number;
}

/**
 * One champion PAIR's synergy record — both champions were on the tracked
 * summoner's team together (as teammates, or one of them being the
 * summoner's own pick) in `gamesTogether` matches. `top1`/`top3ExclTop1`/
 * `remaining` are tallied from the CONTAINING match's team placement (shared
 * by the whole team, not per-participant — see CLAUDE.md §2), so
 * `top3Rate` reflects how that pairing's matches actually finished, not an
 * individual's placement. Champion A is always the one with the smaller
 * champion ID — an arbitrary but stable tie-break so the same pair is never
 * counted as two different directions.
 */
export interface TeamSynergyPairStats {
  championAName: string;
  championBName: string;
  gamesTogether: number;
  top1: number;
  top3ExclTop1: number;
  remaining: number;
  top3Rate: number;
}

/**
 * Team synergy — which champions have shared the tracked summoner's Arena
 * team, and how often/well specific pairings have performed, powering the
 * summoner page's chord diagram (champions as nodes, ribbon width = matches
 * shared on a team). `champions`/`matrix` are capped to the most-teamed-with
 * champions (see `apps/api/src/routes/summoners.ts`'s
 * `TEAM_SYNERGY_MAX_CHAMPIONS`) for chart readability — a friend group's
 * tracked history can span far more distinct champions than a chord diagram
 * can legibly render — while `totalDistinctChampions`/`totalDistinctPairings`
 * report the true, uncapped counts.
 */
export interface TeamSynergyStats {
  /** Sorted descending by `gamesOnTeam`, capped for chart readability. */
  champions: TeamSynergyChampionNode[];
  /** Symmetric co-occurrence matrix aligned index-for-index with `champions`
   * (`matrix[i][j]` = matches `champions[i]` and `champions[j]` shared a
   * team, `matrix[i][i]` always 0 — a chord ribbon needs two distinct
   * arcs). */
  matrix: number[][];
  /** Same shape as `matrix`: 1st-place finishes of those shared matches. */
  matrixTop1: number[][];
  /** Same shape as `matrix`: top 3 finishes (1st included) of those matches. */
  matrixTop3: number[][];
  /** Every distinct champion ever seen on the summoner's team, not just the
   * capped `champions` list. */
  totalDistinctChampions: number;
  /** Every distinct champion pair ever seen on the summoner's team, not just
   * pairs among the capped `champions` list. */
  totalDistinctPairings: number;
  /** The pair played together the most, or null if the summoner has no
   * tracked matches. */
  mostPlayedPairing: TeamSynergyPairStats | null;
  /** The pair with the highest `top3Rate` among pairs meeting a minimum
   * sample size (see `TEAM_SYNERGY_MIN_PAIR_SAMPLE`), or null if none
   * qualify. */
  bestPairing: TeamSynergyPairStats | null;
  /** Champions played by the summoner's teammates (own pick excluded), seen
   * at least twice, with the summoner's finishes in those games. Most games
   * first. */
  teammateChampions: TeammateChampionStats[];
}

export interface TeammateChampionStats {
  championId: number;
  championName: string;
  games: number;
  top1: number;
  top3ExclTop1: number;
  remaining: number;
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
  teamSynergy: TeamSynergyStats;
  bannedChampions: BannedChampionsStats;
  damage: DamageStats;
  /** Same `DamageStats` shape as `damage`, but page-wide damage *taken*
   * rather than dealt. */
  damageTaken: DamageStats;
  augments: AugmentsStats;
  augmentPicks: AugmentPicksStats;
  guestOfHonor: GuestOfHonorStats;
  metaAugments: MetaAugmentsStats;
  prismaticItems: PrismaticItemsStats;
  prismaticItemPicks: PrismaticItemPicksStats;
  /** The Golden Spatula, Wooglet's Witchcap, Void Immolation, in that order.
   * `timesPicked` = matches that ENDED holding the item — they're granted
   * upgrades, never bought, so end-of-match inventory is the only source. */
  specialItems: ItemOutcomeStats[];
  /** Every Legendary item the summoner ever had, most-picked first.
   * `timesPicked` = matches where it was bought at any point (timeline,
   * `match_participants.purchased_item_ids`) or held at match end — the
   * latter catches the few granted by a Legendary anvil or an upgrade. */
  legendaryItems: ItemOutcomeStats[];
  boots: BootsStats;
  championCatalog: ChampionCatalogStats;
  championPicks: ChampionPicksStats;
  teammates: TeammatesStats;
  nemesis: NemesisStats;
  versus: VersusStats;
  kills: KillsStats;
  economy: EconomyStats;
  utility: UtilityStats;
  ability: AbilityStats;
  summonerSpells: SummonerSpellsStats;
  damageCurves: DamageCurveStats;
  fun: FunStats;
  pings: PingsStats;
  /** Keyed by championId (numeric key — JSON serializes it as a string,
   * access it the same way either side: `champions[75]`). */
  champions: Record<number, ChampionStats>;
  /** Lowercased Riot champion key (`match_participants.championName`, e.g.
   * "monkeyking") -> display name ("Wukong"). Keys are for asset URLs; show
   * people the display name. */
  championDisplayNames: Record<string, string>;
  /** ISO time of the most recent tracked match, or null with no matches. */
  lastMatchAt: string | null;
}
