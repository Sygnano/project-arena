# Arena Stats — Project Charter & Architecture

This file directs any future work (prompting, planning, and architecture decisions) on this
repository. Read it before making structural changes. Update it when a decision below changes —
it should stay the source of truth, not a historical snapshot.

## 1. What this is

A League of Legends **Arena** game-mode stats tracker for a friend group (not the general public,
not solo-only). Think "op.gg/u.gg, but scoped to Arena mode and to the summoners we actually
track." It replaces an earlier Vite + React prototype (`../project-arena`) that proved out the
Riot API data shapes and a first pass at the visual design; that prototype's fonts and color
system are being carried forward, its Vite+ tooling and Express-less structure are not.

### Users & access

- **Audience: friend group, open search.** Built for the crew, but the splash page (`app/page.tsx`)
  searches any Riot ID on any supported platform (decided with the user when the splash page was
  added; this replaced "adding a summoner is an admin action"). **Everything that calls Riot goes
  through one server-sent event stream** (decided with the user): `POST
  /summoners/by-riot-id/:region/:gameName/:tagLine/refresh` (`apps/api/src/routes/summoners/
  refreshRoutes.ts`, proxied by the web app's `app/api/summoner/[platform]/[riotId]/refresh`),
  which resolves an unknown Riot ID (account-v1 + summoner-v4), sends the summoner, queues and
  follows the match fetch, then sends the new recap itself (`RefreshEvent` in `@arena/types`). The
  page's own reads never call Riot: a search just navigates to the summoner's URL, and the page
  reads `GET /summoners/by-riot-id/...` (summoner + fetch in progress) and `.../stats` from our
  database. Page flow: not stored → FETCH MATCHES button; stored but never fetched
  (`lastRefreshedAt` null) → the same button with their icon; fetched → the recap. A first
  full-history fetch is never automatic (decided with the user, so it's always a deliberate click).
  During a fetch the page shows the queue screen (`refresh-view.tsx`: queue position, then "match X
  of Y" with an ETA), then swaps the recap in place from the stream's `stats` event (put in the
  TanStack cache by `hooks/use-summoner-refresh.ts`). A visitor arriving mid-fetch joins it (the
  stream attaches to a running job without starting one), so a link shared mid-fetch works. A
  summoner who already has a recap keeps showing it during a refresh. `lastRefreshedAt` is the one "last
  updated" time shown everywhere (the Welcome slide, which adds a REFRESH button once it's over
  15 min old, and the link preview's text and `opengraph-image.tsx` card); it's stamped only when a
  match fetch finishes, never by a view. A refresh requested under 15 min after the last one just
  returns the recap. Below the search, the splash lists the recaps **this
  browser** opened most recently (`lib/recent-recaps.ts`, localStorage, max 12): per visitor, not a
  site-wide feed, since a shared list let anyone put any Riot ID on the homepage (decided with the
  user; the server-side `recapViewedAt` column that fed the old shared list was dropped). Riot
  requests are rate-limited per visitor IP in the refresh route (`apps/api/src/rateLimit.ts`: 30
  Riot lookups or fetches / 10 min, 5 first fetches / hour); following a fetch that's already
  running costs nothing, and neither does joining a Riot ID lookup already running (everyone
  searching the same unstored Riot ID at once waits on one lookup, `pendingLookups` in
  `refreshRoutes.ts`: like a fetch, the queue entry belongs to the summoner, not to each visitor),
  but a visitor IP holds at most 4 refresh streams open at once. Limits
  shared by every visitor answer `busy`, since a pool of addresses gets past per-IP ones (a 2026-09
  security audit): no new first fetch while 10 wait in the lane, no new refresh while 50 do, at
  most 10 Riot ID lookups running per Account-V1 cluster (they share its Riot budget with match
  fetches), and 200 refresh streams open overall. Recap reads (`GET .../stats`, so every recap page
  view) are limited to 60 / 10 min per visitor IP: an uncached recap costs ~100 ms of the API's
  only thread. An IPv6 visitor is keyed on their /64 (`rateLimitKey`), since one household holds
  2^64 addresses. The web server forwards the visitor's IP in `x-arena-client-ip`
  (`lib/visitor-ip.ts`): the LAST `x-forwarded-for` entry, which Railway's edge appends (earlier
  entries are whatever the client sent, so reading the first one let anyone choose their own
  rate-limit key; a CDN in front would change which entry is right). The API trusts that header
  because only the web server can call it: both share `API_PROXY_SECRET`, sent as
  `x-arena-proxy-secret` by `apiFetch` (`lib/api.ts`), and once it's set the API refuses every
  request without it except `/health`. The refresh proxy refuses browser requests from other sites
  (`Sec-Fetch-Site` not `same-origin`), so no page elsewhere can spend Riot calls through its
  visitors. Inside the API process all match fetching runs through
  `apps/api/src/ingestion/refreshQueue.ts`, with one lane per Riot regional cluster (europe,
  americas, asia, sea; decided with the user): one summoner at a time per lane, lanes side by side,
  since Riot's rate limits are per cluster. Within a lane, refreshes of already-fetched summoners
  run before waiting first fetches (decided with the user, so ten huge first fetches can't hold the
  friend group's refreshes back for hours). EUW, EUNE, TR, RU and ME share the `europe` lane (and budget), OCE, SG, TW and VN
  share `sea`; an NA fetch never waits behind EUW. Queue positions and the "queue full" limit are per lane. In memory
  (a restart drops the queue; pressing again re-queues), with `subscribe()` feeding the streams. A first fetch pulls the
  full history, 2 Riot calls per match (~2.4s per match on a dev key's 100 calls / 2 min), which is why
  there's a queue screen at all; its ETA is the pace measured so far in that fetch, not a constant.
- **Every Riot call goes through the Riot gateway** (`apps/riot-gateway`, see its README; decided
  with the user 2026-09-24, aiming for a public build with a production key and the crawler running
  next to the live site). It's the only process holding `RIOT_API_KEY`: it keeps Riot's rate limits
  per Riot host (routing value) and sends each host's requests strictly by **priority bucket**,
  `lookup` (a visitor's Riot ID search) > `refresh` > `firstFetch` > `upkeep` (`check-recaps`,
  `retry-skipped`, decided with the user so a run finishes while the crawler goes on) > `crawler`: a bucket goes out only once every bucket above it is empty on
  that host, first come first served within one. A bucket is never full: it holds every request
  sent to it, and a lower bucket just waits as long as higher ones keep receiving requests
  (decided with the user; no cap, no refusal, no timeout for waiting). `PRIORITIES` in
  `packages/riot/src/priority.ts` is the list (a future `vip` bucket is one entry). One route per Riot endpoint, answering a
  server-sent event stream: `hold` events whenever a waiting request's standing changes (its queue position, or next in line for Riot's rate
  limit; never sent to the scripts' `upkeep` and `crawler` buckets), then Riot's body verbatim; callers parse and store it. Callers reach it through
  `RiotGateway` (`@arena/riot`, `riotGateway.client(priority)` in `apps/api/src/riot.ts`), which
  keeps the old `riot.match.getMatch(...)` interface. The refresh queue turns a hold of 3s or more
  into `RefreshProgress.waitingOnRiot`, shown on the page as "waiting on Riot". No parallel
  fetches (decided with the user: first come first served): a lane and a crawler worker still send
  one call at a time.
- **Bulk ingestion is a crawler, a process separate from the API.** There is no background poll
  loop in the API (removed at the user's request). Its only goal is discovery: absorb as many
  matches as possible (decided with the user). Keeping anyone's recap fresh is not its job, so
  judge any change to it by matches stored per Riot call. `apps/api/scripts/crawl.ts` runs one worker
  per regional cluster (the refresh queue's lanes), each repeatedly refreshing a never-refreshed
  summoner. By hand: `pnpm --filter @arena/api crawl [--summoners N]`, which ends when nobody in
  a lane is left unrefreshed. Hosted: the Railway `crawler` service, running the bundled script
  `node --enable-source-maps apps/api/dist/scripts/crawl.mjs --forever` (build and start commands
  in the dashboard, see §3's Railway table; Railway's config-as-code files are deprecated), which
  never exits: with no never-refreshed
  summoner left it goes through the lane's refreshed ones, oldest `lastRefreshedAt` first, skipping
  anyone refreshed in the last 15 minutes (decided with the user: it's switched off by hand once
  that's all it does, and the 15 minutes keep a lane with a handful of players from refreshing them
  non-stop). When nobody qualifies it looks again every minute. It waits out errors. It runs next
  to the live site for good (decided with the user 2026-09-24, replacing "fills the database before
  launch, then stops"): its calls wait in the gateway's lowest bucket, so it only spends what the
  site leaves.
  It replaced a single-file Railway Function that hand-copied the ingestion code. A platform
  with no summoner at all is seeded from `scripts/crawl-seeds.ts` (arenasweats.lol's top Arena
  players per region, several per platform in case of renames) and that seed is crawled first
  (decided with the user, so every region gets data, not just the ones someone searched). Every
  refresh, from the crawler or a web search, adds each participant of a newly stored match to
  `summoners` with `lastRefreshedAt` null, so the crawl snowballs outward from whoever is in the
  database. A second crawler, `scripts/crawl-leaderboard.ts` (Railway `crawler-leaderboard`, a
  copy of `crawler` with its own start command; by hand `pnpm --filter @arena/api
  crawl:leaderboard [--start-rank N] [--players N]`), goes down arenasweats.lol's global Arena
  leaderboard instead (decided with the user: top players are the likeliest to keep playing Arena
  and to look up their stats). It fetches one page of 125 ranks (arenasweats' maximum) and splits
  it into one bucket per lane by each player's region. When a lane's bucket runs dry it fetches
  the next page, which refills every bucket, so arenasweats gets one call per 125 players. Each
  player's Riot ID is resolved at Riot, then their matches are ingested; anyone refreshed in the
  last 6 hours is skipped without a Riot call. Buckets have no size limit (decided with the user: europe
  gets ~45% of each page but crawls no faster than sea, so its bucket just grows); past the last rank, and after
  a restart, it starts again from rank 1. Gaps and repeats from the ranking moving are accepted
  (decided with the user). Its Riot calls also wait in the `crawler` bucket.
  A match is stored once however many of its players get refreshed, and later
  refreshes only ask Riot for games since the previous one (minus a 2h overlap). Discovered rows
  take their Riot ID/icon/level from the match they were met in, and their platform from the
  match id's prefix, as does the match itself: Match-V5 lists a player's games on every platform of
  the cluster (an ME1 player's EUW1 games too), so the refreshed summoner's platform would file
  everyone in an EUW1 game under ME1. Ingestion never overwrites
  an existing row from match data: a match can predate a rename, and account-v1 is the only source of current
  names. Both account-v1 paths live in `ingestion/resolveSummoner.ts` and write through
  `saveSummonerFromRiot` (the one writer of Riot profile fields): the refresh stream resolving an
  unknown Riot ID (`resolveSummonerByRiotId`), and the crawler refreshing each summoner's Riot
  ID/icon/level (account-v1 + summoner-v4, 2 calls) just before fetching their matches
  (`refreshSummonerProfile`). A failed profile refresh is logged and the crawl moves on to the
  matches. `summoners` therefore holds far
  more than the friend group, so anything listing it must limit/filter.
  A **bad match** is one Riot says didn't end normally: `endOfGameResult` other than
  `GameComplete` (an aborted lobby, e.g. `Abort_Unexpected`, sent with no participants; every
  stored match says `GameComplete`). It goes to `bad_matches` and is **never fetched again**:
  `ingestSummoner` leaves known bad ids out of every refresh, `check-recaps` included, and checks
  the result right after the match call, before spending the timeline call (decided with the
  user: an aborted lobby sits in up to 16 players' histories and cost 2 calls each time). A
  **failed match** (Riot answers a 4xx other than 429 for it or its timeline, the parser throws,
  or Postgres rejects its rows) is stored nowhere and **is fetched again**: `ingestSummoner` logs
  it in `skipped_matches` (one row per match with the failing stage, Riot status and error,
  counting repeats, deleted if it stores fine later) and in the process log, and the refresh goes
  on (so one broken match can't block a summoner forever). A refresh only lists games since the
  previous one, so it seldom meets that match again; `pnpm --filter @arena/api retry-skipped`
  (`scripts/retry-skipped.ts`, a Railway cron service decided with the user: the whole repo, its
  bundle `apps/api/dist/scripts/retry-skipped.mjs` as start command, see §3's Railway table, a
  cron schedule set in the dashboard) fetches every row again and exits.
  Outages (network, 5xx, 429) still fail the refresh, and so do 5 matches in a row failing at
  parse or store with the same error (`FailureBreaker` in `ingestSummoner.ts`: a bug or a Riot
  format change, which would otherwise stamp every summoner refreshed with none of their matches
  stored; the retry script stops on it too). Look in `skipped_matches` when matches seem to be missing.
  Since refreshes only look back to the previous one, a gap further back stays until
  `pnpm --filter @arena/api check-recaps` (`scripts/check-recaps.ts`), a one-off run now and then
  in the stack like the crawler: it asks Riot for the whole history of every summoner with a
  `lastRefreshedAt` (one worker per cluster), fetches whatever isn't stored, stamps each one, and
  exits.
- **No auth in v1.** All pages are public read-only within whatever the app's own deployment
  visibility is (i.e. no login, no accounts, no sessions). Do not add auth infrastructure
  speculatively — revisit only if we need personalization (favorites, alerts) later. That
  includes `/dev` (`app/dev/page.tsx`, `GET /dev/summoners`), an unlinked debug table of every
  summoner with a recap, latest refresh first (capped at 500 rows): public on purpose, decided
  with the user.
- SSR (Next.js) is still the right call for the web app — shareable profile/match links, good
  defaults, streaming, and a real component framework — but note the driver has shifted: this is
  **not** primarily an SEO play (that was true for a public tool, less true for a friend-group
  tool). Don't over-invest in SEO-specific work (sitemaps, metadata tuning) unless the scope
  changes back toward "public tool."

### v1 feature priorities (in order)

1. **Match history & profile** — per-tracked-summoner Arena match list: placement, KDA, champion,
   augments, items, per match.
2. **Champion / augment stats** — aggregate win rate and average placement by champion, by
   augment, and by champion+augment combination.
3. **Team synergy stats** — Arena is played in teams; see §2 for why team size must not be
   hardcoded. Stats on which champion combinations perform best together as a team.
4. **Friend group leaderboard** — rankings/comparisons across the tracked group (avg placement,
   win rate, most-played champion, etc).

## 2. Domain model notes (Arena-specific — read before touching schema)

- Arena has changed its team size before (historically 8 teams × 2 players = 16; as of the
  current patch it's teams of **3** players). **Do not hardcode team size anywhere** — in the DB
  schema, in ingestion code, or in stats queries. Every match participant row must carry its own
  `team_id` and the schema must derive "how many players were on this team" from the actual data
  ingested for that match, not from a constant. "Duo synergy" from the original design
  conversation is superseded by **team synergy** for N teammates (currently 3) — treat N as
  per-match data, not a type parameter.
- A single Riot **match** (Arena) contains multiple **teams**, each team contains multiple
  **participants** (summoners), each participant has: champion played, augments selected
  (currently up to 4 in Arena), items, placement (1st–8th, or however many teams exist that
  match), kills/deaths/assists, damage, gold, etc. Placement is team-level, not just
  participant-level (teammates share a placement).
- Source data: Riot's Match-V5 API (`/lol/match/v5/matches/{matchId}` +
  `/lol/match/v5/matches/{matchId}/timeline`), filtered to Arena queue (`queueId: 1750` as of
  patch 16.10 — confirmed against a real sample in `../project-arena/data/matches/`; Riot has
  changed Arena's queue ID before, so don't assume it's permanent). Team grouping comes from each
  participant's `playerSubteamId`; the team's finishing place is `subteamPlacement` (a legacy
  `placement` field also exists and currently mirrors it, but `subteamPlacement` is the one to
  read). Augments live in `playerAugment1`..`playerAugment6` — only the first 4 are populated on
  the current patch (5/6 come back as `0`), so parse all 6 and drop zeros rather than hardcoding 4.
  Static reference data (champion/item/summoner spell/augment names, prices, tags & icons) comes
  from **CommunityDragon only**, through `apps/api/src/leagueData/` (see its README): fetched
  once per process from `latest` (the live patch, no version to bump), never per request.
  - **Why CommunityDragon, not Data Dragon**: Riot's Data Dragon has no Arena augments at all,
    and CommunityDragon covers everything else Data Dragon gave us. Verified 2026-09 (patch
    16.18) before switching: on all 199 item ids ever held or bought in tracked matches, names,
    total gold, `Trinket`/`Consumable` tags and the Legendary classification are identical
    (`items.json`'s `priceTotal`/`categories` = Data Dragon's `gold.total`/`tags`); all 48
    Prismatics are 2750g; every champion and summoner spell matches; every icon resolves. Its
    `champion-summary.json` `alias` even matches Match-V5's `championName` where Data Dragon
    differs (`FiddleSticks`), but it also lists `-1` "None" and `Jade_*` mode variants (60000+),
    which `champions.ts` filters out. Unnamed items come back as `"Item_<id>_Name"` (Data Dragon:
    `""`), treated as nameless. apps/web still builds champion/profile icon URLs from Data Dragon
    (`apps/web/src/lib/riot.ts`, pinned version).
  - **Champion ID -> key**: `getChampionCatalog().keysById` (`62` -> `"MonkeyKing"`, the form
    `championIconUrl()` in apps/web expects, not the display name "Wukong"). Needed because bans
    (`matches.bannedChampionIds`) only give champion IDs, and the obvious shortcut — looking names
    up from `match_participants`, which already has `(championId, championName)` for everyone's
    picks — systematically fails for the *most* interesting rows: a champion banned in 100% of
    tracked matches can, by definition, never appear in `match_participants` (nobody ever got the
    chance to pick it). Use `match_participants` first since it needs no network call, and fall
    back to this only for IDs it doesn't cover.
  - **Augments**: `https://raw.communitydragon.org/latest/cdragon/arena/en_us.json` (225
    augments, each with a numeric `id`, `apiName`, `name`, `rarity`, description, icon path).
    Verified the numeric `id` matches exactly what `playerAugment1`-`playerAugment6` return (e.g.
    `id: 19` → `"Dashing"`, confirmed against a real match). Icon URLs are
    `https://raw.communitydragon.org/latest/game/{iconLarge, lowercased}`; game-data icons
    (items, spells) map `/lol-game-data/assets/<path>` to
    `.../plugins/rcp-be-lol-game-data/global/default/<path, lowercased>`. Loaded by
    `getAugmentCatalog()` (`apps/api/src/leagueData/augments/`).
    `rarity` is mostly the expected three in-game tiers (`0` = Silver, 68 augments; `1` = Gold, 75;
    `2` = Prismatic, 57) but there's a 4th value, `4` (25 augments, no `3` at all) covering entries
    like "Gain an Augment slot", "Replace Augment", and "Gain a Prismatic Stat Anvil" — these read
    as internal/meta augments outside the normal in-game offer pool, not yet otherwise identified;
    don't assume `rarity` only ever takes the three "obvious" values.
  - **Team crest icons for `playerSubteamId`**: Arena's lobby "teams" each have a jungle-camp-themed
    crest (Poro, Wolf, Minion, Krug, Raptor, Scuttle, Sentinel, Gromp), used in `TeamSlot.tsx`'s
    chart x-axis instead of a plain "Team N" label. `playerSubteamId` -> crest is **not** derivable
    from anything Riot's Match-V5 API sends (only the bare numeric id), and isn't in any Data
    Dragon/Community Dragon data file either (checked `cherry-lobby.json`, the Arena augment dump,
    and map30's full decompiled game-data JSON — none contain an id-to-name table) — this mapping
    came from the user's own in-game knowledge, not independently verified against ingested data
    the way everything else on this list is: `1` = Poro, `2` = Minion, `3` = Scuttle, `4` = Krug,
    `5` = Raptor, `6` = Sentinel. `7`/`8` (Wolf/Gromp) are deliberately left unmapped rather than
    guessed at an order, since the current 6-team format (see the team-size note above) means
    `playerSubteamId` can't exceed 6 anyway — revisit if Arena ever goes back to 8 teams. Icons:
    `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/images/subteams/{slug}.svg`
    (`slug` lowercase, e.g. `poro.svg`) — the same assets the LoL client itself uses for this exact
    purpose (its own match history team badges), confirmed to exist via a real directory listing.
  - **Arena's "Prismatic Item" tier (the rarest end-game items, from the `220007` anvil) has no
    rarity field anywhere** — checked and ruled out during this session: Riot's raw Match-V5
    payload (searched the full decompressed JSON text of a real match for "rismatic": zero hits —
    item rarity isn't in the API at all), official Data Dragon's `item.json` (no rarity field
    distinguishing them from other items; the `maps["30"]` Arena-map flag is present on ~232
    items, far more than just prismatics, and is unreliable even for that — base Boots show
    `maps["30"]: false`), and Community Dragon's more detailed
    `plugins/rcp-be-lol-game-data/global/default/v1/items.json` (has `categories` but nothing
    Arena- or rarity-specific either; its `specialRecipe` field looked promising — one item,
    Prowler's Claw, has `specialRecipe: 220007` linking it to the Prismatic anvil — but checking
    every item confirms it's the *only* one set that way, so it's not a usable marker). The actual
    catalog: items with `maps["30"]: true` **and** `gold.total` exactly 2750 (48 items on 16.18,
    e.g. `447106` "Dragonheart", `443090` "Reaper's Toll", `226630` "Goredrinker"). `maps["30"]`
    alone is too broad, but together with the Prismatic price it matches real data exactly: every
    one is held in tracked matches, and bought directly far less often than held (the anvil grants
    it). An earlier version assumed "every id in `443000`-`447999`" and was wrong four ways, caught
    by a Prismatic nobody had ever held across 342 matches: `443080` Twin Mask (not in Arena),
    `446693` (a stale Prowler's Claw — Arena's is `226693`, held 160 times), `447111` Overlord's
    Bloodmail (a 2500g Legendary, bought 370 of 450 times held), and missing Goredrinker `226630`.
    The list is hardcoded as `PRISMATIC_ITEM_IDS` in `apps/api/src/leagueData/items/itemIds.ts`; after a patch,
    recheck it with that price+map rule and against held counts, not by id range.
- **PUUIDs are encrypted per Riot application.** A PUUID obtained with one app's API key returns
  `400 Bad Request - Exception decrypting ...` under another app's key (a regenerated dev key on
  the same app is fine). Every stored PUUID — `summoners`, `match_participants`, and inside the
  `raw`/`timeline` blobs — belongs to the app of the key that ingested it. Switching to a key from
  a different app (a production key usually means a new app) needs every PUUID remapped. The
  `remap-puuids` script that did it was deleted (2026-09, decided with the user: sized for ~4,700
  players, it wouldn't cope with the crawler's database); it's in git history. If it's needed
  again, remap only summoners with a recap and let the crawler rediscover everyone else.
- The Match-V5 **timeline** endpoint (`/lol/match/v5/matches/{matchId}/timeline`) is fetched
  alongside match details for every ingested match and stored in `matches.timeline` (nullable —
  matches ingested before this was added won't have one). Confirmed on real Arena data: it returns
  frame-by-frame events (`ITEM_PURCHASED`, `ITEM_SOLD`, `ITEM_DESTROYED`, `WARD_PLACED`,
  `WARD_KILL`, `CHAMPION_KILL`, `CHAMPION_SPECIAL_KILL`, `LEVEL_UP`, `SKILL_LEVEL_UP`, `GAME_END`),
  keyed by `participantId` — join back to `match_participants` via `timeline.info.participants`
  (`participantId` → `puuid`), not by array position. It is not parsed into structured
  event/purchase-timing tables yet — that's future work once a specific stat needs it (e.g. "time
  to first legendary item").
- **Rounds (`match_rounds`) are derived, not sent by Riot.** `CHAMPION_SPECIAL_KILL`/`KILL_ACE`
  cannot mark rounds: it fires only 4-6 times per match (vs ~30 duels) with no victim team, and
  real full-team wipes go without one. `packages/db/src/parseRounds.ts` instead splits
  `CHAMPION_KILL`s into rounds on >40s pauses (kill gaps are cleanly bimodal: <30s in a fight,
  55-125s across the shop phase), pairs teams by who killed whom, and marks the fully-wiped team
  as the loser (the last death breaks a both-wiped tie from revives). Measured on 341 matches:
  10,558 duels, 5 ambiguous rounds and 3 unresolved duels skipped. Teams on a bye fight a ghost
  that emits no events, so byes never appear. Filled at ingestion and by
  `pnpm --filter @arena/db backfill-rounds` (rerun after changing the parser).
- `matches.raw` and `matches.timeline` are **brotli-compressed `bytea`, not `jsonb`.** Measured on
  real Arena payloads (see git history around the migration for the exact numbers): app-level
  brotli (quality 9, via `compressJson`/`decompressJson` in `packages/db/src/compression.ts`) gets
  ~13-22x smaller than the original JSON text, vs. only ~2-5x from Postgres's own automatic
  TOAST/pglz compression on the same data as plain `jsonb` — timelines especially are extremely
  repetitive and compress hard (~1.3MB → ~65-100KB). This cut the `matches` table from ~330KB/match
  to ~80KB/match, which matters on a free-tier Postgres plan. The tradeoff is real but currently
  costs nothing: neither column is ever queried with SQL jsonb operators (`->`, `@>`, etc.) —
  everything reads the whole row and parses in application code — so losing that queryability isn't
  a loss in practice. If a future feature genuinely needs to query *into* one of these columns with
  SQL, that's the point to reconsider (e.g. add a derived, queryable table instead of decompressing
  in SQL). Always write through `compressJson()` and read through `decompressJson()` — never write
  a plain JS object directly into these columns.
- The old prototype's `data/` directory (raw JSON dumps per match, plus one huge
  `arena-matches.json`) is a useful reference for the real shape of a match/timeline payload when
  writing the Drizzle schema and the ingestion parser, but the new app stores this in Postgres, not
  flat files. `../project-arena/docs/timeline-data.md` documents the timeline event shapes in
  detail — it's a good reference but predates the switch to teams of 3 (it was written when Arena
  was 8-9 teams of 2), so trust our own verified data over it on team-size-related claims.
- `match_participants` carries a wide set of per-participant stats beyond the basics, sourced from
  fields discovered by inspecting real match payloads (not from Riot's public docs, which don't
  cover Arena specifics) — see `packages/db/src/parseMatch.ts` for the authoritative mapping.
  Notable findings from that survey, in case they matter for future columns:
  - **`participant.timePlayed`** (seconds) is already Riot-computed and already accounts for a
    team's actual elimination time (Arena teams can be eliminated before the match's overall
    `gameDuration` ends) — use it directly rather than re-deriving elimination time from timeline
    `KILL_ACE` events, even though that derivation is possible (documented in `timeline-data.md`)
    and matches this field exactly in the example checked.
  - **Anvils** (`statAnvilsBought`/`legendaryAnvilsBought`/`prismaticAnvilsBought`): Arena's "anvil"
    consumables are item IDs `220000`-`220007` — confirmed via Data Dragon's `item.json`
    descriptions ("Active - Consume: ... a permanent stat bonus"). Split into 3 columns rather than
    one total: `220000` ("Stat Bonus") alone, `220001`-`220006` (the 6 "Legendary [Class] Item"
    anvils — Fighter/Marksman/Assassin/Mage/Tank/Support) summed together, and `220007`
    ("Prismatic Item") alone. Counted as `ITEM_PURCHASED` events for these IDs in `timeline`;
    ~50-70 such events per match across 18 players is normal (anvils are used repeatedly through a
    match, not a one-time pick), not a data bug. Checked Data Dragon for adjacent IDs
    (`220008`-`220011` are Arena-specific "voucher" items that redeem for anvils, `6032` is the
    ARAM equivalent of `220000`) — none of them appear even once across every real match ingested
    so far, so they're excluded; revisit only if one is ever actually observed.
  - **Granted items vs. bought items.** Some Arena items never emit `ITEM_PURCHASED` at all, so
    the timeline has no trace of them and end-of-match `items` is the only source: the
    **Shardblade** (`220012`, "increase the effectiveness of stat shards", 17 of 333 tracked
    matches), Prismatic Items (mostly — granted by the `220007` anvil), and the **special
    upgrade items** `224403` The Golden Spatula, `228002` Wooglet's Witchcap and `223069` Void
    Immolation (verified: Void Immolation appears exactly when a Sunfire Aegis/Hollow Radiance is
    `ITEM_DESTROYED`, Wooglet's when a Rabadon's is). Ordinary **Legendary items** (2500g, mostly
    `22xxxx` ids) ARE bought, so they come from `match_participants.purchased_item_ids` — every
    item id bought in the match, undos removed, sales not subtracted (parsed in `parseMatch.ts`,
    backfilled for all matches) — unioned with `items` to catch the few granted by a Legendary
    anvil or an upgrade (Seraph's, Muramana). `ItemCatalog.isLegendary()`
    (`apps/api/src/leagueData/items/itemCatalog.ts`) classifies Legendary as total gold `>= 2000` minus
    Prismatics, anvils/vouchers/Shardblade (`220000`-`220012`), the special items, boots,
    consumables and trinkets. Win rate on these item stats = top-3 finish, like everywhere else.
  - **Every Arena player carries the same trinket, so it dominates any naive
    "most-held items" stat** — `match_participants.items` (end-of-match inventory
    slots) always contains `3348` "Arcane Sweeper", Arena's free trinket, which is
    never bought and never leaves the inventory. Measured on real data: it was the
    single most-held item for all 60 champions the tracked summoner has played,
    present in 100% of their games, burying the actual build. Filter it out via
    the item's own `"Trinket"` tag (CommunityDragon `categories`, `Item.isTrinket`)
    rather than hardcoding `3348`, so a patch swapping Arena's trinket doesn't
    silently reintroduce the problem. No stat lists held items any more (the
    per-champion lists are Legendary/Prismatic/special/boots only), so nothing
    applies this filter today; any future "most-held items" stat needs it again.
    One `items.json` download backs every item lookup (`getItemCatalog()`; names,
    prices, icons, the Prismatic/boot lists and the Legendary filter are
    synchronous methods on it).
    Note that Arena serves its own `22xxxx`-prefixed variants of ordinary items
    (e.g. `222510` "Dusk and Dawn", `223006` "Berserker's Greaves") — these are
    real catalog entries with working names and icons, not corrupt ids.
  - **Boots** (`match_participants.bootsBought`/`.bootsSold`): Arena does not sell the normal
    game's boot tree — no tier-1 `1001` "Boots", no `3006`/`3020`/etc. It serves its own 8 flat
    500g variants (`223005` Ghostcrawlers, `223006` Berserker's Greaves, `223008` Gluttonous
    Greaves, `223009` Boots of Swiftness, `223020` Sorcerer's Shoes, `223047` Plated Steelcaps,
    `223111` Mercury's Treads, `223158` Ionian Boots of Lucidity), the same `22xxxx`-prefixed
    re-skinning noted above for ordinary items. Verified across every ingested match: these 8 are
    the only ids Data Dragon tags `Boots` that appear in any timeline event. The list lives in
    `packages/db/src/parseMatch.ts` as `ARENA_BOOT_ITEM_IDS` (it must be available synchronously,
    with no network call, to both the parser and the backfill script); `ItemCatalog.arenaBoots()`
    decorates it with names, prices and icons. The anvil ids are exported from there too.
    **`match_participants.items` cannot answer "did they buy boots"** — Arena players routinely sell
    their boots later in the match for stats, so a pair that was bought and sold leaves no trace in
    the end-of-match inventory (measured on the tracked summoner: 165 of 336 pairs sold, 163 of 333
    matches finished barefoot). Boots therefore come from `timeline` ITEM_PURCHASED/ITEM_SOLD
    events, and `items` is used only for the genuinely end-state question ("finished the match
    wearing boots").
    **`ITEM_UNDO` must be applied, not ignored** — ~10% of both boot purchases and sales in the
    current dataset were undone in the shop (366 and 277 respectively). Riot emits one untyped
    `ITEM_UNDO` event carrying `beforeId`/`afterId` rather than a typed undo-purchase/undo-sale
    event: undoing a purchase is `{beforeId: <item>, afterId: 0}` with a positive `goldGain` (the
    refund), undoing a sale is `{beforeId: 0, afterId: <item>}` with a negative one — confirmed
    against real data, where all 643 boot-related undos took exactly those two shapes. Counting raw
    ITEM_PURCHASED events without this overstates purchases (370 vs. the true 336). Any future stat
    built from timeline item events needs the same correction.
    `ITEM_DESTROYED` also fires for boots, but only a couple of times across the whole dataset
    (something consumed/replaced them rather than the player selling), so it's deliberately not
    folded into the sold count.
  - **Bans** (`matches.bannedChampionIds`): the ban list in the raw payload lives under
    `info.teams[].bans[]`, but Arena's `info.teams` is a vestige of the shared Match-V5 schema —
    it's just a fake win/loss pair (`teamId: 100`/`0`), not the real per-match subteams. The bans
    themselves are lobby-wide (18 champion IDs, one ban per player, no participantId attached to
    say who banned what) — stored once per match, not duplicated per participant. **`-1` is a real
    value Riot puts in this array, not a parsing bug** — it means that ban slot wasn't used (a
    player didn't lock one in), confirmed against raw data (271 of 329 matches checked had at
    least one `-1`). Any aggregation over banned champion IDs must filter out non-positive values
    before counting, or it'll show up as a fake "champion -1". A champion can also legitimately be
    banned by more than one player in the same match (duplicate IDs in the array) — dedupe per
    match before counting, or a per-match-rate stat can exceed 100%.
  - **"Healing and shielding"** uses Riot's own `challenges.effectiveHealAndShielding` (rounded —
    it's a float) rather than manually summing `totalHeal`/`totalHealsOnTeammates`/
    `totalDamageShieldedOnTeammates`, which double-count differently.
  - **"CC score"** is `timeCCingOthers` (matches the in-client scoreboard); `totalTimeCCDealt` is
    also stored separately since it can exceed the former when CC effects overlap (it doesn't
    de-duplicate overlapping time).
  - **`totalTimeSpentDead` is unreliable data from Riot, not a bug in our pipeline** — verified by
    decompressing a stored `raw` payload directly and confirming the implausible value is exactly
    what Riot's API returned. 1,263 of 5,850 participant rows (21.6%), spread across 172 different
    champions (no champion-specific pattern, e.g. not a Karthus-passive artifact), have
    `totalTimeSpentDead` exceeding `timePlayedSeconds` — sometimes by 5x, with as few as 1 death.
    This looks like Riot's respawn-timer accounting breaking down under Arena's death/elimination
    model. The column was dropped as unused (`packages/db/TRIMMED_DATA.md`); if it's ever
    re-added, **any stat using it must sanity-check it against `timePlayedSeconds`** (e.g.
    discard or cap values that exceed it) — a naive average would be dominated by these outliers.
  - **`killingSprees` is always `0` in Arena, and that's Riot's data, not our pipeline** — verified
    by decompressing stored `raw` payloads directly: `0` across every participant in a 40-match /
    720-participant sample (not just one tracked summoner), while `largestKillingSpree` on those
    same participants is populated normally (non-zero, e.g. `14`). Summoner's Rift's "killing
    spree" announcer mechanic (3+ kills without dying) appears to simply not be implemented for
    Arena's backend, while `largestKillingSpree` tracks something else Riot does still compute
    (reads as max consecutive-kill streak, unrelated to the spree announcement itself). No longer
    stored (`packages/db/TRIMMED_DATA.md`); don't treat a `0` in `raw` as a parsing bug to chase.
  - **Summoner spells**: Arena offers exactly two, its own ids `2202` Flash and `2201` Flee
    (Data Dragon `summoner.json`, `SummonerCherryFlash`/`SummonerCherryHold`, tagged mode
    `CHERRY`). Verified on all 6,192 participant rows: everyone has both, but the **slot order
    varies** (2,817 Flee-in-slot-1 vs 3,375 Flash-in-slot-1), so `summonerSpell1Casts` means
    nothing without `summonerSpell1Id` — always pair a slot's casts with that slot's id
    (`apps/api/src/stats/summonerSpells.ts`). Names/icons: `apps/api/src/leagueData/summonerSpells.ts`.
  - **Damage curve** (`match_participants.frames`, one `[t, physical, magical, true]` tuple of
    cumulative damage to champions per timeline frame — the only fields kept, see
    `packages/db/TRIMMED_DATA.md`): the three splits can sum 0-2 below Riot's own total — its
    per-type rounding, the end-of-game fields show the same gap. A player's frames keep coming,
    flat, after their team is knocked out, until the match ends; a game that ended earlier than
    another carries its final value forward when curves are summed or averaged, so the summed
    curve's last point equals the season damage total exactly (verified).
  - **Pings** (14 distinct Riot counters — `allInPings`, `assistMePings`, etc.) are stored as one
    `pings` smallint array, not 14 columns — they're informational, never filtered/sorted on
    individually. Its order is `PING_TYPES` (`packages/db/src/schema.ts`): append new types, never
    reorder. It was a jsonb object until 2026-09, which repeated the 14 key names on every row
    (338 bytes vs 49; the whole table went from 48 MB to 37 MB locally).
  - **Not available from Riot's data at all**: a "sorry" emote stat (searched participant fields,
    `challenges`, and `missions` — not present, likely not tracked by the API), and a true
    full-game "damage dealt/received against a specific opponent champion" breakdown (the only
    per-opponent damage data, `victimDamageDealt`/`victimDamageReceived` on `CHAMPION_KILL` events,
    only covers the fight that produced a kill — deliberately not built as an approximation, see
    the session this was decided in). "Biggest single hit" also isn't directly available; the
    closest real field is `largestCriticalStrike` (crits only).
  - **Teammates' champions** is intentionally NOT a denormalized column — it's a trivial query
    (`match_participants` filtered by `match_id` + `team_id`), not worth duplicating.
  - `missions.playerScore0`-`playerScore11` exist but their meaning is mode-specific and
    undocumented — left out rather than guessed at. `perks` (rune page) appears unused/zeroed in
    Arena. Riot's `challenges` object is shared across every game mode and mostly full of
    Summoner's Rift-specific fields that are always 0 here (`baronTakedowns`,
    `jungleCsBefore10Minutes`, ...) — only the Arena-meaningful ones were pulled out.

## 3. Tech stack & why

| Layer | Choice | Why |
|---|---|---|
| Monorepo tooling | pnpm workspaces + Turborepo | Boring and proven; shared `packages/types` and `packages/db` need to be consumed by both apps without publishing a private npm package on every schema tweak. (Vite+ was considered and rejected for now — too young, still patching monorepo/pnpm bugs as of last month.) |
| Web app | Next.js (App Router, TS) | SSR-capable React framework; still the right shape even though SEO is no longer the primary driver (see §1) — good DX, streaming, file-based routing. |
| UI | shadcn/ui + Tailwind v4 | Matches the prototype's existing setup (`components.json`, "slate" base, CSS-variable theming) — see §5 for the actual design tokens being carried over. |
| API + ingestion | Fastify (TS) | Chosen over Express: first-class TypeScript, schema validation (zod/typebox) on routes, and a plugin model that keeps "serve read queries" and "poll Riot API / run ingestion workers" cleanly separated inside one service without fighting each other. |
| Database | Postgres | Relational fits this domain well (matches → teams → participants → augments/items joins, aggregate stat queries). |
| ORM | Drizzle | Infers TS types straight from table definitions, so `packages/db`'s schema *is* a big part of `packages/types` instead of hand-maintaining two parallel sources of truth. |
| Local/dev DB hosting | Local Postgres 18 (Windows service `postgresql-x64-18`, port 5432), database `arena` owned by role `arena` | Replaced the earlier Neon free-tier dev branch: a local database has no ~110 ms per-query round trip and no free-tier storage cap for the crawler to hit. Created with UTF8 + C collation (matching Neon). Schema comes from `pnpm --filter @arena/db migrate`. `DATABASE_URL` is just an env var in `apps/api/.env` and `packages/db/.env`, so moving to a hosted Postgres for deployment needs no code change. |
| Riot API key tier | Dev key now, production key targeted | Aiming for a public build with a production key (decided with the user 2026-09-24). Limits are read from Riot's headers, so switching keys needs no code change; a key from another Riot app does need PUUIDs remapped (§2). |

### Explicitly deferred / open decisions

- **Deployment target** (Vercel for web + a small always-on host for the API/ingestion worker
  such as Railway/Fly.io/a VPS, vs. something else) — not decided yet. Don't build in
  provider-specific assumptions (e.g. serverless-only patterns in the API) until this is settled,
  since the ingestion worker needs a long-lived process, not a request/response function.
  The API is ready for a long-lived host as is: it's deployed as an esbuild bundle (`build`,
  see "Bundled services" below) run by plain `node`. **Migrations run in the Railway pre-deploy
  command** (`apps/api/scripts/migrate.ts`, decided with the user 2026-09-24), after the build and
  before the new container starts, with no health-check window: migration 0020 rewrote the 4.3 GB
  `match_participants` (2.6M rows), and run at startup it outlasted the 60s health check, got
  killed and rolled back on every deploy. Both paths go through `applyMigrations`
  (`apps/api/src/migrations.ts`): its own connection (`MIGRATION_DATABASE_URL` or `DATABASE_URL`),
  no statement timeout, a 30s `lock_timeout` (a migration waiting for a lock queues every query on
  that table behind it, the live site's recap reads included: stop the crawler and cron before a
  migration that rewrites a table they write). The API still calls it at startup, a no-op once
  pre-deploy has run and how `pnpm dev` migrates locally (`runMigrations` in
  `packages/db/src/migrate.ts`, drizzle-orm's migrator, so drizzle-kit stays dev-only; the builds
  copy the SQL to `dist/drizzle`, where the bundled code finds it). It listens on `::` (Railway's private network can be IPv6-only), closes cleanly
  on SIGTERM, and its `/health` fails (503) when the database doesn't answer. It has no CORS: only
  the web app's server calls it, so give it no public domain (Railway: same project, web reaches it
  at `${{api.RAILWAY_PRIVATE_DOMAIN}}`). Wherever the web app lands, it needs `API_URL` (the API's address, server-side
  only), `SITE_URL` (its own public origin, the root layout's `metadataBase`: without it, link
  previews point their image at `http://localhost:3000`) and `API_PROXY_SECRET`, the same value
  as the API's (at least 32 characters; see §1). The API should connect as a role that can only
  read and write rows, with the startup migrations run through `MIGRATION_DATABASE_URL` (a role
  that owns the schema; optional, `DATABASE_URL` is used when it's unset): Railway's default
  `postgres` user is a superuser, so any SQL injection would otherwise reach the whole database
  server.
  **Bundled services** (decided with the user 2026-09-24, measured: startup ~1-1.5s -> ~0.2s,
  idle memory ~210-335 MB -> ~55 MB per service). The backend runs as esbuild bundles
  (`packages/bundle`, `@arena/bundle`: workspace packages and npm dependencies compiled into one
  minified `.mjs` with a source map; pino stays external, its transports load files by path) under
  plain `node`, not `tsx`, which compiled TypeScript at every start and kept three Node processes
  alive (pnpm, the tsx launcher, the app). Three builds: `pnpm --filter @arena/api build` (the
  server, `dist/index.mjs` + `dist/drizzle`), `pnpm --filter @arena/api build:scripts` (every
  `scripts/*.ts` no other script imports, `dist/scripts/<name>.mjs`, so a new script needs no
  listing), `pnpm --filter @arena/riot-gateway build` (`dist/index.mjs`). `typecheck` stays
  separate. Locally, `dev` and the by-hand script commands (`crawl`, `check-recaps`, ...) still run
  the source through `tsx`; `start` runs the built bundle. Railway (Railpack builds each service
  from the whole repo; no Dockerfile), per service:

  | Service | `RAILPACK_INSTALL_CMD` | Build command | Pre-deploy command | Start command |
  |---|---|---|---|---|
  | api | `pnpm install --frozen-lockfile --filter @arena/api...` | `pnpm --filter @arena/api build && pnpm --filter @arena/api build:scripts` | `node --enable-source-maps apps/api/dist/scripts/migrate.mjs` | `node --enable-source-maps apps/api/dist/index.mjs` |
  | crawler | same as api | `pnpm --filter @arena/api build:scripts` | none | `node --enable-source-maps apps/api/dist/scripts/crawl.mjs --forever` |
  | crawler-leaderboard | same as api | `pnpm --filter @arena/api build:scripts` | none | `node --enable-source-maps apps/api/dist/scripts/crawl-leaderboard.mjs` |
  | retry-skipped (cron) | same as api | `pnpm --filter @arena/api build:scripts` | none | `node --enable-source-maps apps/api/dist/scripts/retry-skipped.mjs` |
  | riot-gateway | `pnpm install --frozen-lockfile --filter @arena/riot-gateway...` | `pnpm --filter @arena/riot-gateway build` | none | `node --enable-source-maps apps/riot-gateway/dist/index.mjs` |

  The filtered install skips the web app's dependencies. Watch paths: `apps/api/**` (or
  `apps/riot-gateway/**`) plus `packages/**`, `pnpm-lock.yaml`, `package.json`,
  `pnpm-workspace.yaml`, so a web-only change doesn't redeploy the backend. Pin the Node major with
  `RAILPACK_NODE_VERSION`: `engines.node` is only `>=22`.
  The Riot gateway is a separate long-lived service (Railway: `riot-gateway`, the whole repo,
  built and started as in the table above, no public domain) with `RIOT_API_KEY`,
  `PORT=3002` and `RIOT_GATEWAY_SECRET` (32+ characters); the API, crawler and cron services get
  the same `RIOT_GATEWAY_SECRET` and `RIOT_GATEWAY_URL=http://${{riot-gateway.RAILWAY_PRIVATE_DOMAIN}}:3002`
  (private network: its traffic isn't billed, a public domain would bill every timeline as egress).
- **Auth** — deferred per §1, revisit if personalization is needed.
- **CI** — the old prototype has GitHub Actions scaffolding for Copilot; a fresh CI setup
  (typecheck/lint/test on PR via Turborepo) should be added once the app has enough shape to be
  worth gating, not before.

## 4. Monorepo layout

```
apps/
  web/        → Next.js frontend (App Router). Profile pages, stats pages, leaderboard.
  api/        → Fastify service. REST API for the web app's data needs, plus Riot API ingestion
                workers (the refresh queue and the crawler, fetching/parsing match + timeline data
                through the Riot gateway, writing into Postgres via packages/db).
  riot-gateway/ → Fastify service, the only process that calls Riot: key, rate limits, priority
                buckets. Knows nothing about the database; passes Riot's answers on verbatim.
packages/
  eslint-config/ → The one ESLint setup (`@arena/eslint-config`): `base` (TypeScript on Node) and
                `next` (apps/web). Every package's `eslint.config.mjs` imports a profile.
  riot/       → Shared by the gateway and its callers: routing, queue ids, priority buckets, the
                gateway's wire protocol and its client (`RiotGateway` / `RiotClient`).
  types/      → Shared TS types not already covered by packages/db's inferred types (e.g. Riot
                API response shapes, ingestion pipeline DTOs).
  db/         → Drizzle schema + migrations + a small query layer, shared by apps/api and any
                one-off scripts. This is the schema described in §2 — team size is per-row data,
                never a hardcoded constant. Also owns `parseMatch()` (Riot DTOs -> DB rows) —
                it lives here rather than in apps/api specifically so one-off backfill scripts
                (packages/db/scripts/) can re-derive match_participants from the already-stored,
                already-compressed `raw`/`timeline` blobs without re-fetching from Riot whenever
                parsing logic changes.
  ui/         → Shared shadcn/ui components + the design tokens from §5, if/when apps/web grows
                enough surface area to warrant extracting components (don't create this
                prematurely — start with everything in apps/web/components and extract only when
                there's a second consumer).
```

**Riot gateway** (`apps/riot-gateway`, see its README, and §1): every Riot call goes through it.
Callers use `RiotGateway` from `packages/riot` (`@arena/riot`), whose `client(priority)` exposes
`riot.account` / `riot.summoner` / `riot.match`. The gateway rate-limits **per routing value**
(each of `europe`, `euw1`, ... has its own app budget and per-endpoint method budgets, as Riot
enforces them), takes limits and counts from Riot's response headers (so a production key needs
no change), queues per routing value by priority bucket, and logs one line per request with its
bucket (`RIOT_LOG_LEVEL`). Run exactly one gateway: its limiter state is in memory. `packages/riot`
also holds routing (platforms, clusters) and queue ids, shared by the gateway, the API and the
scripts. Queue ids are a parameter (`Queue.ARENA`, ...), never a constant in a call. OC1, SG2, TW2 and VN2 Match-V5 route to `sea`, ME1 to `europe`;
Account-V1 has no `sea` cluster, so SEA platforms use `asia` there (verified on all four with
our key, 2026-09).

**Patched nivo calendar, vendored as source** (`apps/web/src/vendor/nivo-calendar/`, see its
README): upstream `@nivo/calendar`'s `TimeRange` chart (the activity calendar,
`apps/web/src/modules/TimePlayed/Calendar.tsx`) ignores its `align` prop, so the day grid rendered
flush top-left with uncentered dead space whenever `square` cells were bound by one axis (this
project's case: the date range varies per summoner). The copy's `computeOrigin` step in
`compute/timeRange.ts` fixes that, plus an off-by-one in `computeMonthLegends` that left a blank
column between adjacent month labels. Only the files `TimeRange` needs are copied, as plain source
imported from `@/vendor/nivo-calendar`; its `@nivo/core`/`theming`/`legends`/`text`/`tooltip`
dependencies are direct dependencies of `apps/web`, pinned to the same version as the other
`@nivo/*` charts (keep them in step). This replaced a fork (github.com/Sygnano/nivo) consumed as
a packed `file:*.tgz`, which a fresh clone couldn't install; its local checkout (`vendor/nivo`)
was deleted 2026-09-24, and the copy holds the same fix plus the month-legend one. Still needed:
upstream's latest `@nivo/calendar` is still 0.99.0 (May 2025), without either fix. The folder is
excluded from eslint as third-party code. To change the chart, edit the copy directly; no build
step.

## 5. Design system (carried over from `../project-arena`)

The prototype already has a worked-out "Hextech" visual language. Reuse it as-is rather than
redesigning:

- **Fonts**: Beaufort for LoL (display/headings) and Spiegel (body), copied from
  `../project-arena/public/fonts/` (`beaufort/`, `spiegel/`, `fonts.css`). Both are `@font-face`
  OTF files — copy the files and `fonts.css` into `apps/web/public/fonts/` verbatim, and expose
  them as `--font-display` (Beaufort) / `--font-body` (Spiegel) Tailwind theme variables like the
  original `src/index.css` does.
- **Color system**: Tailwind v4 `@theme` tokens defined in `../project-arena/src/index.css` —
  Hextech black/navy backgrounds, blue/cyan "hextech magic" accents, gold "hextech metal" accents,
  plus semantic game colors (damage/heal/mana/rarity/rank tiers). Port this block forward into
  `apps/web`'s global CSS rather than re-deriving a palette.
- **shadcn config**: base style `default`, base color `slate`, CSS variables on, matching
  `../project-arena/components.json` — re-init shadcn in `apps/web` with the same settings so
  component output matches what was already tuned.

## 6. Working conventions for future sessions

- Keep `packages/db`'s Drizzle schema as the single source of truth for match/team/participant
  shapes; don't hand-write parallel interfaces in `packages/types` for things Drizzle already
  infers.
- **Store only what the page reads.** The crawler multiplies every per-row byte by thousands of
  matches, so a column that nothing renders is dropped, not kept "just in case". `matches.raw`
  and `matches.timeline` are the deliberate exception: they're the archive every dropped field
  can be re-derived from. `packages/db/TRIMMED_DATA.md` lists what was dropped, why, and how to
  bring it back. Check it before adding a column, and add to it when you drop one.
- Only `packages/db` should depend on `drizzle-orm` directly. It re-exports the query helpers
  consumers need (`eq`, `and`, `or`, `desc`, `asc`, `sql`) from its own `src/index.ts` — import
  those from `@arena/db`, not by adding `drizzle-orm` as a direct dependency of `apps/api` (or
  anywhere else). Giving a second package its own `drizzle-orm` dependency hits a real pnpm
  peer-dependency duplication bug in this workspace (drizzle-orm resolves differently depending on
  whether `postgres` is a sibling dependency, and pnpm mis-links the un-peered copy), which shows
  up as `tsc` failing with "Cannot find module 'drizzle-orm'" even though it's "installed."
- **Lint per package, format from the root** (Turborepo's recommended layout, decided with the
  user 2026-09-24). ESLint 10: every package has a short `eslint.config.mjs` importing a profile
  from `packages/eslint-config` plus `"lint": "eslint ."`, so Turborepo caches lint per package;
  turbo.json runs `lint` through a `transit` task (parallel, yet re-run when the config package
  changes). Rules live in the config package, never in a package's own file beyond ignores and
  documented exceptions. apps/web keeps Next's own presets (`eslint-config-next`), whose react,
  jsx-a11y and import plugins don't support ESLint 10 yet: `next.js` wraps them in
  `@eslint/compat`'s `fixupConfigRules` and pnpm-workspace.yaml allows their peer range; drop
  both once vercel/next.js#91710 ships. `turbo/no-undeclared-env-vars` warns about env vars
  turbo.json doesn't declare: declare a task's inputs in the package's own `turbo.json`
  (apps/web's `build`). Prettier is one config at the root (`.prettierrc.json`, 120-character
  lines, `.prettierignore`), run through Turborepo as root tasks: `pnpm format:check` is `turbo
  run //#prettier:check` (cached; a root task hashes every file in the repo, so any change
  re-runs it) and `pnpm format` is `turbo run //#prettier:write` (never cached: it rewrites
  source). The Prettier commands themselves are the root `prettier:check` / `prettier:write`
  scripts: a root task runs the root script of its own name, so `format` pointing at itself
  would loop. ESLint never formats (`eslint-config-prettier` ends both profiles).
- Don't hardcode Arena team size (see §2) — if you catch yourself writing `teammates: [a, b]` as a
  fixed tuple or a stat query assuming exactly 2 or exactly 3 per team, stop and make it
  data-driven instead.
- No auth, no user accounts, no session infrastructure unless this file has been updated to say
  otherwise (see §1, §3).
- Prefer extending `apps/web/components` directly over creating `packages/ui` until there's an
  actual second consumer of those components.
- **`apps/web/src` component layering** (three tiers, each building on the last):
  `components/ui/` = raw shadcn primitives, generated by the shadcn CLI, not hand-edited beyond
  that. `components/` = small generic reusable pieces with no domain logic (`AnimatedNumber`,
  `CategorySection`). `modules/` = richer, category-specific pieces (a damage breakdown chart, a
  kill timeline, anything with its own interaction state) that compose several `ui/` primitives
  plus domain knowledge — this is where the summoner page's per-category content (Damage, Kills,
  Augments, Economy, Utility) belongs, matching the `modules/` convention `../project-arena` already
  used. Start flat in `modules/`; split into `modules/<category>/` only once a category actually
  accumulates multiple files. Since summoner page.tsx is a Server Component (it fetches the stats),
  any module using hooks/hover-state/a chart library needs its own `"use client"` boundary — the
  page fetches and passes data down as props, modules don't fetch their own.
- **`apps/web/src/hooks/`** — reusable non-visual logic (e.g. `use-count-up.ts`'s `useCountUp`).
  The shadcn CLI already set up the `@/hooks` import alias at init time even though nothing used it
  yet; this is that alias's home. kebab-case filename (`use-count-up.ts`), camelCase export
  (`useCountUp`), matching the rest of `apps/web/src`'s file-naming convention.
- **`components/animated-number.tsx`** (`AnimatedNumber`, `"use client"`) is the generic count-up
  number, animated via `requestAnimationFrame` (`hooks/use-count-up.ts`) rather than CSS
  `@property`/`counter()` (that CSS-only technique only tweens integers, which can't produce formatted
  output like `"18h 42m"` or a percentage). It shows the final value at once under
  `prefers-reduced-motion`. Its `format` prop is a plain function — **any Server Component module
  that constructs one (e.g. a closure like `formatHoursMinutes`) and passes it in must be
  `"use client"` itself**. A Server Component can't pass a function prop to a Client Component at all
  (React can't serialize it across the RSC boundary) — a hard runtime error ("Functions cannot be
  passed directly to Client Components"), hit and fixed in `modules/TimePlayed`.
- **Oversized `<img>` needs `max-w-none`.** Tailwind's preflight sets `max-width: 100%` on every
  `<img>`, so art deliberately sized past its box (e.g. a 141% counter-rotated icon filling a
  diamond, see `components/item-medallion.tsx`) gets its width silently clamped while an explicit
  height isn't — the art ends up squashed and offset to one side.
- **The summoner pages' top bar (`components/top-bar.tsx`, mounted by `app/summoner/layout.tsx`)
  overlays the page rather than taking height**, because deck slides fill exactly one viewport. It
  hides while scrolling down and comes back on scroll up, near the top edge, or while it holds
  focus. Don't reserve space for it in a slide; keep a slide's key content out of its top ~64px
  only if it must never be covered. Riot ID input rules live in `lib/riot-id.ts`
  (`gameNameError`/`tagLineError`, mirrored by the API's `routes/summoners/riotIdParams.ts`), and `parseRiotIdSlug`
  decodes the slug because Next passes dynamic params still percent-encoded.
- **Summoner page structure lives in one slide registry** — the ordered `slides` array in
  `app/summoner/[platform]/[riotId]/stats-view.tsx` (id, short label, chapter, render). Each section's
  DOM id (`#augments` deep links), the previous section's "next" cue label and the chapter rail all
  derive from it through `lib/slides.tsx`'s `SlideProvider`/`useSlide`. Don't pass hand-typed "next
  section" labels to modules (they drifted from the real titles before this existed); to add, remove
  or reorder a section, edit the registry.
- **Two layout modes, `deck` and `flow`** (custom variants in `globals.css`). `deck` (≥1280px wide
  AND ≥860px tall) is the designed full-viewport, scroll-snapped slide; everything smaller gets
  `flow`, where sections grow to their content and the page scrolls normally. A section must never
  rely on `h-screen overflow-hidden` to fit — that silently clipped ~200px of every sidebar slide on
  a 1366×768 laptop. Table-like panels with fixed columns pass `HextechPanel`'s `contentMinWidth`
  so narrow screens scroll the panel content horizontally as one unit.
- **Never render `championName` as text.** It is Riot's internal key (`MonkeyKing`, `KSante`), right
  for asset URLs only. Render `useChampionName()(championName)` (`lib/champion-names.tsx`), backed by
  the stats response's `championDisplayNames` map (CommunityDragon `name`, keyed by lowercased key).
- **Every rate follows `lib/sample.ts`**: rate sorts go through `sortByRate` (rows under `MIN_SAMPLE`
  games rank after the rest, ordered by the same rate, and render dimmed). Every list that demotes them shows `components/low-sample-switch.tsx` while a rate sort is active (Team Synergy's Teammate Picks, at the user's request, doesn't dim at all on its MOST GAMES count sort), which passes `lowSample: "mixed"` to rank everyone together (still dimmed) — except the Collection dossier and Bans (Bans keeps low-sample rows ranked last and dimmed, with no switch), and rate scales/maxima are computed from rows that
  meet the sample unless the switch mixes them in (then every row scales, or all mixed-in outliers
  clamp to one equal max bar) — a single-game outlier otherwise sets the ceiling and flattens every real bar
  (hit and fixed on KDA per-game). Rate differences are a plain subtraction of two rates, formatted by
  `formatSignedPoints` as "+4.2%" (the user asked for "%" over "pp", which few readers know) — never
  a relative change (55% vs 50% is +5%, not +10%). "Win" on this page means a top 3 finish — say WIN / WINRATE / WIN % for it (never "TOP 3"),
  and keep 1ST / 1ST RATE for first place.
- **Augment and item rates compare with the average pick, not the per-game rate.** Longer games hold
  more augments and build more items, and longer games finish higher (verified: 71% top 3 with 6
  augments vs 16% with 3; 16.8 purchased items in 1st-place games vs 4.9 in 6th). Use
  `pooledRate` (`lib/sample.ts`) for any "vs average" on a per-augment/per-item list; the plain
  per-game rate is only a fair baseline for things that happen once per game (champions, teammates,
  boots outcome, special items).
- **Short deck viewports (860–999 px tall) shrink `.dial-fit` and `.sidebar-stat-row`** (globals.css)
  so a sidebar with a description and five rows still clears the next-section cue. Check new sidebar
  content at 1280×860, not only at 1920×1080. Grids that should fill their panel measure it
  (`hooks/use-fit-columns.ts`) instead of hard-coding a column count tuned on one screen.
  The three Hall of Fame grids (Arena, Augment and Prismatic God) are honeycombs built from
  `components/hex-comb.tsx` (`HexComb`), which solves its own column count with hexagon row
  geometry — a new catalog grid of that kind should use it rather than a square grid.
- **Every section animates in when scrolled to.** `components/reveal.tsx`'s `Reveal` (a fade + lift
  on one wrapper, driven by `hooks/use-section-in-view.ts`) is applied inside `CategorySection` and
  `HeroSection`, so a new section gets it for free — `CategorySection` observes the whole `<section>`
  and passes that one `inView` to each of its `Reveal`s (a block observed alone only counts as in
  view in the container's middle 60%, so a full-width slide's title row, sitting above that band,
  once stayed invisible on 10 slides) — and it replays on re-entry, since a deck slide
  is something you scroll away from and back to. Richer per-section motion (HourStrip's growing
  bars, the activity calendar's staggered cells) runs inside a block `Reveal` has already faded up.
  A tab that swaps what a chart shows should replay that chart's entrance rather than recoloring
  in place.
- **Reduced motion:** `Providers` wraps the app in `MotionConfig reducedMotion="user"` and
  `useCountUp` jumps to its final value; new JS animation must respect `prefers-reduced-motion` too.
- **Production build beside a running dev server:** `NEXT_DIST_DIR=.next-build pnpm build` (the dev
  server owns `.next`). `next build` rewrites `tsconfig.json`'s `include` for that directory; revert it.
- **Chart hover cards follow the pointer and share one look.** Build them from
  `components/hover-stat-card.tsx` (`HoverStatCard` + sections/rows/champions); position a
  non-nivo card with `components/cursor-tooltip.tsx` and `hooks/use-chart-hover.ts` (handles touch:
  a tap opens, the next outside tap or a scroll closes). `HextechBarChart` takes `onHover` +
  `highlightedId`; nivo charts put the same card in their own `tooltip`. Add a card where it tells
  more than what's already printed (icon-only columns, stacked counts, per-pair rates), and never
  repeat the section's own pinned sidebar/detail band — complement it instead (Picks' sidebar has
  results, so its card shows the combat line; KDA's band has combat, so its card shows results); tables
  that already print names and numbers, and the collection slides, get none. To send someone to a
  champion's full stats, use `DossierLink`/`openChampionDossier` (`lib/champion-dossier.tsx`) —
  Collection listens for it.
- **Bar charts use linear scales from zero** (`lib/bar-scale.ts`). A log or power scale was tried and
  removed: with no axes on these charts it silently distorted every comparison.
- **Section background art is served from `public/images/backgrounds/optimized/`**, generated by
  `node scripts/optimize-backgrounds.mjs` from the full-size originals next to it (~13.6 MB → ~1.7 MB;
  the photos are displayed heavily blurred). After adding art, rerun the script and point
  `lib/section-backgrounds.ts` at the optimized file. Backgrounds attach lazily near the viewport
  (`hooks/use-near-viewport.ts`).
- **The recap is built in memory from three queries** (`apps/api/src/summoners/stats/`):
  `loadStatsData.ts` loads the summoner's games, everyone in them, and their duels; each section of
  the response is a function over those rows in `sections/` (placements, activity, team synergy,
  people, bans, augments, items, champions, ...), assembled by `buildSummonerStats.ts`. This
  replaced ~41 aggregate queries, one of them a `DISTINCT` over all of `match_participants`
  (measured: 910 games 392 → ~140 ms, 1 game 197 → ~1 ms). A new stat should be a function over
  the loaded rows, not a new query; `aggregate.ts` has SQL-equivalent helpers (`sum` counts null as
  0, `avg`/`max` skip nulls). Ties are broken by id so the output is stable. Placement-0 games
  (broken lobbies, all players on one team) are left out of the recap.
- **The stats cache** (`apps/api/src/summoners/statsCache.ts`, decided with the user) keeps
  recaps as their JSON strings, in two kinds. **Fresh**: until 15 minutes after that summoner's
  `lastRefreshedAt`, the window in which it's likely to be reopened, after which a refresh would
  replace it. **Recent**: any other recap someone opened, least recently used first within
  `STATS_CACHE_RECENT_MB` (default 256), and for an hour at most after its last view (added after
  a 2026-09 security audit: rebuilding an older recap on every view let a loop keep the API busy).
  Entries are invalidated by the summoner's game count + latest game time (a teammate's refresh
  can add one of their games), swept every minute, and capped at `STATS_CACHE_MAX_MB` (default
  1024; recent entries are evicted first). Sizes count two bytes a character when the JSON holds
  any non-Latin-1 character, as V8 stores it. A code deploy restarts the process, which clears it.
- **Recaps carry ids; names and icons come from a catalog** (decided with the user). The API
  sends `SummonerStatsPayload` (`@arena/types` `catalog.ts`): items and augments as ids only, no
  champion list or display names. `GET /catalog` (`apps/api/src/leagueData/gameCatalog.ts`) serves
  the `GameCatalog` once: every champion (key + display name), every augment (name, icon, rarity)
  and the items a recap can show. The web server caches it for an hour (`getGameCatalog` in
  `lib/api.ts`), the summoner layout provides it (`lib/game-catalog.tsx`), and `stats-view.tsx`
  resolves the payload into `SummonerStatsResponse` once (`lib/resolve-stats.ts`), so modules
  still read `itemName`/`iconUrl`/`augmentName`/`rarity`. A new item or augment field goes in the
  catalog and the resolver, not in the payload. Every page (the splash too) prefetches every icon
  in the catalog once the page has loaded (`components/asset-prefetch.tsx`, lowest-priority
  `<link rel="prefetch">` from the URL list at `app/api/catalog-icons`), so recap slides never wait on
  them; splash/loading art is deliberately not prefetched (hundreds of KB each). This cut the 910-game recap from 2,035 KB to
  1,364 KB (the catalog is 14 KB gzipped). Per-row `championName` keys stay in the payload
  (52 KB on that recap; replacing them means rewiring ~20 modules).
- **PUUIDs never leave the server.** Riot's policies don't allow publishing them, and a recap
  listing every co-player's PUUID (645 on one recap, embedded in the page HTML) made the database
  easy to crawl. Teammate and opponent rows carry `id`, their position in the server's list, as
  the page's selection key. No response sends raw error messages either (`RefreshProgress` has
  no error text; the API's error handler answers a bare 500): they can name internal hosts.
- **Security headers live in `apps/web/next.config.ts`**: nosniff, no framing, a referrer policy,
  and in production only a CSP and HSTS. The CSP allows assets from this origin and
  `ASSET_HOSTS` (Data Dragon, CommunityDragon) only: loading images or anything else from a new
  host means adding it there, or it breaks in production while working in `next dev`. Checked
  with headless Chrome on a production build: no violations on the splash, a recap or /about.
- **URL slugs are validated before use** (`parseRiotIdSlug` applies the Riot ID rules: game names
  are letters, digits, combining marks and spaces only, as every one of 40,835 stored names is;
  both validators refuse anything else, including control characters, since a NUL made Postgres
  fail the query): the page, its link preview and the refresh proxy echo or forward what it
  returns, so an invalid one is a 404, never markup or a `..` path segment in a request to the
  API. Link previews name only stored summoners: a Riot ID that isn't stored gets a generic
  `og:title` and card, or any URL could put its own text on a card under this site's name. Rendered
  cards are kept in the web server's memory (100, least recently used first).
- **Summoners are looked up by `riot_id_key`** (`riotIdKey()` in `packages/db/src/riotId.ts`:
  trimmed, Unicode lowercase, NFC, "name#tag", indexed with the region). Not `lower()` in SQL: this
  database's C collation only lowercases ASCII, and a quarter of stored names aren't ASCII. Every
  writer of `summoners` goes through `riotIdColumns()`, which also trims the names (match data can
  carry a trailing space). Rows from before the key column were filled once; the startup backfill
  that did it (`backfillRiotIdKeys`) was removed 2026-09-24, when no row lacked a key and its scan
  of ~1M summoners timed out at crawler startup. A successful lookup also corrects the stored platform, so a player who
  moved server doesn't keep the old one's lane and match cluster.
- **`apps/web/src/lib/api.ts` is server-only** (`import "server-only"`): it holds the API's
  address and secret. Helpers the browser needs (`summonerStatsQueryKey`, `hasRecap`,
  `formatRetryAfter`) live in `lib/summoner-query.ts`. The recap query is disabled in the
  browser: its data only comes from the page's server prefetch or the refresh stream.
- This file should be updated whenever a decision in §3's "explicitly deferred" list gets made, or
  when scope (§1) changes (e.g. friend-group → public tool would flip several decisions above).
