import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  smallint,
  primaryKey,
  customType,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Drizzle's pg-core has no built-in `bytea` helper — postgres.js already
// marshals bytea <-> Buffer natively, so this just tells Drizzle the SQL
// type name. Used for compressed JSON blobs (see compression.ts) — plain
// binary data, not something queried with jsonb operators.
const bytea = customType<{ data: Buffer }>({
  dataType() {
    return "bytea";
  },
});

/**
 * A Riot account we know about: looked up from the web app, or discovered
 * by the crawler (`apps/api/scripts/crawl.ts`) as a participant in an
 * ingested match. The crawler refreshes whoever has the oldest
 * `lastRefreshedAt` (never-refreshed rows first).
 */
export const summoners = pgTable("summoners", {
  puuid: text("puuid").primaryKey(),
  riotIdGameName: text("riot_id_game_name").notNull(),
  riotIdTagline: text("riot_id_tagline").notNull(),
  /** The Riot ID's lookup key (`riotIdKey()` in riotId.ts): what a summoner
   * page is found by. Null only on rows from before the column, which the
   * API fills at startup (`backfillRiotIdKeys`). */
  riotIdKey: text("riot_id_key"),
  region: text("region").notNull(),
  profileIconId: integer("profile_icon_id"),
  summonerLevel: integer("summoner_level"),
  /** When ingestion last finished pulling this summoner's matches from Riot.
   * Null until the first refresh completes, which is the state of every
   * summoner the crawler discovers. */
  lastRefreshedAt: timestamp("last_refreshed_at", { withTimezone: true }),
}, (table) => [
  // The crawler's "who's next" lookup: oldest refresh first, nulls first.
  index("summoners_last_refreshed_at_idx").on(table.lastRefreshedAt.asc().nullsFirst()),
  // Every summoner page's lookup (`findSummonerByRiotId`).
  index("summoners_riot_id_idx").on(table.region, table.riotIdKey),
]);

/**
 * One Arena match. `raw` keeps the full Riot Match-V5 payload so the parser
 * can be re-run against already-ingested matches if the parsing logic
 * changes, without re-fetching from Riot.
 *
 * `raw` and `timeline` are brotli-compressed JSON (bytea), not jsonb —
 * measured on real Arena payloads, app-level brotli gets ~13-22x smaller
 * than Postgres's own automatic TOAST compression on the same jsonb data
 * (timelines especially: ~1.3MB raw JSON down to ~65-100KB). Nothing in
 * this codebase queries into these columns with SQL jsonb operators —
 * they're always read whole and parsed in application code — so the
 * tradeoff (no `->`/`@>` queryability) costs nothing today. Use
 * `compressJson`/`decompressJson` from `./compression.js` to read/write.
 */
export const matches = pgTable("matches", {
  matchId: text("match_id").primaryKey(),
  region: text("region").notNull(),
  gameCreation: timestamp("game_creation", { withTimezone: true }).notNull(),
  raw: bytea("raw").notNull(),
  // Raw Match-V5 timeline payload (frame-by-frame events: item purchases,
  // wards, kills, ...) — not parsed into structured columns yet, kept as-is
  // for when specific event stats (e.g. item purchase timing) are built.
  // Nullable because matches ingested before this was added don't have one.
  timeline: bytea("timeline"),
  // Champion IDs banned from the whole lobby's roll pool (see
  // RiotArenaMatchDto's comment on `info.teams[].bans` — this is lobby-wide,
  // not attributable to a specific team or player, hence living here on
  // `matches` rather than duplicated across every match_participants row).
  bannedChampionIds: integer("banned_champion_ids").array(),
});

/**
 * One participant's row in one match. `teamId` groups participants into
 * their Arena team for that match — team size is NOT assumed anywhere
 * (Arena has gone from teams of 2 to teams of 3 before). To find "who was
 * on this team" or "how many players were on a team", group/count
 * match_participants by (match_id, team_id) rather than relying on a
 * constant. `placement` is the team's finishing place, shared by every
 * participant with the same (match_id, team_id).
 */
export const matchParticipants = pgTable(
  "match_participants",
  {
    matchId: text("match_id")
      .notNull()
      .references(() => matches.matchId, { onDelete: "cascade" }),
    puuid: text("puuid").notNull(),
    // Denormalized so non-tracked teammates/opponents are still readable
    // without needing a summoners row for every player ever seen.
    riotIdGameName: text("riot_id_game_name"),
    riotIdTagline: text("riot_id_tagline"),
    teamId: integer("team_id").notNull(),
    placement: smallint("placement").notNull(),
    championId: integer("champion_id").notNull(),
    championName: text("champion_name").notNull(),
    // Arena augment IDs selected, in pick order. Stored as jsonb rather
    // than a fixed-width set of columns since Riot has changed how many
    // augments a player can hold before (currently 4).
    augments: jsonb("augments").$type<number[]>().notNull(),
    items: jsonb("items").$type<number[]>().notNull(),
    kills: integer("kills").notNull(),
    deaths: integer("deaths").notNull(),
    assists: integer("assists").notNull(),
    goldEarned: integer("gold_earned").notNull(),
    damageDealtToChampions: integer("damage_dealt_to_champions").notNull(),

    // --- Everything below is nullable: added after the columns above, so
    // matches ingested before this was added won't have values. All are
    // backfillable from the already-stored `raw`/`timeline` blobs (see
    // packages/db/scripts/backfill-reparse-participants.ts) EXCEPT
    // anvilsBought, which needs `timeline` specifically and so stays null
    // for the handful of matches ingested before timelines were fetched.

    /** Riot's own end-of-game time played (seconds) — see the comment on
     * RiotArenaParticipantDto.timePlayed for why this is used as-is rather
     * than derived from timeline KILL_ACE events. */
    timePlayedSeconds: integer("time_played_seconds"),

    // Damage dealt to champions, split by type (damageDealtToChampions
    // above is the pre-existing total of these three).
    damageDealtToChampionsPhysical: integer("damage_dealt_to_champions_physical"),
    damageDealtToChampionsMagic: integer("damage_dealt_to_champions_magic"),
    damageDealtToChampionsTrue: integer("damage_dealt_to_champions_true"),
    damageTakenPhysical: integer("damage_taken_physical"),
    damageTakenMagic: integer("damage_taken_magic"),
    damageTakenTrue: integer("damage_taken_true"),
    /** Closest available field to "biggest single hit" — see
     * RiotArenaParticipantDto.largestCriticalStrike. */
    largestCriticalStrike: integer("largest_critical_strike"),

    /** Riot's combined healing+shielding metric (challenges.effectiveHealAndShielding). */
    healingAndShielding: integer("healing_and_shielding"),

    /** "CC Score" per the in-client scoreboard (timeCCingOthers). */
    ccScoreSeconds: integer("cc_score_seconds"),
    /** Raw summed CC duration, can exceed ccScoreSeconds if CC effects
     * overlap (totalTimeCCDealt doesn't de-duplicate overlapping time). */
    ccTotalTimeDealt: integer("cc_total_time_dealt"),

    /** Fist-bump interactions participated in (challenges.fistBumpParticipation). */
    fistBumps: integer("fist_bumps"),

    // Ability casts: Q/W/E/R + both summoner spells. Which spell sits in
    // each summoner slot is `summonerSpell1Id`/`summonerSpell2Id` below —
    // the order varies between players, so pair a slot's casts with its id.
    qCasts: integer("q_casts"),
    wCasts: integer("w_casts"),
    eCasts: integer("e_casts"),
    rCasts: integer("r_casts"),
    summonerSpell1Casts: integer("summoner_spell_1_casts"),
    summonerSpell2Casts: integer("summoner_spell_2_casts"),
    /** Data Dragon summoner spell id (summoner.json `key`) in each slot. */
    summonerSpell1Id: integer("summoner_spell_1_id"),
    summonerSpell2Id: integer("summoner_spell_2_id"),

    // All 13 ping types as one object rather than 13 columns — these are
    // informational/fun stats, never filtered/sorted on individually.
    pings: jsonb("pings").$type<{
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
    }>(),

    // Anvil purchases (ITEM_PURCHASED events from `timeline`), split by type
    // rather than one total — confirmed via Data Dragon's item descriptions
    // ("Active - Consume: ... a permanent stat bonus/item"). All null for
    // matches ingested before timelines were fetched.
    /** Item 220000 ("Stat Bonus" anvil). */
    statAnvilsBought: integer("stat_anvils_bought"),
    /** Items 220001-220006 (the 6 "Legendary [Class] Item" anvils — Fighter/
     * Marksman/Assassin/Mage/Tank/Support — counted together). */
    legendaryAnvilsBought: integer("legendary_anvils_bought"),
    /** Item 220007 ("Prismatic Item" anvil). */
    prismaticAnvilsBought: integer("prismatic_anvils_bought"),

    // Boots bought/sold over the course of the match, in purchase/sale
    // order — derived from `timeline` ITEM_PURCHASED/ITEM_SOLD events
    // (undo-corrected, see parseMatch.ts's `bootTransactions`), NOT from
    // `items` above. End-of-match inventory can't answer "did they buy
    // boots" at all: Arena players routinely sell their boots later in the
    // match, so a pair bought and sold leaves no trace in `items`.
    // Stored as id arrays rather than counts so the per-boot breakdown
    // (which pair, how often) is recoverable, same reasoning as `augments`.
    // Both null for matches ingested before timelines were fetched.
    bootsBought: jsonb("boots_bought").$type<number[]>(),
    bootsSold: jsonb("boots_sold").$type<number[]>(),
    // Every item id bought during the match (timeline ITEM_PURCHASED, undos
    // removed, sales NOT subtracted) — the "did they ever buy X" source that
    // end-of-match `items` can't be, since Arena players sell mid-match.
    // Null for matches ingested before timelines were fetched.
    purchasedItemIds: jsonb("purchased_item_ids").$type<number[]>(),

    damageSelfMitigated: integer("damage_self_mitigated"),
    doubleKills: integer("double_kills"),
    tripleKills: integer("triple_kills"),
    quadraKills: integer("quadra_kills"),
    pentaKills: integer("penta_kills"),
    largestKillingSpree: integer("largest_killing_spree"),
    firstBloodKill: boolean("first_blood_kill"),
    firstBloodAssist: boolean("first_blood_assist"),
    itemsPurchased: integer("items_purchased"),
    consumablesPurchased: integer("consumables_purchased"),
    soloKills: integer("solo_kills"),
    skillshotsHit: integer("skillshots_hit"),
    skillshotsDodged: integer("skillshots_dodged"),
    flawlessAces: integer("flawless_aces"),
    saveAllyFromDeath: integer("save_ally_from_death"),

    /** One `[t, physical, magical, true]` tuple per timeline frame
     * (~1/minute): ms since game start, then cumulative damage to champions
     * by type. Feeds the damage curve, which is the only reader. Tuples,
     * not objects, and only these four fields: see TRIMMED_DATA.md for what
     * was dropped (gold/xp/level/position/damage taken) and how to recover
     * it from `matches.timeline`. Null for matches ingested before
     * timelines were fetched. */
    frames: jsonb("frames").$type<Array<[t: number, physical: number, magical: number, trueDamage: number]>>(),
  },
  (table) => [
    primaryKey({ columns: [table.matchId, table.puuid] }),
    // The PK is (match_id, puuid) so it can't serve a `where puuid = X`
    // lookup (puuid isn't the leading column) — this is what every
    // per-summoner stats aggregate filters on.
    index("match_participants_puuid_idx").on(table.puuid),
  ],
);

/**
 * One duel inside an Arena round: two teams fought and `winnerTeamId`'s
 * team survived. Derived from timeline CHAMPION_KILL events by
 * `parseRounds()` (see its comment for the method and its measured error
 * rate) — Riot sends no per-round data. `roundNumber` is the round's
 * position among rounds that had kills, starting at 1. Matches without a
 * stored timeline have no rows here.
 */
export const matchRounds = pgTable(
  "match_rounds",
  {
    matchId: text("match_id")
      .notNull()
      .references(() => matches.matchId, { onDelete: "cascade" }),
    roundNumber: smallint("round_number").notNull(),
    winnerTeamId: integer("winner_team_id").notNull(),
    loserTeamId: integer("loser_team_id").notNull(),
  },
  (table) => [primaryKey({ columns: [table.matchId, table.roundNumber, table.winnerTeamId] })],
);

/**
 * Matches ingestion left out because the match itself is bad: Riot refused it
 * or its timeline for good (a 4xx), the parser threw on it, or Postgres
 * rejected the parsed rows. Such a match is stored nowhere else, so the
 * refresh that met it still completes. An operations log to look into, not
 * data any page reads: one row per match, bumped each time another refresh
 * meets it again, and deleted once it's stored after all. Outages (network,
 * 5xx, 429) never land here: they fail the refresh instead.
 */
export const skippedMatches = pgTable("skipped_matches", {
  matchId: text("match_id").primaryKey(),
  platform: text("platform").notNull(),
  /** What failed: `match` / `timeline` (the Riot fetch), `parse`, `store`. */
  stage: text("stage").notNull(),
  /** Riot's HTTP status, for the fetch stages. */
  riotStatus: integer("riot_status"),
  error: text("error").notNull(),
  /** The summoner whose match history listed it, to reproduce the refresh. */
  seenInPuuid: text("seen_in_puuid").notNull(),
  firstSkippedAt: timestamp("first_skipped_at", { withTimezone: true }).notNull().defaultNow(),
  lastSkippedAt: timestamp("last_skipped_at", { withTimezone: true }).notNull().defaultNow(),
  timesSkipped: integer("times_skipped").notNull().default(1),
});

export type Summoner = typeof summoners.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type MatchParticipant = typeof matchParticipants.$inferSelect;

export const summonersRelations = relations(summoners, ({ many }) => ({
  participations: many(matchParticipants),
}));

export const matchesRelations = relations(matches, ({ many }) => ({
  participants: many(matchParticipants),
}));

export const matchParticipantsRelations = relations(matchParticipants, ({ one }) => ({
  match: one(matches, {
    fields: [matchParticipants.matchId],
    references: [matches.matchId],
  }),
  summoner: one(summoners, {
    fields: [matchParticipants.puuid],
    references: [summoners.puuid],
  }),
}));
