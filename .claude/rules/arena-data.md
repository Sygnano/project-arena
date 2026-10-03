---
paths:
  - "packages/db/src/**"
  - "packages/db/scripts/**"
  - "packages/types/src/**"
  - "apps/api/src/ingestion/**"
  - "apps/api/src/leagueData/**"
  - "apps/api/src/summoners/**"
  - "apps/api/scripts/**"
---

# Riot / Arena data facts

Checked against real ingested matches unless marked otherwise. Riot's public docs don't cover
Arena. `../project-arena/docs/timeline-data.md` documents timeline events in detail but was
written for teams of 2: trust these notes over it. `packages/db/src/parseMatch.ts` is the
authoritative field mapping. Check a new claim with `pnpm --filter @arena/db query` or
`match-json` before relying on it.

## Matches, teams, rounds

- Source: Match-V5 match + timeline, Arena queue (`Queue.ARENA`, 1750 today).
- Team = `playerSubteamId`. Finishing place = `subteamPlacement`, team-level, shared by teammates
  (the legacy `placement` mirrors it). Team size, team count and placement range come from each
  match's rows.
- `info.teams` is a fake win/loss pair left over from the shared Match-V5 schema, not the real
  teams. Bans (`matches.bannedChampionIds`, from `info.teams[].bans[]`) are lobby-wide, one per
  player, with nothing saying who banned what. `-1` is an unused slot: filter out non-positive
  ids. A champion can be banned twice in one match: dedupe per match before a per-match rate.
- `participant.timePlayed` (seconds) already reflects the team's elimination: use it directly.
- Timeline events are keyed by `participantId`. Join through `timeline.info.participants`
  (`participantId` → `puuid`), never by array position. Event types seen: `ITEM_PURCHASED`,
  `ITEM_SOLD`, `ITEM_DESTROYED`, `ITEM_UNDO`, `WARD_PLACED`, `WARD_KILL`, `CHAMPION_KILL`,
  `CHAMPION_SPECIAL_KILL`, `LEVEL_UP`, `SKILL_LEVEL_UP`, `GAME_END`. `matches.timeline` is null on
  matches ingested before timelines were fetched.
- Rounds (`match_rounds`) are derived by `parseRounds.ts`, not sent by Riot: `CHAMPION_KILL`s
  split into rounds on pauses over 40 s (in-fight gaps are under 30 s, shop phases 55-125 s),
  teams paired by who killed whom, the fully wiped team loses (the last death breaks a
  both-wiped tie from revives). `KILL_ACE`/`CHAMPION_SPECIAL_KILL` can't mark rounds. Byes fight a
  ghost that emits nothing, so they never appear.
- Every stored match has `endOfGameResult` `GameComplete`. Placement-0 games (all players on one
  team) exist and are left out of recaps.

## PUUIDs

- Encrypted per Riot application: a PUUID from one app's key gets
  `400 Exception decrypting ...` under another app's key (a regenerated key on the same app is
  fine). Moving to another app's key (a production key usually is one) needs every stored PUUID
  remapped: `summoners`, `match_participants`, and inside `raw`/`timeline`. The old
  `remap-puuids` script is in git history; if needed again, remap only summoners with a recap and
  let the crawler rediscover everyone else.

## Static data: CommunityDragon only (`apps/api/src/leagueData/`, see its README)

- Fetched once per process from `latest` (no version to bump), never per request. Data Dragon
  has no Arena augments. apps/web still builds champion and profile icon URLs from Data Dragon
  (`apps/web/src/utils/riot.ts`, pinned version).
- Champions: `champion-summary.json`; `champions.ts` drops `-1` "None" and the `Jade_*` mode
  variants (60000+). Its `alias` matches Match-V5's `championName` (`FiddleSticks`).
  `championName` is a key (`MonkeyKing`), never display text.
- Ban ids → key: `getChampionCatalog().keysById`. Try `match_participants`'
  `(championId, championName)` first (no network), but a champion banned in every match never
  appears there.
- Augments: `cdragon/arena/en_us.json`, whose `id` is what `playerAugment1`..`playerAugment6`
  return. Parse all six and drop zeros (only four are used today). `rarity`: `0` Silver, `1` Gold,
  `2` Prismatic, and `4` for meta entries ("Gain an Augment slot", "Replace Augment"): don't
  assume three values. Loaded by `getAugmentCatalog()`.
- Icons: `https://raw.communitydragon.org/latest/game/{iconLarge, lowercased}`. Game-data paths
  `/lol-game-data/assets/<path>` map to
  `.../plugins/rcp-be-lol-game-data/global/default/<path, lowercased>`. Unnamed items come back
  as `Item_<id>_Name`: treat them as nameless.
- Team crests for `playerSubteamId` come from the user's in-game knowledge (no Riot or
  CommunityDragon data maps them): `1` Poro, `2` Minion, `3` Scuttle, `4` Krug, `5` Raptor,
  `6` Sentinel. `7`/`8` (Wolf/Gromp) are deliberately unmapped: don't research or guess them.
  Icons: `.../plugins/rcp-fe-lol-match-history/global/default/images/subteams/{slug}.svg`.

## Items

- One `items.json` download backs every item lookup (`getItemCatalog()`): names, prices, icons,
  the Prismatic and boot lists, the Legendary filter.
- **Acquisition comes from the timeline**, not from `match_participants.items` (end-of-match
  inventory): players sell items mid-game, boots especially (about half of all pairs). `items`
  answers only end-state questions ("finished the match wearing boots").
- **Apply `ITEM_UNDO`**: `{beforeId: <item>, afterId: 0}` undoes a purchase,
  `{beforeId: 0, afterId: <item>}` undoes a sale (about 10% of boot purchases and sales).
  `ITEM_DESTROYED` isn't counted as a sale. Any new stat from timeline item events needs this.
- `purchased_item_ids`: every item bought in the match, undos removed, sales not subtracted.
  Legendary items = that unioned with `items` (a few are granted by an anvil or an upgrade).
  `ItemCatalog.isLegendary()`: total gold >= 2000, minus Prismatics, anvils/vouchers/Shardblade
  (`220000`-`220012`), special items, boots, consumables and trinkets.
- Never in the timeline, only in `items`: the Shardblade `220012`, most Prismatics (granted by
  the `220007` anvil), and the special upgrades `224403` Golden Spatula, `228002` Wooglet's
  Witchcap, `223069` Void Immolation.
- Prismatic items have no rarity field anywhere (Match-V5, Data Dragon, CommunityDragon).
  `PRISMATIC_ITEM_IDS` (`apps/api/src/leagueData/items/itemIds.ts`) is the Arena-map items at
  exactly 2750 g. After a patch, recheck it by that rule and against held counts, never by id
  range.
- Boots: Arena serves 8 flat 500 g variants only (`ARENA_BOOT_ITEM_IDS` in `parseMatch.ts`,
  synchronous for the parser and backfills; `ItemCatalog.arenaBoots()` adds names and icons).
- Anvils (`ITEM_PURCHASED` counts): `220000` stat, `220001`-`220006` legendary class anvils
  summed, `220007` Prismatic. 50-70 anvil events per match is normal. Vouchers
  `220008`-`220011` have never appeared and are excluded.
- Every player holds the trinket (`3348` Arcane Sweeper). Any "most-held items" stat filters it
  by the `Trinket` tag (`Item.isTrinket`), never by id.
- `22xxxx` ids are Arena's own variants of ordinary items: real catalog entries.

## Participant fields

- Summoner spells: `2202` Flash and `2201` Flee; everyone has both, slot order varies. Pair a
  slot's casts with that slot's id (`apps/api/src/summoners/stats/sections/summonerSpells.ts`;
  names and icons in `apps/api/src/leagueData/summonerSpells.ts`).
- Healing and shielding = `challenges.effectiveHealAndShielding` (rounded). CC score =
  `timeCCingOthers`; `totalTimeCCDealt` is also stored (it counts overlapping CC twice).
- Damage curve `frames`: one `[t, physical, magical, true]` cumulative tuple per timeline frame.
  The splits can sum 0-2 below Riot's total. A knocked-out player's frames continue flat until
  the match ends; when summing curves, carry a finished game's last value forward.
- Pings: one smallint array in `PING_TYPES` order.
- Teammates' champions: query `match_participants` by match and team (no denormalized column).
- Riot's data, not our bugs: `totalTimeSpentDead` often exceeds time played (dropped; cap it
  against `timePlayedSeconds` if re-added); `killingSprees` is always 0 (`largestKillingSpree`
  is fine). Not available at all: a "sorry" emote count, full-game damage per opponent (only the
  kill fight's `victimDamage*`), a biggest single hit (closest: `largestCriticalStrike`).
  `missions.playerScore*` meanings are unknown, `perks` are unused, and most `challenges` fields
  are Summoner's Rift-only zeros.
