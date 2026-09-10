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

- **Audience: friend group.** A small, fixed-ish list of tracked Riot IDs (starting with
  `Sygnano#EUW`, EUW1 region), not arbitrary public lookup. Adding a new tracked summoner is an
  admin/ingestion action, not a self-serve public flow.
- **No auth in v1.** All pages are public read-only within whatever the app's own deployment
  visibility is (i.e. no login, no accounts, no sessions). Do not add auth infrastructure
  speculatively — revisit only if we need personalization (favorites, alerts) later.
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
  Static reference data (champion/item/augment names & icons) comes from Data Dragon / Riot's
  Arena augment data — cache it locally, don't re-fetch per request.
  - **Item data (official Data Dragon)**: version list at
    `https://ddragon.leagueoflegends.com/api/versions.json` (first entry = latest), item data at
    `https://ddragon.leagueoflegends.com/cdn/{version}/data/en_US/item.json`. This is what
    `apps/web/src/lib/riot.ts`'s `profileIconUrl` and the anvil-ID research this session used.
  - **Champion ID -> name, server-side**: `apps/api/src/championData.ts`'s `getChampionNamesById()`
    fetches `https://ddragon.leagueoflegends.com/cdn/{version}/data/en_US/champion.json` once and
    caches the `key` (numeric ID) -> `id` (Riot-style PascalCase name, e.g. `62` -> `"MonkeyKing"`
    — the same field `championIconUrl()` in `apps/web` expects, not the display `name` like
    "Wukong") map in memory for the process's lifetime. Added because bans
    (`matches.bannedChampionIds`) only give champion IDs, and the obvious shortcut — looking names
    up from `match_participants`, which already has `(championId, championName)` for everyone's
    picks — systematically fails for the *most* interesting rows: a champion banned in 100% of
    tracked matches can, by definition, never appear in `match_participants` (nobody ever got the
    chance to pick it). Use `match_participants` first since it needs no network call, and fall
    back to this only for IDs it doesn't cover.
  - **Augment data is NOT in Data Dragon at all** — Riot doesn't publish it there. Use Community
    Dragon instead: `https://raw.communitydragon.org/latest/cdragon/arena/en_us.json` (225
    augments, each with a numeric `id`, `apiName`, `name`, `rarity`, description, icon path).
    Verified the numeric `id` matches exactly what `playerAugment1`-`playerAugment6` return (e.g.
    `id: 19` → `"Dashing"`, confirmed against a real match). `latest` tracks the current patch
    automatically; pin to a specific patch number the same way Data Dragon supports. Icon URLs are
    built as `https://raw.communitydragon.org/latest/game/{iconLarge or iconSmall, lowercased}` —
    verified a real one resolves with a 200. Cached server-side the same way as champion names, in
    `apps/api/src/augmentData.ts`'s `getAugments()`.
    `rarity` is mostly the expected three in-game tiers (`0` = Silver, 68 augments; `1` = Gold, 75;
    `2` = Prismatic, 57) but there's a 4th value, `4` (25 augments, no `3` at all) covering entries
    like "Gain an Augment slot", "Replace Augment", and "Gain a Prismatic Stat Anvil" — these read
    as internal/meta augments outside the normal in-game offer pool, not yet otherwise identified;
    don't assume `rarity` only ever takes the three "obvious" values.
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
    catalog was resolved via the user's own domain knowledge and cross-verified against real data:
    every item with a 6-digit id in `443000`-`447999` (49 items total, e.g. `447106` "Dragonheart",
    `443090` "Reaper's Toll", `446632` "Divine Sunderer") is a Prismatic Item — confirmed each
    exists in Data Dragon's `item.json` with a real name, and that no id sharing that pattern falls
    outside the range. This full list is hardcoded as `PRISMATIC_ITEM_IDS` in
    `apps/api/src/itemData.ts`; extend it only after similarly verifying a new id against real
    data, not by guessing from adjacency.
- The Match-V5 **timeline** endpoint (`/lol/match/v5/matches/{matchId}/timeline`) is fetched
  alongside match details for every ingested match and stored in `matches.timeline` (nullable —
  matches ingested before this was added won't have one). Confirmed on real Arena data: it returns
  frame-by-frame events (`ITEM_PURCHASED`, `ITEM_SOLD`, `ITEM_DESTROYED`, `WARD_PLACED`,
  `WARD_KILL`, `CHAMPION_KILL`, `CHAMPION_SPECIAL_KILL`, `LEVEL_UP`, `SKILL_LEVEL_UP`, `GAME_END`),
  keyed by `participantId` — join back to `match_participants` via `timeline.info.participants`
  (`participantId` → `puuid`), not by array position. It is not parsed into structured
  event/purchase-timing tables yet — that's future work once a specific stat needs it (e.g. "time
  to first legendary item").
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
    model. The raw value is still stored as-is (this project's consistent approach to Riot's own
    data quirks — store the truth Riot gives, document the caveat, let consumers guard against it).
    **Any future stat/leaderboard using this field must sanity-check it against
    `timePlayedSeconds`** (e.g. discard or cap values that exceed it) rather than trusting it
    directly — a naive average would be dominated by these outliers.
  - **Pings** (14 distinct Riot counters — `allInPings`, `assistMePings`, etc.) are stored as one
    `pings` jsonb object, not 14 columns — they're informational, never filtered/sorted on
    individually.
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
| Local/dev DB hosting | Cloud dev DB (Neon or Supabase Postgres, free tier) | No Docker installed on the dev machine; a cloud dev branch avoids a local Postgres install and matches how a small friend-group deploy would likely run anyway. `DATABASE_URL` is just an env var — swapping to self-hosted Postgres later is a non-event. |
| Riot API key tier | Personal/dev key for v1 | Friend-group scale fits comfortably inside dev-key rate limits (20 req/1s, 100 req/2min). Revisit only if scope moves toward "public tool." |

### Explicitly deferred / open decisions

- **Deployment target** (Vercel for web + a small always-on host for the API/ingestion worker
  such as Railway/Fly.io/a VPS, vs. something else) — not decided yet. Don't build in
  provider-specific assumptions (e.g. serverless-only patterns in the API) until this is settled,
  since the ingestion worker needs a long-lived process, not a request/response function.
- **Auth** — deferred per §1, revisit if personalization is needed.
- **CI** — the old prototype has GitHub Actions scaffolding for Copilot; a fresh CI setup
  (typecheck/lint/test on PR via Turborepo) should be added once the app has enough shape to be
  worth gating, not before.

## 4. Monorepo layout

```
apps/
  web/        → Next.js frontend (App Router). Profile pages, stats pages, leaderboard.
  api/        → Fastify service. REST API for the web app's data needs, plus Riot API ingestion
                workers (polling tracked summoners, fetching/parsing match + timeline data,
                writing into Postgres via packages/db).
packages/
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
- Only `packages/db` should depend on `drizzle-orm` directly. It re-exports the query helpers
  consumers need (`eq`, `and`, `or`, `desc`, `asc`, `sql`) from its own `src/index.ts` — import
  those from `@arena/db`, not by adding `drizzle-orm` as a direct dependency of `apps/api` (or
  anywhere else). Giving a second package its own `drizzle-orm` dependency hits a real pnpm
  peer-dependency duplication bug in this workspace (drizzle-orm resolves differently depending on
  whether `postgres` is a sibling dependency, and pnpm mis-links the un-peered copy), which shows
  up as `tsc` failing with "Cannot find module 'drizzle-orm'" even though it's "installed."
- Don't hardcode Arena team size (see §2) — if you catch yourself writing `teammates: [a, b]` as a
  fixed tuple or a stat query assuming exactly 2 or exactly 3 per team, stop and make it
  data-driven instead.
- No auth, no user accounts, no session infrastructure unless this file has been updated to say
  otherwise (see §1, §3).
- Prefer extending `apps/web/components` directly over creating `packages/ui` until there's an
  actual second consumer of those components.
- **`apps/web/src` component layering** (three tiers, each building on the last):
  `components/ui/` = raw shadcn primitives, generated by the shadcn CLI, not hand-edited beyond
  that. `components/` = small generic reusable pieces with no domain logic (`StatCard`,
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
- **`components/animated-stat.tsx`** (`AnimatedStat`, `"use client"`) is the generic count-up
  number display — title + big primary number/label + smaller secondary number/label, animated via
  `requestAnimationFrame` rather than CSS `@property`/`counter()` (that CSS-only technique only
  tweens integers, which can't produce formatted output like `"18h 42m"` or a percentage). Its
  `formatPrimary`/`formatSecondary` props are plain functions — **any Server Component module that
  constructs one of these (e.g. a closure like `formatHoursMinutes`) and passes it in must be
  `"use client"` itself**, not just `AnimatedStat`. A Server Component can't pass a function prop
  to a Client Component at all (React can't serialize it across the RSC boundary) — this isn't
  optional/stylistic, it's a hard runtime error ("Functions cannot be passed directly to Client
  Components"), hit and fixed in `modules/TimePlayed.tsx`. Modules that only pass plain
  numbers/strings into `AnimatedStat` can stay Server Components.
- This file should be updated whenever a decision in §3's "explicitly deferred" list gets made, or
  when scope (§1) changes (e.g. friend-group → public tool would flip several decisions above).
