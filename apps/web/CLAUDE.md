@AGENTS.md

# apps/web

## What the summoner page is

A season wrap in the style of Spotify Wrapped: the viewer watches their season unfold slide by
slide. It's not a dashboard. Judge a slide by its story (a clear payoff, a good reveal, variety
of rhythm, something worth sharing), not by analytical density. Big single numbers and trivia
(pings, fist bumps, ability casts) belong. Totals are the default; per-game views are secondary,
never the default. Deeper analysis is welcome only as a told finding (a sentence, a superlative,
a comparison), not a tool to operate. No generated per-slide "punchline" captions (tried and
removed).

## Architecture: Bulletproof React, enforced by lint

The `apps/web/src` overrides in the root `biome.jsonc`, plus `src/architecture.test.ts` for folder
names and for a new feature's override, which Biome can't generate. Code flows shared → features → app: shared
code never imports features or `app/`, a feature never imports another feature or `app/`, no
`../` imports, no cycles. Every `.ts`/`.tsx` file and folder is kebab-case; `src/app` folders
follow Next's route rules (`[riotId]`, `_components`).

- `app/`: routes. Route files load data and compose features. Markup a route needs goes in a
  private `_components/` beside it; a composition of two features (the splash: search +
  overview; the top bar: search + share) lives there, never in a feature.
- `features/<domain>/`: `recap` (the whole summoner page, both views), `search`, `overview`,
  `dev`. Segments, only those with content: `api/` (server requests, each with
  `import "server-only"`, plus client query keys and hooks), `components/`, `hooks/`, `stores/`,
  `utils/`, `types/`. `stores/` holds only state shared across the feature (context + hook, or a
  small pub/sub store); components and helpers that use a store go in `components/`/`utils/`. A
  component that knows the recap's domain (slides, champions, augments) belongs in
  `features/recap`, even if it looks generic.
- Shared: `components/` (generic UI kit with no domain knowledge), `components/ui/` (raw shadcn
  primitives from the shadcn CLI, not hand-edited), `hooks/` (`use-x.ts` exports `useX`), `lib/`
  (configured clients: `api-client.ts`, `query-client.ts`, `recent-recaps.ts`, `visitor-ip.ts`),
  `utils/` (pure helpers).

**Files.** One purpose per file. A component is a single kebab-case file named after it
(`fading-rule.tsx` exports `FadingRule` and its props type) until it needs a second file; then it
becomes a folder: `index.tsx` (component + props type), plus only what has content among
`constants.ts`, `utils.ts` (`.tsx` if it returns JSX), `hooks.ts`, `types.ts` and `components/`
(private sub-components, same rules). Never a folder holding just `index.tsx`. Imports are the
same either way. A helper, constant or type lives in the folder of the nearest component that
covers all its users. Public companions (`StatusScreen`'s `NewSearchLink`) live in sub-folders
and are re-exported from `index.tsx`; a companion that renders the component itself
(`SidebarStatRows`) is a sibling, since re-exporting it would be a cycle. Imports into the
importer's own folder are relative (`./components/x`), everything else uses `@/`.

**Server and client.** Route `page.tsx` files are Server Components that fetch and pass data as
props; components using hooks, hover state or a chart library need their own `"use client"`. A
Server Component can't pass a function prop to a Client Component: a module that builds a
`format` function for `AnimatedNumber` must itself be `"use client"`.

## Data flow

- `src/proxy.ts`: with `MAINTENANCE_MODE=true` (set with the API's), every page redirects to
  `/maintenance` and the app's API routes answer 503. Off, `/maintenance` redirects home.
  `/robots.txt` is Railway's health check and stays out of the matcher.
- The splash (`app/page.tsx`) searches any Riot ID. A search only navigates to the summoner URL;
  nothing on a page read calls Riot. Below it, "recent recaps" is per browser
  (`lib/recent-recaps.ts`, localStorage, max 12). Never add a site-wide recent or trending list of
  summoners without asking: anyone could put any Riot ID on the homepage.
- Summoner page: not stored → FETCH MATCHES button; stored but never fetched
  (`lastRefreshedAt` null) → the same button with their icon; fetched → the recap. A first fetch
  only starts from that button. `/summoner/<platform>/<riotId>` is the story recap,
  `.../advanced` the full stats (linked from the story's cover and finale). `/advanced` without a
  recap redirects to the summoner page; an old `#section` link on the story page moves to
  `/advanced`. Both load through `app/summoner/[platform]/[riotId]/_components/recap-route.tsx`.
- During a fetch the page shows the queue screen (`features/recap/components/refresh-view`:
  queue position, then "match X of Y" with an ETA, "waiting on Riot"), then swaps the recap in
  from the stream's `stats` event (`features/recap/api/use-summoner-refresh.ts` puts it in the
  TanStack cache). A visitor arriving mid-fetch joins it. A summoner with a recap keeps showing it
  during a refresh.
- `lastRefreshedAt` is the only "last updated" time and is always shown: the Welcome slide (with
  REFRESH once it's over 15 min old), link preview text, `opengraph-image.tsx`.
- Every call to the API is server-only: `lib/api-client.ts` (`apiFetch`) holds `API_URL` and
  sends `API_PROXY_SECRET`. Browser-side helpers (`summonerStatsQueryKey`, `hasRecap`,
  `formatRetryAfter`) live in `features/recap/api/summoner-query.ts`. The recap query is disabled
  in the browser: its data comes only from the server prefetch or the refresh stream.
- The refresh proxy (`app/api/summoner/[platform]/[riotId]/refresh`) refuses requests whose
  `Sec-Fetch-Site` isn't `same-origin`, and forwards the visitor IP as `x-arena-client-ip`
  (`lib/visitor-ip.ts`: the LAST `x-forwarded-for` entry, which Railway's edge appends; a CDN in
  front would change which entry is right).
- The game catalog: `getGameCatalog` (`features/recap/api/get-game-catalog.ts`, cached an hour),
  provided by the summoner layout (`features/recap/stores/game-catalog.tsx`), resolved into
  `SummonerStatsResponse` once by `features/recap/utils/resolve-stats.ts`. A new item or augment
  field goes in the catalog and the resolver, not the payload. Every page prefetches every
  catalog icon after load (`app/_components/asset-prefetch.tsx`, URLs from
  `app/api/catalog-icons`); splash and loading art is not prefetched.
- Riot ID slugs: `parseRiotIdSlug` decodes (Next passes params percent-encoded) and validates
  with `utils/riot-id.ts` (mirrors the API's `riotIdParams.ts`); invalid is a 404. Link previews
  name only stored summoners (otherwise a generic card); rendered cards are cached (100, LRU).
- `/dev` (`app/dev/page.tsx`): an unlinked table of every summoner with a recap. Public on
  purpose.

## Security headers

`next.config.ts`: nosniff, no framing, a referrer policy, and in production only a CSP and HSTS.
Assets may come only from this origin and `ASSET_HOSTS` (Data Dragon, CommunityDragon): a new
host must be added there or it breaks in production while working in `next dev`.

## Design system

- Fonts: Beaufort for LoL (`--font-display`) and Spiegel (`--font-body`), loaded with
  `next/font/local` in `src/fonts/` (declare only the faces the UI uses). Colors: the Hextech `@theme` tokens in `globals.css` (black/navy backgrounds,
  blue/cyan magic, gold metal, damage/heal/mana/rarity/tier colors). Reuse them; don't invent a
  palette. shadcn: style `default`, base color `slate`, CSS variables.
- **Tier colors mean finishes everywhere**: a winrate or win count is tier gold, a 1st-place rate
  or count tier prismatic, games played silver (`StoryStat`'s `win`/`first` tones,
  `.tier-bar-*`, `utils/tier-bars.ts`), in both views. A tiny fill (a calendar day, a thin bar
  segment) adds `tier-compact`, or the prismatic sweep shows as one flat hue.
- Never render `championName` as text: render `useChampionName()(championName)`
  (`features/recap/stores/champion-names.tsx`).
- Hour-of-day stats show in the viewer's time zone: `useRecapStats` re-indexes every
  `calendar.*ByHour` array (`localizeCalendarHours`, `useUtcOffsetHours`) and labels print
  `utcOffsetLabel` ("UTC+2"). Calendar days stay UTC days, labelled so.
- Oversized `<img>` needs `max-w-none` (preflight's `max-width: 100%` clamps the width, not the
  height). `<img>` is deliberate here, not `next/image`.
- Section background art: `public/images/backgrounds/optimized/`, generated by
  `node scripts/optimize-backgrounds.mjs` from the originals beside it; point
  `features/recap/utils/section-backgrounds.ts` at the optimized file. Backgrounds attach lazily
  (`hooks/use-near-viewport.ts`).

## Layout and fit

- Two modes (custom variants in `globals.css`): `deck` (≥1280 px wide and ≥860 px tall: a
  full-viewport, scroll-snapped slide) and `flow` (everything smaller: sections grow and the page
  scrolls). Never rely on `h-screen overflow-hidden` to fit.
- A slide fits its screen by scaling, never with an inner scrollbar: `clamp()`/`vh` sizes for
  medallions, big numbers and padding, details dropped or shrunk at `max-height`. An inner
  scroller is only a below-`md` fallback. The one sanctioned exception is the Collection
  dossier's ITEMS and AUGMENTS lists, which scroll on purpose.
- Check new content at 390×844, 1366×768, 1280×860 and 1920×1080
  (`node scripts/screenshot.mjs <path>`, see below). Short deck viewports (860-999 px tall)
  shrink `.dial-fit` and `.sidebar-stat-row`. Grids that fill their panel measure it
  (`hooks/use-fit-columns.ts`); Hall of Fame-style catalog grids use `components/hex-comb`.
  Fixed-column table panels pass `HextechPanel`'s `contentMinWidth`.
- The summoner top bar (`app/summoner/_components/top-bar`) overlays the page and hides on
  scroll down: don't reserve space for it; keep content that must never be covered out of a
  slide's top ~64 px.

## Story recap (default view)

`features/recap/components/summoner-story`. At a glance by design: text leads, one or two visuals
per slide, no hover cards, tabs or sorting (those stay in the full stats).

- A cover (`StoryCover`, never automatic: its button, scroll down, swipe up or ArrowDown starts
  it), then `StoryPlayer`: full-screen slides, each shown for its `durationMs`. The active
  progress bar's CSS animation (`.story-progress-fill`) is the clock: its `animationend`
  advances, so pausing the animation pauses the story (hold, Space, pause button, hidden tab).
  Left 30% or ← goes back, elsewhere or → skips; the last slide waits.
- Order, timing and each slide's entrance (`TRANSITIONS`: slide, rise, zoom, iris, tilt, wipe,
  mirrored going back, cross-fade under reduced motion) live in one registry, the `slides` array
  in `summoner-story/index.tsx`. A slide without data is left out there.
- Story slides live in `components/story-slides/<slide>`, sit in `StoryFrame` (blurred art, its
  own two-colour glow) and stagger content with `Appear` (`components/appear.tsx`, on mount).
  Shared pieces: `StoryStat`, `StoryFact`, `StoryPortrait` (full loading-screen art wherever a
  slide names one champion), `StoryComb` (the honeycomb with `alwaysFit` and `play`: hidden while
  the slide moves in, rippling in afterwards).

## Full stats (`/advanced`)

- One slide registry: the ordered `slides` array in
  `features/recap/components/summoner-stats-view/index.tsx` (id, short label, chapter, render).
  Section DOM ids (`#augments`), the previous section's "next" cue and the chapter rail derive
  from it via `features/recap/stores/slide-position.tsx`. To add, remove or reorder a section,
  edit the registry; never pass hand-typed "next section" labels. Slides live in
  `components/slides/<slide>`.
- Panels have one header row (`PanelToolbar`): tab groups on the left separated by
  `ToolbarDivider`, then the fading rule and trailing switch, the caption below. An extra button
  group goes on that same row after a divider (move state up if needed); never a second toolbar
  or row of tabs. Damage and Utility are the reference.

## Rates and samples

- Every rate follows `features/recap/utils/sample.ts`: rate sorts go through `sortByRate` (rows
  under `MIN_SAMPLE` games rank after the rest and render dimmed), and rate scales and maxima are
  computed from rows that meet the sample. Lists that demote show `low-sample-switch` during a
  rate sort, which passes `lowSample: "mixed"` to rank everyone together (still dimmed; mixed-in
  outliers clamp to one equal max bar).
- Exceptions: the Collection dossier never dims or demotes (a plain sort by the chosen column);
  Bans keeps low-sample rows last and dimmed with no switch; Team Synergy's Teammate Picks
  doesn't dim on its MOST GAMES sort.
- A rate difference is a plain subtraction (55% vs 50% is +5%, never +10%), formatted by
  `formatSignedPoints` (`components/delta-cell`) as "+4.2%", never "pp".
- Per-augment and per-item "vs average" uses `pooledRate`, not the per-game rate: longer games
  hold more augments and items and finish higher. The per-game rate is a fair baseline only for
  once-per-game things (champions, teammates, boots outcome, special items).
- Bar charts use linear scales from zero (`utils/bar-scale.ts`); no log or power scales.

## Motion

- Every section animates in when scrolled to and replays on re-entry: `components/reveal`'s
  `Reveal` (fade + lift, `hooks/use-section-in-view.ts`), applied inside `CategorySection` and
  `HeroSection`, so a new section gets it free. `CategorySection` observes the whole `<section>`
  and passes one `inView` to each `Reveal`.
- A tab that swaps what a chart shows replays the chart's entrance; recolouring in place reads as
  broken. HourStrip's growing bars are the reference.
- `components/animated-number` (`AnimatedNumber`) counts up with `requestAnimationFrame`
  (`useCountUp`), not CSS counters, so it can format any string.
- Respect `prefers-reduced-motion` in all JS animation (`Providers` sets
  `MotionConfig reducedMotion="user"`; `useCountUp` jumps to the final value).

## Hover cards

- Build from `features/recap/components/hover-stat-card`; position a non-nivo card with
  `components/cursor-tooltip` and `hooks/use-chart-hover.ts` (touch: tap opens, outside tap or
  scroll closes). `HextechBarChart` takes `onHover` + `highlightedId`; nivo charts put the same
  card in their `tooltip`.
- A card shows what the section's pinned panel (sidebar or detail band) doesn't: list what the
  panel shows, then fill the card with the other half (Picks' card shows the combat line, KDA's
  card shows results). Tables that already print names and numbers, and the collection slides,
  get none.
- Hover highlights the hovered element (brightness up, a stronger glow in its own colour) and
  never dims the others.
- To send someone to a champion's full stats, use `DossierLink` (backed by the
  `openChampionDossier` channel in `features/recap/stores/champion-dossier.ts`).

## Vendored nivo calendar

`src/vendor/nivo-calendar/` (see its README) is a patched copy of `@nivo/calendar`'s `TimeRange`
(centring via `computeOrigin`, a month-legend off-by-one fix). Edit it directly, no build step;
keep its `@nivo/*` dependencies on the same version as the other nivo charts. Excluded from lint.

## Screenshots

`node scripts/screenshot.mjs summoner/euw1/Name-TAG[/advanced#id] [--keys ArrowDown,ArrowRight]`
captures a page of the running dev server (or `BASE_URL`) at the four viewports above, with
reduced motion, and prints the PNG paths to read plus any console errors, failed requests and
sideways scroll. In Git Bash, leave out the leading slash (it gets rewritten into a Windows
path). On the story, ArrowDown starts it and each ArrowRight skips a slide. Adding a stat end to
end: the `add-recap-stat` skill.
