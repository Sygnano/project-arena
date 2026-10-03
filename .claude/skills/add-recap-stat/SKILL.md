---
name: add-recap-stat
description: Add or change a stat on the summoner recap end to end - API section function, payload type, catalog/resolver, full-stats slide, story slide, fit check. Use when asked to add a new stat, slide, section or chart to the summoner page, or to show new data from the matches on it.
---

# Add a recap stat

A recap stat crosses four layers. Do them in this order; each step names the rule file that
governs it (read it if it isn't already loaded).

## 1. Check the data exists

- `.claude/rules/arena-data.md` lists what Riot sends, what's wrong in it, and what's absent.
  Acquisitions come from the timeline, end-state from `items`; apply `ITEM_UNDO`.
- Check the claim on real rows before building on it:
  `pnpm --filter @arena/db query "<sql>"`, or `pnpm --filter @arena/db match-json <matchId>` for
  fields we don't store.
- A field we don't store yet: add the column (`packages/db/CLAUDE.md`, "Changing the schema"),
  but only if the page will read it.

## 2. API: a function over the loaded rows

- Add or extend a section in `apps/api/src/summoners/stats/sections/`, a pure function over what
  `loadStatsData.ts` already loads. Never a new query. Use `aggregate.ts` helpers, break ties by
  id, skip placement-0 games, never assume a team size.
- Wire it into `buildSummonerStats.ts`.
- Add its type to `SummonerStatsPayload` in `packages/types/src/stats.ts`. Items, augments and
  champions go in as ids only. A new display field (name, icon, rarity) goes in the game catalog
  (`apps/api/src/leagueData/gameCatalog.ts`, `packages/types/src/catalog.ts`) and in
  `apps/web/src/features/recap/utils/resolve-stats.ts`.
- Add a test next to the section when its logic has a rule in it (`*.test.ts`, Vitest).

## 3. Full stats slide (`/advanced`)

- A slide in `apps/web/src/features/recap/components/slides/<slide>` (kebab-case; a single file
  until it needs a second one).
- Register it in the `slides` array of `components/summoner-stats-view/index.tsx` (id, label,
  chapter, render). The id is its `#anchor`; the cue and chapter rail follow automatically.
- Wrap it in `CategorySection`/`HeroSection` so it gets the scroll entrance; a tab that changes a
  chart replays the chart's entrance.
- Background art: `utils/section-backgrounds.ts` (optimized files only).
- Apply `apps/web/CLAUDE.md`: rates through `sample.ts` (`sortByRate`, `low-sample-switch`,
  `pooledRate` for per-augment and per-item "vs average"), tier colors (win gold, 1st
  prismatic, games silver), `useChampionName` for names, one toolbar row, and hover cards that
  complement the pinned panel.

## 4. Story slide, only if it tells something at a glance

- The story is the default view and a season wrap: one finding, text first, one or two visuals,
  no tabs, sorting or hover cards. Not every stat belongs here.
- A slide in `components/story-slides/<slide>` inside `StoryFrame`, content staggered with
  `Appear`, built from `StoryStat`/`StoryFact`/`StoryPortrait`/`StoryComb`.
- Register it in the `slides` array of `components/summoner-story/index.tsx` with `label`,
  `durationMs` (11-12 s), a `transition`, a `background`, and a condition that leaves it out when
  there's no data.

## 5. Check it

- `pnpm typecheck && pnpm lint && pnpm test` (the Stop hook also runs them).
- With `pnpm dev` running, screenshot both views at the four required viewports:
  - Full stats: `node apps/web/scripts/screenshot.mjs summoner/<platform>/<Name-TAG>/advanced#<id>`
  - Story: `node apps/web/scripts/screenshot.mjs summoner/<platform>/<Name-TAG> --keys ArrowDown,ArrowRight,...`
    (one ArrowRight per slide before yours)
  - In Git Bash, leave out the leading slash. Find a summoner with a recap with
    `pnpm --filter @arena/db query "select region, riot_id_game_name, riot_id_tagline from summoners where last_refreshed_at is not null limit 5"`
    (URL-encode non-ASCII names).
- Read the PNGs: nothing clipped, no inner scrollbar, nothing under the top bar's ~64 px, and
  the script reports no sideways scroll or console errors.
