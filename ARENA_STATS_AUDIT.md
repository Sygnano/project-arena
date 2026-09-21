# Arena Stats — UX/UI/QA Audit

> **Audit date:** 2026-09-17 · **Scope:** the summoner page (`/summoner/[platform]/[riotId]`) and all 30 of its screens, the shared component layer, the home page, and the `GET /summoners/by-riot-id/.../stats` endpoint that feeds them.
> **Status:** living checklist. Tick items in the [Recommended Roadmap](#recommended-roadmap) as they ship, and re-audit a slide whenever it changes.
> **Last implementation pass:** 2026-09-17 (pass 2) — see [Implementation Status](#implementation-status) for what changed and how it was verified, and [Implementation History](#implementation-history) for the log. Issue tables below still describe the state *at audit time*; the tracker is the source of truth for current status.

## How to read this document

**Method.** Every file under `apps/web/src` that the summoner page renders was read line by line, along with `packages/types/src/stats.ts` and the relevant parts of `apps/api/src/routes/summoners.ts`. `pnpm typecheck` passes. `pnpm lint` reports 0 errors and 45 warnings (mostly `no-img-element`, plus unused variables in `TimePlayed`). **The page was not run in a browser for this audit.** Visual, responsive and layout findings come from the hard-coded sizes in the code, and the math is shown where it matters. Confirm them in a real browser before and after fixing.

**Evidence tags** (every issue carries one):

| Tag | Meaning |
|---|---|
| **[Observed]** | Confirmed directly in the code; the behavior follows unambiguously from it. |
| **[Likely]** | Strongly implied by the code (e.g. fixed pixel sizes vs. a viewport), but needs a visual check. |
| **[Opportunity]** | Nothing is broken; this is a design or product improvement. |
| **[Feature]** | New capability. |

**Priority:** 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low
**Types:** BUG · UX · UI · DATA · VISUALIZATION · ACCESSIBILITY · PERFORMANCE · RESPONSIVE · FEATURE · CONTENT · ARCHITECTURE · POLISH

Issue IDs (`C-xx`, `S07-3`, `X-4` …) are stable handles for tickets and for the roadmap checkboxes.


---

## Implementation Status

**Status legend:** `[x] Fixed` / `[x] Implemented` (done and verified) · `[~] Partial` · `[ ] Not started` · `[?] Needs product decision` · `Won't implement — reason`

**How these passes were verified.** Beyond `tsc` (web + API: clean), `eslint` (0 errors, 41 `no-img-element` warnings) and, in pass 2, a production `next build`, every item marked done was checked against the running app with real data:
- API output diffed before/after (`curl` of the stats endpoint).
- Server-rendered HTML grepped for removed/added content.
- Headless Chrome screenshots at 1920×1080, 1366×650 and 390×844.
- A Chrome DevTools Protocol script that (a) measured horizontal overflow of every section at 390, 1024 and 1366 px, (b) drove tabs and rows with keyboard events and read back `aria-selected`/`aria-pressed`/focus, (c) measured chart element heights, and (d) collected console errors (none remaining).
- Pass 2 added: a sidebar-vs-cue overlap measurement on every section at 1280×860 and 1920×1080; hall-of-fame grid fit at 1280×860, 1366×768, 1920×1080 and 2560×1440; emulated `prefers-reduced-motion`; `cmp` of the stats response before and after the query refactor (byte-identical); SQL checks of the survivorship-bias claims.

Items only verified by reading the code say so.

### Critical / high

| ID | Status | What changed / notes |
|---|---|---|
| C-01 | [x] Fixed | `CategorySection` no longer has a placeholder `quote` default (quote is optional). Pings has a real quote and an uppercase title. Verified: "Allan add quote here" absent from rendered HTML. |
| C-02 | [x] Fixed | API adds `championDisplayNames` (lowercased Riot key → Data Dragon `name`). `lib/champion-names.tsx` provides `useChampionName()`, used on every champion label, alt text and tooltip (KDA, Picks, Collection cards and dossier header, Arena God, Bans, Damage, Ability, Utility, Team Synergy chord labels and tooltips). Verified: "Wukong", "K'Sante", "Twisted Fate" rendered; remaining `MonkeyKing` strings are icon URLs and JSON keys only. |
| C-03 | [x] Implemented | Ordered slide registry in `stats-view.tsx` + `lib/slides.tsx` context. Section ids enable `#hash` deep links. The new `ChapterRail` (fixed right, grouped by chapter, labels on hover/focus, current section lit, hash kept in sync with `replaceState`) and every "next" cue (`SlideCue`) derive from the registry. Verified: `#kda`, `#bans` etc. open on that section; 29 rail links. |
| C-04 | [~] Partial | Done: `DiamondTabs` is a real tablist (roving tabindex, ←/→/Home/End); chart icon columns, Bans/Damage/Ability/Utility/Teammates/Nemesis/Vault rows are keyboard-pressable with `aria-pressed` + descriptive `aria-label`s; sort headers are `<button>`s; cues are `<button>`s; a global gold `:focus-visible` ring; coverflow Home/End **and type-to-jump** (pass 2); **Boots legend and dossier donut legends are focusable and drive the read-out** (pass 2); cue/rail navigation moves focus to the section heading (A-08). Verified by CDP keyboard tests. **Remaining:** hall-of-fame grid icons and the hour/chord charts are pointer-only. |
| C-05 | [~] Partial (steps 1–2) | New `deck`/`flow` layout variants: snap + fixed composition only at ≥1280×860; otherwise sections grow and scroll. Sidebar stacks below `xl`; table panels scroll horizontally as one unit (`HextechPanel contentMinWidth`); captions wrap; hall-of-fame grids auto-fill below `lg`; Kills plates/records, Boots, Special Items, Anvils, Welcome/Farewell reflow; `DetailBand` uses a container query. Pass 2: dossier stacks on phones and uses a 1/2/4-column container-query grid (S08-7); short deck heights (860–999 px) shrink dials and sidebar rows so nothing runs into the cue (D-09); Bans and Vault tables fit a 1280 px deck without inner horizontal scrolling (D-12). Verified: zero page-level horizontal overflow at 390/1024/1366 px. **Remaining (step 3, too large for this pass):** true mobile components (tables as cards, tap tooltips). |
| C-06 | [x] Fixed | `lib/sample.ts` (`MIN_SAMPLE = 5`, `sortByRate`, `isLowSample`) applied to every rate sort: Picks/Augments/Prismatic "BY 1ST RATE" (+ new "BY TOP 3 RATE"), Bans "BIGGEST SWING", Teammates/Nemesis rate sorts, KDA/Damage/Ability/Utility PER GAME. Low-sample rows rank last and are dimmed; captions state the rule. API adds `gamesOpenAndPicked` so ban swings show their sample. Shrinkage-based ranking not done (deferred; the floor fixes the visible problem). |
| C-07 | [x] Fixed | KDA BEST GAME uses `mostKills` / new API `fewestDeaths` / `mostAssists`; best-KDA line kept separately for the detail band ("BEST KDA GAME"). |
| C-08 | [x] Fixed | "SEASON 3" removed; Welcome shows region · "TRACKED SINCE <first tracked day>" and "LAST GAME <n> AGO". "SEASON TOTAL" captions → "ALL GAMES". |
| C-09 | [~] Partial | Home page now lists tracked summoners (icon, Riot ID, region, level) linking to profiles; dead button removed; unreachable-API state handled. Friend rows in Teammates/Nemesis detail band link to tracked profiles. **Not started:** match history, leaderboard. |
| C-10 | [x] Fixed | Coverflow consumes the wheel only while a card remains in that direction and releases vertical wheel at either end. Augment Crafting no longer uses the coverflow (flat row of 5). All inner scroll lists and chart scrollers use `overscroll-behavior: contain`. Wheel release verified by code review, not by a simulated wheel gesture. |
| C-11 | [x] Fixed | Footer rewritten to describe the real metric; "NO BAN %" denominator is `totalBans + noBanCount` (8.9% on real data); lobby-wide nature explained in the section description. |
| H-01 | [x] Fixed | API adds `avgPlacement`; Placement dial = AVG PLACEMENT (3.38 on real data); "top 3 = win" defined in the Placement description; labels TOP 3 RATE / 1ST RATE. |
| H-02 | [?] Needs product decision | Semantic color system (outcome vs rarity vs volume) changes the look of most slides; needs sign-off on which meaning keeps the prismatic/gold/silver tiers. Only local fixes so far: KDA TOTAL · DEATHS bars are neutral silver. |
| H-03 | [x] Fixed | `scripts/optimize-backgrounds.mjs` (sharp via Next) → `backgrounds/optimized/*.webp`: **13.6 MB → 1.73 MB**. Section and hero backgrounds attach only within ~1 screen of view (`useNearViewport`); Welcome loads eagerly. |
| H-04 | [x] Fixed | Per-summoner response memo keyed by match count + latest game (cached 0.62 s). Pass 2: every query that depends only on the summoner now starts at once (27 hoisted; the teammate, opponent and ban chains rewritten with subqueries so they no longer wait on earlier results). **Cold build 9.4 s → 3.75 s**, output byte-identical (`cmp`). Themed `loading.tsx`, `error.tsx` (retry), `not-found.tsx`. |
| H-05 | [ ] Not started | Time-range filter. Too large for this pass: needs API parameters on every aggregate, cache keys per range, and a UI control on every slide. |
| H-06 | [x] Implemented | PER GAME is the default mode on KDA, Damage (dealt/taken), Ability and Utility (sidebar dials, rows and detail band). TOTAL and BEST GAME remain. |
| H-07 | [x] Fixed | `lib/bar-scale.ts` is linear from zero (log + `^1.6` removed); KDA raised floor removed; row-list widths linear (exponent 1). |
| H-08 | [x] Fixed | Welcome: 4 headline stats + last-10 placement pips + freshness. Farewell absorbs Thank You and ends with BACK TO TOP / OTHER SUMMONERS. |

### Slide-level items

| ID | Status | Notes |
|---|---|---|
| S01-2, S01-3, S01-4, S01-5 | [x] Fixed | Headline strip + recent form; name size scales with length/viewport (`clamp`), wraps; `<h1>` + `<button>` cue; "LAST GAME … AGO". |
| S02-2 | [x] Fixed | Tier by placement number; API zero-fills placements 1..worst seen. |
| S02-3, S02-4 | [x] Fixed | Labels; each bar shows "count · share%". Uniform-expectation line not added. |
| S02-5 | [x] Fixed | `modules/Positions` renamed `modules/Placement`. |
| S03-1, S03-2, S03-5, S03-6 | [x] Fixed | Mode captions (with "UTC"), "PLACEMENT" tab, weekday "S", shared `SidebarStatRow`, unused vars gone; "LONGEST DAY STREAK". |
| S03-3 | [~] Partial | UTC is labeled everywhere (captions, hour band). Bucketing in the viewer's timezone not done: the API aggregates by UTC day/hour, so it needs raw timestamps or a timezone parameter. |
| S03-4, S03-7 | [x] / [x] | Hour mode keeps a detail band (games, top 3 rate, avg placement for the clicked hour; defaults to the busiest hour; API adds `top3ByHour`, `avgPlacementByHour`); verified clicking an arc changes the hour. Sidebar adds MOST GAMES IN A DAY and FAVORITE DAY. `currentStreakDays` is left out: it reads 0 whenever there was no game today or yesterday. |
| S04-1 | [~] Partial | Retitled "TEAM SLOT" with a description saying slots are random. Not demoted/removed (IA consolidation pending). |
| S04-3, S04-4, S04-5 | [x] / [x] / [x] | Valid glow; registry cue; `SEGMENT_TIER` now points at `TIER_STYLE`. Pass 2: bars use percent heights so labels stay inside the panel at 1280×860 (D-11). |
| S05-1…S05-6 | [x] Fixed | See C-07, H-06, H-07; TOTAL·DEATHS neutral; captions. S05-5: instead of a "top 15" cut, overflowing bar charts show edge fades that signal more columns (all `HextechBarChart` uses). |
| S05-7 | [x] Fixed | Sidebar uses `SidebarStatRows`; adds MOST KILLS · 1 GAME and BEST KDA · 1 GAME. |
| S06-1 | [x] Fixed | Multikill de-cumulation clamped at 0 (assumption itself still unverified). |
| S06-3 | [x] Fixed | Plates and record columns wrap. |
| S06-2, S06-4, S06-5 | [x] / [x] / [?] | Headings FIRST STRIKES / BIG MOMENTS; largest multikill shown by name. "PENTAS ON · Smolder ×1" (quadras when there are no pentas) replaces the redundant LARGEST MULTIKILL row. Merging Kills into KDA is part of the IA decision. |
| S07-1, S07-3, S07-4, S07-5, S07-6 | [x] Fixed | Sample rule; segment tooltips name the outcome; TOP 3 RATE sort + sort-aware rank label; 120px portrait (no upscaling); dead `avgLineBottom` removed; quote typo. |
| S08-1 | [x] Fixed | C-10. |
| S08-3 | [x] Fixed | Dossier Legendary row = built (bought ∪ held), same source as Vault; labeled "BUILT". |
| S08-4 | [x] Fixed | CC score shown as a duration everywhere (`formatDuration`, shared in `lib/format.ts`). |
| S08-5 | [x] Fixed | Boots tooltip no longer shows a share of games. |
| S08-2, S08-6…S08-9 | [~] / [x] / [x] / [ ] / [x] | S08-2: type-to-jump in the gallery (verified "sm" → Smolder); sort chips not added. S08-6: item rows end in a "+N" chip naming the hidden items (verified). S08-7: container-query grid (1/2/4 columns), scrollable identity column, stacked on phones (verified 390/1366/1920). S08-8 not done (minor). S08-9: legend rows focusable with spoken values. |
| S09-1 | [~] Partial | Header shows PLAYED / TOP 3 WITH / 1ST PLACE WITH as "n / 171"; description explains the rings and Arena God. No progress ring or "not yet won" filter. |
| S09-3, S09-4 | [x] Fixed | Labels; auto-fill grid below `lg`. |
| S09-2, S09-5 | [ ] / [x] | S09-2 (click an icon to open its dossier) needs cross-slide state, not done. S09-5: `tierForBestFinish` in `lib/tier-bars.ts`, `frameRingClassName`/`RING_WIDTH` imported from `card-frame.tsx` in all three hall-of-fame grids and both framed cards. |
| S10-1, S10-2, S10-3, S10-5 | [x] Fixed | C-11, C-06; rail scaled to the largest eligible swing (min ±10 pp) with ±pp tick labels; pp notation. |
| S10-4 | [x] Fixed | Dial is now MAINS BANNED: games where one of your three most-picked champions was banned (53%, 178 of 333), naming them; TOTAL BANS moved to the rows. API adds `mainChampions`, `matchesWithMainBanned`, `matchesTracked`. |
| S10-6 | [x] Fixed | Inline rule replaced by `FadingRule`. |
| S11-1, S11-2, S11-4 | [x] Fixed | PER GAME default; linear widths; mode-aware detail band. |
| S11-3, S11-5, S11-6 | [x] / [?] / [x] | BEST GAME caption says "EACH COLUMN IS ITS OWN RECORD". The dealt/taken merge is part of the IA decision. |
| S13-1, S13-4, S13-6 | [x] Fixed | Sample rule; selection highlight uses the resolved selection; registry cue. |
| S13-2, S17-2, S21-2 | [x] Verified and fixed | **Confirmed on real data:** games holding 6 augments finished top 3 71% of the time vs 16% with 3; 1st-place games averaged 16.8 purchased items vs 4.9 for 6th; a prismatic item was held at the end of 329/333 games. Augments, Prismatic Items and Vault now compare each row with the **pick-weighted average of that list** (`pooledRate` in `lib/sample.ts`: "TOP 3 VS AVG PICK/ITEM"), not the per-game rate. Vault's tick and caption explain why its baseline (59%) is above the per-game 53%. Round-aware ratings remain an opportunity. |
| S13-3, S13-5 | [?] / [~] | S13-3 is part of the color-system decision (H-02). S13-5: edge fades on the overflowing chart; no top-N cut. |
| S14-1 | [x] Fixed | `hooks/use-fit-columns.ts` measures the grid's real box and picks the column count (all three hall-of-fame grids). Verified no overflow at 1280×860, 1366×768, 1920×1080, 2560×1440. |
| S15-1, S15-2 | [x] Fixed | Mechanic explained; accordion opens on click ("SELECT A CHAMPION"). |
| S16-1, S16-2 | [x] Fixed | Flat, wrapping row of 5 framed cards; explainer. |
| S16-3, S18-1 | [?] Needs product decision | Merges (IA consolidation). |
| S17-1, S17-3 | [x] / [~] | Sample rule; tooltip wording unified ("1st-place finish…"). |
| S19-1 | [~] Partial | Stat / Legendary / Prismatic counts and gold share in the sidebar; Shardblade kept as the panel centrepiece (not moved). |
| S19-2, S19-3 | [x] Fixed | Unique quote, "IN ONE GAME"; flex layout (no clipping). |
| S19-4 | [x] Fixed | Shardblade rates show "+6 pp VS YOU" / "FEW GAMES" under the sample rule (`RatePair` `baseline`/`sample`). |
| S20-1, S20-3 | [x] Fixed | "THE" eyebrow only for real "The …" names; responsive grid. |
| S20-2 | [x] Fixed | Description explains how each item is obtained; each card shows its difference from your overall rates (or FEW GAMES). |
| S21-4 | [x] Fixed | pp notation; shared `formatGold` in `lib/format.ts` (unit fixed from the final value so the count-up doesn't jump K→M) used by Vault and Anvils. |
| S22-3 | [x] Fixed | "163 · 49%" and "22 · 7%". |
| S22-1, S22-2 | [x] / [?] | S22-1: API `outcomes` split: kept boots on 31% top 3 (170 games), finished barefoot 80% (141), never bought 50% (22), each with pp vs average and a caption that selling is late-game (association, not cause). S22-2 (drop the donut) is a visual design call. |
| S23-2 | [x] Fixed | Mode-aware detail band. |
| S23-1 | [?] Needs product decision | Remove Ability as a standalone slide? Now per-game by default, which makes it more useful than at audit time. |
| S24-1 | [x] Fixed | Saves / CC score explained; CC as duration. |
| S24-2, S24-3 | [~] Partial | Linear scales + per game; champion name via tooltip/`aria-label`. A visible name needs a redesign of the mirrored heal/CC layout. |
| S25-1, S25-4 | [x] Fixed | Best pair named (with games), "PAIR" wording; API best-pair minimum raised 3 → 5 (was showing "100%" from 3 games). |
| S25-2, S25-3, S25-5 | [x] / [x] / [?] | New TEAMMATE PICKS view on Team Synergy: champions your teammates played (your pick excluded), games, your top 3 rate, Δ pp, MOST GAMES / BEST TOP 3 RATE sort under the sample rule. Own-champion × teammate-champion pairs were built first and dropped: only 1 of 589 pairs reached 5 games. S25-5 is IA. |
| S26-1, S27-4 | [x] Fixed | Tracked friends link to their profile from the detail band (no tracked friends in current data, so verified by code only). |
| S26-2, S26-3, S26-4 | [x] Fixed | Sample rule; "Δ YOU" column in pp; best partner named. |
| S26-5, S27-3 | [x] Fixed | API lists only teammates/opponents met ≥2 times (+ tracked friends): 599 → 36 and 4,206 → 571 rows; true totals still shown. Payload 1.67 MB → 512 KB. |
| S27-1 | [~] Partial | Expected "finishes ahead of you" rate from your placement distribution (~48%) shown in description and caption; not used for ranking. |
| S27-2 | [x] Fixed | "YOU – THEM 4 – 10"; tab and column "AHEAD OF YOU". |
| S28-1, S28-2, S28-3 | [x] Fixed | Quote; title; "Generic Ping"; never-used types hidden; grid columns follow tile count. |
| S29-1, S29-2, S29-4 | [x] Fixed | CTAs; Thank You merged into Farewell (module deleted); `HeroSection` shared by Welcome/Farewell. |

### Cross-slide, accessibility, performance

| ID | Status | Notes |
|---|---|---|
| X-1 | [?] Needs product decision | See H-02. |
| X-2 | [~] Partial | "TOP 3 RATE" / "1ST RATE" / "pp" / "PAIR" / "ALL GAMES" everywhere touched; pass 2 replaced "WON" on framed augment cards (PICKED / TOP 3 / 1ST), "WON WITH" on hall-of-fame strips, "NEMESIS WIN RATE". Remaining: glossary tooltips. |
| X-3 | [x] Fixed | Registry-driven cues; all stale `nextSectionLabel` props removed. |
| X-4 | [~] Partial | Shared: `HeroSection`, `SlideCue`, `ChapterRail`, `DeltaCell`/`formatSignedPoints`, `PlacementPips`, `pressable`, `perGame`, `sortByRate`, `pooledRate`, `formatDuration`, `formatGold`, `tierForBestFinish`, `useFitColumns`, `usePageUpkeep`. Not yet: `HallOfFameGrid`, `OutcomeStackChart`, `RankedRowList`, `AccountTable`. |
| X-5a | [x] Fixed | One `MIN_SAMPLE` (API synergy aligned to 5). |
| X-5f | [x] Fixed | Anvils quote unique. |
| X-5g | [x] Fixed | Quote uses `text-base`. |
| X-5b…X-5e, X-5h | [~] / [ ] / [x] / [ ] / [ ] | X-5b: `formatGold` shared. X-5c (one accessible tooltip component) is a larger component change, not done. X-5d: with no tracked matches only the Welcome slide (which has its own empty state) renders and the rail is hidden (verified by code only; no empty summoner exists). X-5e needs new art. X-5h not done. |
| A-01 | [~] Partial | See C-04. |
| A-02 | [x] Fixed | `<main>`, one `<h1>` (Riot ID), `<h2>` per section with `aria-labelledby`, rail as `<nav>`. Verified: 1 h1, 28 h2. |
| A-03 | [x] Fixed | Every 8.5–10.5 px label raised to 11 px (33 places); `#7f7a6e` column headers → `#a09b8c`. |
| A-04 | [~] Partial | Chart columns and rows now have spoken labels with their values; no data-table alternatives. |
| A-05 | [x] Fixed | `MotionConfig reducedMotion="user"` wraps the app; `useCountUp` shows the final value immediately. Verified with emulated `prefers-reduced-motion` (count shows its final value on the first frame). Smooth scroll already `motion-safe`. |
| A-06, A-07, A-08 | [~] / [~] / [x] | A-06: Δ values carry +/− signs. A-07: Boots and dossier legends focusable; hall-of-fame icons still rely on `title`. A-08: cue and rail activation move focus to the section heading (verified `document.activeElement` = `h2#kills-title`). |
| A-09 | [~] Partial | New decorative layers are `aria-hidden`. |
| P-01 | [x] Fixed | H-03. |
| P-02 | [x] Fixed | H-04. |
| P-03 | [x] Fixed | Server-side list cap (virtualization not needed at 36 / 571 rows). |
| P-06 | [x] Fixed | `console.log` removed. D-05 re-measured (see Discovered). |
| P-04 | [x] Fixed | `loading="lazy" decoding="async"` on 43 remote images in 26 components (not the Welcome hero or home page). |
| P-05 | [x] Fixed | `hooks/use-page-upkeep.ts` marks sections more than a screen away `data-offscreen`; CSS pauses their animations (verified 24 of 29 sections paused). |
| P-07 | [~] Partial | Removed `animated-stat`, `champion-icon-tick`, `stat-card`, `stat-grid` and `@nivo/bar`, `@nivo/funnel`, `@nivo/heatmap`, `@nivo/scatterplot`. Kept `ui/carousel.tsx` + `embla-carousel-react` (the carousel has local edits) and `ui/button-group.tsx` (shadcn primitive). |
| P-08 | [~] Partial | The font declarations now list only the 7 faces in use (were 16): ~794 KB → ~367 KB of fonts per visit, measured. WOFF2 conversion not done (needs a font tool the repo doesn't have). |
| P-09 | [~] Partial | Failed remote images are hidden (`data-broken`, verified with a bogus URL). `DDRAGON_VERSION` is still hard-coded. |
| P-10 | [x] Fixed | LIKE wildcards escaped; verified `Sy_nano` → 404, case-insensitive match still 200. |

---

## Executive Summary

Arena Stats already has something most stats sites never get: **a distinct identity.** The Hextech language (broken-corner panels, diamond cues, instrument dials, tier-gradient bars, Riot's own augment card frames) is applied with real discipline. Several interactions are genuinely well made: the coverflow champion gallery with its dossier drill-down, the FLIP re-sort animation on bar charts, and the Vault's rate-vs-baseline bars. The shared component layer (`CategorySection`, `HextechPanel`, `Dial`, `DetailBand`, `DiamondTabs`) makes the 30 slides feel related.

The product is held back by five cross-cutting problems, not by any single slide:

1. **The page is a 30-screen tunnel with no map.** No table of contents, no progress indicator, no deep links, and no way to jump. Reaching Nemesis takes 26 snap-scrolls. The home page doesn't link to any summoner, and its only button does nothing. **Match history, the charter's #1 v1 priority, doesn't exist yet.**
2. **Numbers are shown without the context to interpret them.** Most slides rank *totals* (damage, casts, kills, picks), which mostly measure how often a champion was played. Rate rankings have no minimum sample, so a champion or augment used once and won once sorts first. "Win" means top 3, but that definition first appears on slide 21. The core Arena metric, **average placement**, isn't on the Placement slide at all.
3. **Some displayed data is wrong or fabricated.** Examples: raw Riot internal IDs as champion names (`MonkeyKing`, `FiddleSticks`), a hard-coded "SEASON 3", a KDA "best game kills" ranking that reads the wrong match, a ban "no ban %" with the wrong denominator, and the literal placeholder quote "Allan add quote here" on the Pings slide.
4. **It only works on a large desktop with a mouse.** The layout is built from fixed pixel sizes inside `h-screen overflow-hidden` sections, so content is clipped on common laptops and unusable on tablets and phones. Nearly every interactive element is a `div` with `onClick`: no keyboard access, no focus state, no ARIA roles. Two slides swallow the mouse wheel.
5. **The design system has drifted.** The silver/gold/prismatic palette carries **seven** different meanings across the page. "Win rate" has nine different labels. At least a dozen visual patterns are copy-pasted instead of shared, and near-identical slides (three "picks" charts, three "hall of fame" grids, Damage/Ability, Teammates/Nemesis) have diverged in small, visible ways.

**Recommendation in one sentence:** fix the data-correctness and navigation problems first. Then consolidate the 30 slides into ~18 chaptered screens that each answer one clear player question, with per-game and vs-baseline numbers as the default, before adding any new statistics.

### Scorecard

| Dimension | Grade | One-line justification |
|---|---|---|
| Visual identity | A− | Cohesive, ambitious Hextech language; strongest asset. |
| Information architecture | D | 30 flat slides, no navigation, related content scattered (Team slot is 4th, Team Synergy is 25th). |
| Data correctness | C− | Several wrong/fabricated values; small-sample rankings throughout. |
| Statistical usefulness | C | Lots of totals, few rates, almost no baselines, trends or records. |
| Accessibility | F | Mostly mouse-only; tiny low-contrast type; no semantic headings. |
| Responsiveness | F | Desktop ≥ ~1440×900 only. |
| Performance | C− | ~13 MB of background images and 400+ icons load upfront; ~45 sequential DB queries before first byte; unvirtualized lists of potentially thousands of rows. |
| Code/design-system health | C+ | Good shared primitives, but heavy duplication and drift. |

---

## Critical Issues

| ID | Priority | Type | Location | Issue | Impact | Recommendation |
|---|---|---|---|---|---|---|
| C-01 | 🔴 | CONTENT / BUG | Pings slide · [category-section.tsx:52](apps/web/src/components/category-section.tsx#L52), [Pings.tsx:84](apps/web/src/modules/Pings.tsx#L84) | **[Observed]** `CategorySection` defaults `quote` to `"Allan add quote here"`, and `Pings` passes no quote, so the placeholder renders on a live slide. | Looks unfinished. It's the first thing a friend will screenshot. | Remove the default (make `quote` optional and render nothing when absent) and give Pings a real quote. Add a lint/test guard against placeholder copy. |
| C-02 | 🔴 | DATA / CONTENT | Every champion label (KDA, Picks, Collection, Bans, Damage, Ability, Utility, Team Synergy) | **[Observed]** Champion names come from `match_participants.championName`, which is Riot's internal key (`MonkeyKing`, `FiddleSticks`, `AurelionSol`, `KSante`, `Chogath`, `Belveth` …), not the display name. [riot.ts](apps/web/src/lib/riot.ts) even keeps an override map for URL building. Guests of Honor, meanwhile, uses display names ("Tahm Kench"), so the two conventions are mixed. | Players see "MonkeyKing" instead of "Wukong". It undermines trust in every other number. | Have the API return both `championKey` (for asset URLs) and `championDisplayName` (Data Dragon `name`) from the cached champion catalog, and render only the display name. |
| C-03 | 🔴 | UX / FEATURE | Whole page · [stats-view.tsx](apps/web/src/app/summoner/%5Bplatform%5D/%5BriotId%5D/stats-view.tsx) | **[Observed]** 30 full-viewport, `snap-always` sections with no table of contents, progress indicator, section anchors, or jump controls. The only navigation is scroll or each slide's "next" cue. | Most content is effectively unreachable. Nobody reaches Nemesis (slide 27) on purpose, and nothing can be shared ("look at my augments"). | Add a persistent chapter rail: a vertical diamond-dot nav with labels on hover, current slide highlighted, click to jump. Give each slide an `id` and sync `#hash` on snap. Drive order, labels and cues from one slide registry (see X-3). |
| C-04 | 🔴 | ACCESSIBILITY | [diamond-tabs.tsx](apps/web/src/components/diamond-tabs.tsx), [hextech-bar-chart.tsx](apps/web/src/components/hextech-bar-chart.tsx), every row list, sort headers, next-section cues | **[Observed]** Tabs, chart columns, list rows, sortable headers and the scroll cues are `div`s with `onClick`: no `tabIndex`, no key handlers, no roles, no focus styles. The only keyboard-operable widgets are the coverflow gallery, the accordion and the dossier back button. | Keyboard and screen-reader users can't change a single view. That also blocks power users who navigate by keyboard. | Tabs: `role="tablist"`/`tab`, `aria-selected`, roving tabindex with arrow keys. Rows and columns: `<button>` or `role="option"` inside a `listbox`. Sort headers: `<button aria-sort>`. Cues: `<button>`. Add a shared `focus-visible` gold ring token. |
| C-05 | 🔴 | RESPONSIVE | [category-section.tsx:127-158](apps/web/src/components/category-section.tsx#L127-L158) and every module | **[Likely]** Sections are `h-screen overflow-hidden` with fixed `px-21`/`pt-18`/`pb-26` padding, a fixed 344px sidebar, fixed 286px dials and fixed-px grid columns. A sidebar slide needs about **857px of viewport height** (header ~135 + dial 330 + stat rows ~216 + section padding 176), so on a 1366×768 laptop (~650px usable) roughly 200px of the sidebar is silently clipped. On a phone, 168px of horizontal padding plus a 344px sidebar can't fit in 375px. | Many friends will open a shared link on a laptop or phone and see cropped or broken slides. | Short term: switch `h-screen` to `min-h-dvh`, drop `overflow-hidden`, and turn off scroll-snap below ~1024px wide or ~800px tall. Long term: a real responsive layout (sidebar stacks above panel; tables become cards). See [Responsive Review](#responsive-review). |
| C-06 | 🔴 | DATA / VISUALIZATION | Champion Picks, Augments, Prismatic Items (sort "BY 1ST RATE"); Bans ("BIGGEST SWING"); Teammates and Nemesis (rate sorts) | **[Observed]** Rate sorts have **no minimum sample**. A champion or augment picked once and won once has a 100% 1st rate and sorts first. A teammate from one lucky match tops "TOP 3 RATE". Only Vault (≥5) and the Teammates/Nemesis *sidebar* figures apply a floor. | Every "best X" view is dominated by noise, and players draw wrong conclusions ("I should pick Y"). | Apply one shared rule everywhere: a minimum sample (e.g. 5), with low-sample rows dimmed and sunk like Vault does. Better still, rank by a shrunk rate: `(wins + k·baseline) / (games + k)`. Always show `n` next to any rate. |
| C-07 | 🔴 | BUG / DATA | KDA slide · [KDA/index.tsx:179-186](apps/web/src/modules/KDA/index.tsx#L179-L186) | **[Observed]** In BEST GAME mode, KILLS, DEATHS and ASSISTS read `entry.best.*`, the boxscore of the champion's **best-KDA match**, not the match with the most kills or assists. `ChampionKdaStats.mostKills`/`mostAssists` exist in the payload (the dossier uses them) but KDA ignores them. | "Best game · Kills" can rank a champion with a 25-kill game below one whose best-KDA game had 12 kills. The chart is simply wrong. | In BEST mode use `mostKills`/`mostAssists` and a minimum-deaths record (add it to the API); keep `bestGame` only for the KDA metric. |
| C-08 | 🔴 | DATA / CONTENT | Welcome · [Welcome.tsx:23](apps/web/src/modules/Welcome.tsx#L23) | **[Observed]** `SEASON_PLACEHOLDER = "SEASON 3"` is displayed as fact, with prominent styling. Arena has no season concept in the data. Captions elsewhere say "SEASON TOTAL". | Fabricated data on the very first screen. | Replace with a real, true figure: the tracked date range ("SINCE 12 MAR 2026") or games tracked. Rename "SEASON TOTAL" captions to "ALL TRACKED GAMES". |
| C-09 | 🔴 | FEATURE / UX | Home page · [page.tsx](apps/web/src/app/page.tsx); summoner page | **[Observed]** The home page says features are "coming next", and its "View leaderboard" button has no handler or link. No page lists the tracked summoners, and there's no search, so a profile is only reachable by typing a URL. There is also no match history (charter §1 priority #1) and no leaderboard (priority #4). | New visitors hit a dead end. The single most expected feature of a stats tracker, "show me my games", is missing. | Home page: tracked-summoner cards (icon, name, games, avg placement, recent form) linking to profiles, plus a mini leaderboard. Summoner page: add a Match History slide/route (see [Missing Features › Essential](#essential)). |
| C-10 | 🔴 | UX / BUG | Collection and Augment Crafting · [coverflow-gallery.tsx:343-379](apps/web/src/components/coverflow-gallery.tsx#L343-L379); every inner scrolling list | **[Observed]** The coverflow's wheel listener calls `preventDefault()` on **every** wheel event, and the gallery fills most of the panel, so with the pointer over it the page can't be scrolled onward at all. Separately, the inner `overflow-y-auto` lists (Bans, Damage, Ability, Utility, Teammates, Nemesis, Vault, dossier) chain scroll into the snap container at their ends and unexpectedly jump a whole slide. | Users get "stuck" on two slides and are thrown past content on seven others. | Coverflow: consume vertical wheel only while there is a card left to move to in that direction, and release at either end. Or map only horizontal wheel/shift-wheel to the gallery. Lists: add `overscroll-behavior: contain`. |
| C-11 | 🔴 | CONTENT / DATA | Bans · [BannedChampions.tsx:128-143](apps/web/src/modules/BannedChampions.tsx#L128-L143), [footer :326-331](apps/web/src/modules/BannedChampions.tsx#L326-L331) | **[Observed]** (1) The footer reads "◀ WORSE THAN BASELINE: : YOUR WINRATE DECREASE IF OPS TAKE THE CHAMP". The grammar is broken, "OPS" is jargon, and it's **factually wrong**: the metric is your top-3 rate in games where the champion was open *and picked by anyone in the lobby*, including you and your teammates. (2) "NO BAN %" divides unused slots by `totalBans`, which *excludes* unused slots, so the percentage is inflated and can exceed 100% in principle. | Misleads the reader about what the chart means, and shows an incorrect percentage. | Rewrite: "Your top-3 rate in games where this champion was available and picked, compared with your overall rate." Use `totalBans + noBanCount` as the denominator. |

### High-priority issues that touch the whole page

| ID | Priority | Type | Location | Issue | Impact | Recommendation |
|---|---|---|---|---|---|---|
| H-01 | 🟠 | CONTENT / UX | Placement slide | **[Observed]** Average placement isn't shown anywhere at page level (it's only in the dossier and the calendar tooltip), and "win = top-3 finish" is first defined on slide 21 (Vault). | The primary Arena metric is missing and the most-used word ("win") is ambiguous for 20 slides. | Make average placement the Placement dial. Define "Win = top 3 finish" in the Placement slide caption and in a glossary tooltip used everywhere. |
| H-02 | 🟠 | UI / DESIGN SYSTEM | Whole page | **[Observed]** Silver/gold/prismatic encodes seven different things (see [X-1](#x-1-one-palette-seven-meanings)). On the Augments slide a PRISMATIC *rarity* filter tab sits above prismatic *1st-place* bar segments. | Color stops carrying meaning. Users mistake rank colors for achievement colors. | Reserve tier colors for two meanings (placement outcome and item/augment rarity) and use neutral or cyan for rank and volume. |
| H-03 | 🟠 | PERFORMANCE | [section-background.tsx](apps/web/src/components/section-background.tsx), [section-backgrounds.ts](apps/web/src/lib/section-backgrounds.ts) | **[Observed]** All 30 sections are in the DOM, and each paints a CSS `background-image`, so every image downloads on first load: ~13 MB, including three 2.4–2.9 MB PNGs. Those images are then displayed at `blur(16px) brightness(.42)`. | Multi-second load on typical connections, heavy GPU memory, poor mobile experience. | Pre-blur and downscale backgrounds (a ~480px-wide AVIF/WebP at ~20–40 KB looks identical under a 16px blur). Lazy-attach images via IntersectionObserver or `content-visibility: auto`. |
| H-04 | 🟠 | PERFORMANCE / UX | [page.tsx](apps/web/src/app/summoner/%5Bplatform%5D/%5BriotId%5D/page.tsx), `buildSummonerStats` in [summoners.ts](apps/api/src/routes/summoners.ts) | **[Observed]** The page awaits one endpoint that runs ~45 **sequential** queries, uncached, on every view (`cache: "no-store"`). No `loading.tsx`, `error.tsx` or `not-found.tsx` exists, so the user stares at a blank tab, then gets Next's unstyled error or 404 pages. | Slow first paint; failures look like a broken site. An untracked summoner gets no explanation. | Run independent queries with `Promise.all`, and cache the response per summoner, invalidated when ingestion writes a new match. Add a themed skeleton `loading.tsx`, a friendly `error.tsx` with retry, and a `not-found.tsx` ("This summoner isn't tracked yet"). |
| H-05 | 🟠 | FEATURE | Whole page | **[Observed]** No time filter at all: every number is all-time. Arena changes significantly every patch. | Old-patch performance pollutes current insights; improvement is invisible. | Global filter bar: Last 20 games / Last 30 days / Current patch / All time. Longer term: champion filter. |
| H-06 | 🟠 | DATA / VISUALIZATION | KDA, Damage, Ability, Utility, Kills, Picks | **[Observed]** Rankings default to totals, which mostly measure games played. The same champion leads kills, damage, casts, heal and CC because it was played most. | Four slides tell the same story ("you played X a lot"). | Default to per-game averages (and per-minute where time matters), with TOTAL as a secondary toggle. |
| H-07 | 🟠 | VISUALIZATION | KDA, Picks, Augments, Prismatic (log-scaled bars); Damage, Ability, Utility (power-scaled widths) | **[Observed]** Bar heights use `logBarHeight` (log, then `^1.6`) and widths use `ratio^0.55`, with no axis or disclosure. KDA additionally uses a raised floor. A bar at half the leader's height doesn't mean half the value. | Visual comparisons are silently distorted. | Use linear scales from zero with the exact value labeled. If the long tail is illegible, show the top N plus "others", or switch to a sorted list, rather than distorting the scale. |
| H-08 | 🟠 | UX / ARCHITECTURE | Welcome, Farewell, ThankYou | **[Observed]** The page begins and ends with no summary and no call to action: no recent form, no headline stats on Welcome; no "compare with a friend", "back to top" or "view match history" at the end. ThankYou adds a second empty ending screen. | The story has no hook and no payoff. | Welcome: add a 4-stat strip (games, avg placement, top-3 rate, 1st rate) plus a last-10-placements strip. Merge Farewell and ThankYou into one closing screen with CTAs. |

---

## Slide-by-Slide Review

Slide order as rendered in [stats-view.tsx](apps/web/src/app/summoner/%5Bplatform%5D/%5BriotId%5D/stats-view.tsx):

| # | Slide (on-screen title) | Module | # | Slide | Module |
|---|---|---|---|---|---|
| 1 | Welcome | `Welcome` | 16 | AUGMENT CRAFTING | `MetaAugments` |
| 2 | PLACEMENT | `Positions` | 17 | PRISMATIC ITEMS | `PrismaticItemPicks` |
| 3 | TIME | `TimePlayed` | 18 | PRISMATIC GOD | `PrismaticItemHallOfFame` |
| 4 | TEAM | `TeamSlot` | 19 | ANVILS | `Anvils` |
| 5 | KDA | `KDA` | 20 | SPECIAL ITEMS | `SpecialItems` |
| 6 | KILLS | `Kills` | 21 | VAULT | `Vault` |
| 7 | PICKS | `ChampionPicks` | 22 | BOOTS | `Boots` |
| 8 | COLLECTION | `ChampionGallery` | 23 | ABILITY CASTS | `Ability` |
| 9 | ARENA GOD | `Champions` | 24 | UTILITY | `Utility` |
| 10 | BANS | `BannedChampions` | 25 | TEAM SYNERGY | `TeamSynergy` |
| 11 | DMG DEALT | `Damage` | 26 | TEAMMATES | `Teammates` |
| 12 | DMG TAKEN | `DamageTaken` | 27 | NEMESIS | `Nemesis` |
| 13 | AUGMENTS | `AugmentPicks` | 28 | Pings | `Pings` |
| 14 | AUGMENT GOD | `AugmentHallOfFame` | 29 | Farewell (fist bumps) | `Farewell` |
| 15 | GUESTS OF HONOR | `GuestOfHonor` | 30 | THANK YOU | `ThankYou` |

---

### Slide 1 — Welcome

#### What works
- A strong, cinematic opening: identity ring, oversized name, level badge in a diamond, corner brackets. It immediately says "this is about *you*."
- The sharper `blur(2px)` background differentiates it from content slides.

#### Issues

| ID | Priority | Type | Issue | Impact | Recommendation |
|---|---|---|---|---|---|
| S01-1 | 🔴 | DATA | **[Observed]** "SEASON 3" is a hard-coded placeholder (C-08). | Fabricated information. | Replace with a tracked date range or games tracked. |
| S01-2 | 🟠 | UX | **[Observed]** No stats at all on the opening screen. | The strongest real estate says nothing about performance, so users must scroll to learn anything. | Add a compact strip: GAMES · AVG PLACE · TOP 3 % · 1ST %, plus a last-10 placement pip row (colored 1st/top-3/rest). |
| S01-3 | 🟡 | RESPONSIVE | **[Likely]** The name is `text-[92px]` with no wrapping or fitting strategy. Riot game names can be 16 characters, which at 92px Beaufort is ~1,000px+ before the tag, so it's clipped by `overflow-hidden` on ≤1280px screens. | Long names are cut off. | Use a fit-to-width approach (the same measure-and-scale technique `Dial` already uses) or `clamp()` sizing. |
| S01-4 | 🟡 | ACCESSIBILITY | **[Observed]** "SCROLL TO BEGIN" is a clickable `div`. The name is a `div`, not an `h1`, and the page has no `h1` at all. | No keyboard path; no document outline. | `<h1>` for the Riot ID; `<button>` for the cue. |
| S01-5 | 🟢 | UX | **[Observed]** No "last updated" or data-freshness indicator anywhere. | Users can't tell whether last night's games are included. | "Last match ingested 2h ago" under the region/season chip. |

#### Missing opportunities
- Recent form (last 10 placements) is the single most glanceable Arena summary.
- Links out: "Compare with…" (tracked friends) and "Match history".

---

### Slide 2 — Placement

#### What works
- Data-driven placement columns (not hard-coded 1–8) respect charter §2.
- Top-1 and top-3 streaks are a nice touch.
- Diamond ordinal badges under the bars read well.

#### Issues

| ID | Priority | Type | Issue | Impact | Recommendation |
|---|---|---|---|---|---|
| S02-1 | 🟠 | CONTENT | **[Observed]** No average placement (H-01). The dial shows GAMES PLAYED, the least insightful number. | The page's most important metric is absent. | Dial → AVG PLACEMENT (e.g. "2.84"); move games into the stat rows. |
| S02-2 | 🟠 | BUG | **[Observed]** Bar tier is assigned by column *index* ([Positions/index.tsx:52](apps/web/src/modules/Positions/index.tsx#L52)), and the API only returns placements that occurred. A summoner with zero 1st-place finishes gets their **2nd-place bar colored prismatic**. | Wrong semantic color in exactly the case where it matters emotionally. | Tier by placement number (`1 → prismatic`, `2–3 → gold`, else silver). Have the API return zero counts for every placement up to the max seen. |
| S02-3 | 🟡 | CONTENT | **[Observed]** Labels "WINRATE %" (redundant %) and "WINRATE STREAK"; "win" isn't defined. | Ambiguity. | "TOP 3 RATE", "TOP 3 STREAK", with caption "Win = top-3 finish". |
| S02-4 | 🟡 | VISUALIZATION | **[Observed]** Bars show counts only, with no share of games. | Hard to compare against intuition ("do I finish 1st 1 in 6 games?"). | Label each bar "42 · 13%". Add a dashed line for the uniform expectation (1/teams) so users see whether they beat random. |
| S02-5 | 🟢 | ARCHITECTURE | **[Observed]** Module is named `Positions` but titled PLACEMENT. | Minor confusion when maintaining. | Rename to `Placement`. |

#### Missing opportunities
- **Placement trend:** rolling 20-game average placement over time. It answers "Am I improving?", the most important question the page currently can't answer.
- **Current streak** (the API already computes streak logic).

---

### Slide 3 — Time

#### What works
- The TimeRange calendar (with the vendored nivo fix) and continuous tier gradient look polished. Clicking a day to populate the detail band is a good pattern.
- The polar "by hour" chart is a fitting, compact form.

#### Issues

| ID | Priority | Type | Issue | Impact | Recommendation |
|---|---|---|---|---|---|
| S03-1 | 🟡 | CONTENT / BUG | **[Observed]** The caption reads "MATCHES BY DATE · SORTED · BY HOUR" while showing the hour chart, and the tabs are called "SORTED" although they change the *coloring*, not the order. | Misdescribes the view. | Caption per mode: "ACTIVITY BY DAY · COLORED BY GAMES", "…BY AVG PLACEMENT", "GAMES BY HOUR OF DAY". |
| S03-2 | 🟡 | CONTENT | **[Observed]** The "BY WINS" tab actually colors by *average placement*. | Label/data mismatch. | Rename "BY PLACEMENT". |
| S03-3 | 🟡 | DATA / UX | **[Observed]** Days and hours are bucketed in UTC and the UI never says so. For EUW players, hours are off by 1–2h and late-night games land on the next day. | "I play most at 20:00" reads as 19:00 or 18:00. | Bucket in the viewer's timezone client-side (send timestamps), or at least label "UTC". |
| S03-4 | 🟡 | UX | **[Observed]** The detail band disappears in hour mode, so the panel layout jumps. There's no hour-level detail. | Layout shift; less insight. | Keep the band and show the selected hour's games, avg placement and top-3 rate. |
| S03-5 | 🟢 | CONTENT | **[Observed]** Weekday labels `["D","M","T","W","T","F","S"]`: "D" for Sunday looks like a French leftover ("Dimanche"). | Odd label. | Use "S". |
| S03-6 | 🟢 | ARCHITECTURE | **[Observed]** A local duplicate of `SidebarStatRow`, plus unused `gamesPlayed`, `hours`, `minutes` (lint warnings). | Drift. | Use the shared `SidebarStatRow`. |
| S03-7 | 🟢 | DATA | **[Observed]** The API computes `currentStreakDays`, `mostGamesInADay` and `favoriteDayOfWeek`, but they're never displayed. | Wasted computation; lost fun facts. | Surface them in the sidebar, or stop computing them. |

#### Missing opportunities
- **Performance by hour/weekday** (avg placement, not just volume). Answers "When do I play best?"
- **Session fatigue:** avg placement by game number within a day ("games 1–3 avg 2.6, games 7+ avg 3.9"). Answers "Should I stop after a few games?", a genuinely actionable insight.

---

### Slide 4 — Team (Team Slot)

#### What works
- The team crests are a charming, authentic touch, and the stacked tier bars are clear.

#### Issues

| ID | Priority | Type | Issue | Impact | Recommendation |
|---|---|---|---|---|---|
| S04-1 | 🟠 | UX / CONTENT | **[Observed]** Lobby slot is an arbitrary per-match assignment (the type docs say so), so outcomes by slot are expected to be random. The slide has little to tell a player and sits in prime early position. | Spends a top-4 slot on noise. | Demote it to a small "fun fact" card in a later wrap-up slide, or remove it. If kept, show rates rather than raw counts and note that slot is random. |
| S04-2 | 🟡 | VISUALIZATION | **[Observed]** Raw stacked counts; slots with more games look "better". | Misleading comparison. | Normalize to 100% stacked bars, with n under each crest. |
| S04-3 | 🟡 | BUG | **[Observed]** `boxShadow: "rgba(10,200,185,.75)"` is invalid CSS (a color with no offsets), so the intended crest glow never renders ([TeamSlot.tsx:136](apps/web/src/modules/TeamSlot.tsx#L136)). | The intended glow silently doesn't appear. | `0 0 18px rgba(10,200,185,.35)`. |
| S04-4 | 🟡 | UX | **[Observed]** No `nextSectionLabel`, so this is the only early slide with no "next" cue. Time's cue says "TEAMS" but the title is "TEAM". | Inconsistent flow. | Generate cues from the slide registry (X-3). |
| S04-5 | 🟢 | ARCHITECTURE | **[Observed]** A local `SEGMENT_TIER` duplicates `TIER_STYLE` byte for byte. | Drift risk. | Import `TIER_STYLE`. |

---

### Slide 5 — KDA

#### What works
- The FLIP icon animation on re-sort is excellent, and "taller is better" inversion for fewest deaths is thoughtful.
- The detail band gives a rich per-champion readout.

#### Issues

| ID | Priority | Type | Issue | Impact | Recommendation |
|---|---|---|---|---|---|
| S05-1 | 🔴 | BUG | **[Observed]** BEST GAME kills/assists/deaths read the best-*KDA* match (C-07). | Wrong ranking. | Use `mostKills`/`mostAssists`/a min-deaths record. |
| S05-2 | 🟠 | VISUALIZATION | **[Observed]** TOTAL · DEATHS sorts descending, so the champion with the **most deaths** gets the tallest bar in prismatic, contradicting the stated "taller must mean better" rule. | Rewards the worst result with the best color. | Invert deaths in TOTAL mode too, or use a neutral color for deaths. |
| S05-3 | 🟠 | DATA | **[Observed]** Totals conflate volume with performance (H-06), and KDA/best-game have no sample floor (C-06). A 1-game champion with a 15.0 KDA leads. | Noise dominates. | Per-game averages by default; min 5 games for KDA ranking. |
| S05-4 | 🟠 | VISUALIZATION | **[Observed]** Log height, `^1.6` curve, and for KDA a raised floor, with no axis (H-07). | Misleading proportions. | Linear from zero, value labels (already present). |
| S05-5 | 🟡 | UX | **[Observed]** The chart shows every champion ever played (60+) in a horizontal scroller with 36px icons. Champions beyond the viewport are invisible, and nothing hints that it scrolls. | Most data hidden; scroll affordance weak. | Show the top 15 by default with a "show all" toggle, plus an edge fade/arrow when overflowing. |
| S05-6 | 🟡 | CONTENT | **[Observed]** Caption "SEASON TOTAL" (no seasons exist). | Inaccurate. | "ALL TRACKED GAMES". |
| S05-7 | 🟢 | ARCHITECTURE | **[Observed]** The sidebar K/D/A rows are a third hand-rolled copy of `SidebarStatRow`. Page-level `mostKills`, `mostDeaths`, `mostAssists` and `bestKda` are sent but unused. | Drift; unused data. | Use `SidebarStatRows`; show career records (MOST KILLS · BEST KDA) in the sidebar. |

#### Missing opportunities
- **KDA vs placement:** does a higher-KDA game actually mean a better finish? A small scatter or a "KDA in top-3 games vs other games" pair answers "Does my fighting win games?"

---

### Slide 6 — Kills (Multikills)

#### What works
- The tiered diamond "plates" (Double → Penta) are a memorable, on-brand hierarchy.
- De-cumulating Riot's multikill counters is correct in intent.

#### Issues

| ID | Priority | Type | Issue | Impact | Recommendation |
|---|---|---|---|---|---|
| S06-1 | 🟡 | DATA | **[Observed/verify]** `exactDouble = doubleKills − tripleKills` assumes Riot's counters are cumulative. If any aggregate breaks that assumption, the plate shows a negative number. | Potential "−3 DOUBLE". | Clamp at 0 and verify against raw payloads once; document the finding in CLAUDE.md §2. |
| S06-2 | 🟡 | CONTENT | **[Observed]** Record group headings "ACE IN THE HOLE" / "SPRAY AND PRAY" are playful but don't describe their contents ("FLAWLESS ACES" sits under "SPRAY AND PRAY"). "LARGEST MULTIKILL" shows a bare number ("4") rather than "QUADRA". | Cognitive load. | Headings "OPENERS" / "STREAKS"; render the multikill as its name. |
| S06-3 | 🟡 | RESPONSIVE | **[Likely]** Four 126px rotated plates (~178px diagonal) with `gap-32` need ~1,100px of panel width, so they clip below ~1,300px viewport width. | Pentas cut off on laptops. | Fluid `gap` (`clamp`) or a 2×2 grid when narrow. |
| S06-4 | 🟡 | DATA | **[Observed]** Counts only: no per-100-games rate and no "which champion got the pentas". | Low insight. | "3 PENTAS · on Samira ×2, Master Yi ×1" with click-through to the dossier. |
| S06-5 | 🟢 | UX | **[Observed]** Overlaps heavily with KDA; two slides for combat highlights. | Page length. | Merge into KDA as a "Highlights" footer (see [IA](#product--information-architecture)). |

---

### Slide 7 — Picks (Champion Picks)

#### What works
- The stacked 1st/top-3/rest segments per champion show outcome distribution at a glance, and the ring portrait sidebar is attractive.

#### Issues

| ID | Priority | Type | Issue | Impact | Recommendation |
|---|---|---|---|---|---|
| S07-1 | 🔴 | DATA | **[Observed]** "BY 1ST RATE" has no sample floor (C-06). | Noise ranks first. | Min sample / shrinkage; show n. |
| S07-2 | 🟠 | VISUALIZATION | **[Observed]** The bar total is log-scaled, but segments are linear shares of that log total, so segment heights aren't comparable across champions (a 2-win segment is drawn at different heights on different champions). | Misreads of win counts. | Linear scale. Or a 100% stacked view sorted by top-3 rate with n labeled. |
| S07-3 | 🟡 | BUG | **[Observed]** The segment `title` tooltip says "N picks" for the 1st, top-3 and rest segments alike ([ChampionPicks.tsx:136](apps/web/src/modules/ChampionPicks.tsx#L136)). | Wrong tooltip meaning. | "N 1st-place finishes" / "N 2nd–3rd finishes" / "N 4th+ finishes". |
| S07-4 | 🟡 | UX | **[Observed]** There's no "BY TOP 3 RATE" sort even though the sidebar leads with top-3 rate, and the "#N OF M PICKED" rank label silently changes meaning under the rate sort. | Inconsistent mental model. | Add a TOP 3 RATE sort and label the rank by sort ("#3 BY 1ST RATE"). |
| S07-5 | 🟡 | UI | **[Observed]** The sidebar portrait upscales the 120×120 Data Dragon icon to 150px, so it's soft/blurry. | Visible quality loss at the focal point. | Use the loading-screen art cropped to the face, or keep the icon ≤120px. |
| S07-6 | 🟢 | ARCHITECTURE | **[Observed]** `avgLineBottom` is computed but never rendered (dead code; also linear while the bars are log). Quote has a French-style space before "?". | Dead code; typo. | Remove or render a (linear) average line; fix the typo. |
| S07-7 | 🟡 | UX | **[Observed]** Picks, Collection and Arena God are three consecutive slides about "your champions", with overlapping data (picks, top-3, 1st). | Redundancy. | Merge (see [IA](#product--information-architecture)). |

#### Missing opportunities
- **Champion performance vs your baseline** ("Samira: 61% top-3, +14pp vs your average, 23 games"). This is the real answer to "Which champions am I best with?"

---

### Slide 8 — Collection (Champion Gallery + Dossier)

#### What works
- **The best interaction on the page.** The coverflow with momentum, keyboard support, a `listbox` role and reduced-motion handling is carefully engineered.
- The dossier is a strong, dense drill-down, with honest labeling of *where* item counts come from ("HELD AT END" vs "PAIRS BOUGHT").
- The TOTAL/BEST GAME toggle correctly uses single-match donuts for BEST.

#### Issues

| ID | Priority | Type | Issue | Impact | Recommendation |
|---|---|---|---|---|---|
| S08-1 | 🔴 | UX | **[Observed]** Wheel capture traps page scroll (C-10). | Users get stuck. | Release the wheel at gallery ends / only capture horizontal intent. |
| S08-2 | 🟠 | UX | **[Observed]** No search, sort or filter across 60+ cards. Finding "Yone" means scrolling through the deck. | Slow to use. | Type-to-jump (listbox typeahead) plus sort chips (Most played / Best top-3 rate / A–Z). |
| S08-3 | 🟠 | DATA | **[Observed]** The dossier's Legendary item row uses end-of-match inventory ("HELD AT END"), while the Vault slide uses bought ∪ held for the same "Legendary items" concept. The two views disagree for the same champion, and an item that was bought and later sold never appears in the dossier. | Contradictory numbers between slides. | Source both from `purchased_item_ids ∪ items`, as Vault does. The project's standing rule is that item-acquisition stats come from the timeline, and only genuinely end-state questions use `items`. |
| S08-4 | 🟡 | DATA / CONTENT | **[Observed]** "CC SCORE" is rendered with a " pts" suffix, but the value is seconds (`timeCCingOthers`). Utility shows it unitless, and "CC TIME DEALT" is shown as h/m. | The same unit is shown three ways. | Present CC score as a duration everywhere ("4m 12s"), or define "CC score" once in a tooltip. |
| S08-5 | 🟡 | BUG | **[Observed]** The boots row tooltip "(X% of games)" uses `timesBought / games`, which exceeds 100% when a pair is bought twice in one match. | Impossible-looking value. | "bought 14× in 9 of 12 games", or drop the percentage for boots. |
| S08-6 | 🟡 | UX | **[Observed]** The ITEMS rows `overflow-hidden` silently cut off items beyond the row width, with no "+N". | Hidden data. | Show "+N" overflow chip with tooltip list. |
| S08-7 | 🟡 | RESPONSIVE | **[Likely]** The dossier's 4-column grid plus the 236px identity column needs ~1,300px of panel width, and its `overflow-y-auto` creates a nested scroller inside a snap section on shorter screens. | Cramped/clipped on laptops. | 2-column dossier grid below 1440px; `overscroll-behavior: contain`. |
| S08-8 | 🟡 | CONTENT | **[Observed]** In BEST GAME mode the ECONOMY group swaps "GOLD / GAME" for "LONGEST GAME" (not an economy stat). "BEST SPREE" stays constant across modes. | Group semantics drift. | Keep groups semantically stable; move longest game to the identity column. |
| S08-9 | 🟢 | ACCESSIBILITY | **[Observed]** Donut hover read-outs are pointer-only. | No keyboard access to shares. | Legend rows as focusable buttons driving the same state. |

#### Missing opportunities
- **Champion × augment combos** (charter priority #2): "Best augments on this champion" belongs in the dossier.
- **Recent games on this champion** (link to match history).
- **Deep link** `…#collection/samira`.

---

### Slide 9 — Arena God (Champion Hall of Fame)

#### What works
- A whole-roster grid with tier rings is a satisfying "collection" view. The static silver ring (to avoid 171 shimmering rings) shows good restraint.

#### Issues

| ID | Priority | Type | Issue | Impact | Recommendation |
|---|---|---|---|---|---|
| S09-1 | 🟠 | CONTENT / UX | **[Observed]** Titled "ARENA GOD", but it never shows progress toward it. The header shows PLAYED/WON WITH/FIRST PLACE counts without denominators. | Misses the most motivating framing on the page. | Hero progress: "FIRST-PLACE WINS ON 23 / 171 CHAMPIONS", with a progress ring (it mirrors League's own Arena God challenge). Add a filter: "Not yet won with". |
| S09-2 | 🟡 | UX | **[Observed]** Icons aren't interactive (only native `title` tooltips). | Dead end; the dossier exists one slide earlier. | Click a played champion → open its dossier. Hover card: games / best finish / top-3 rate. |
| S09-3 | 🟡 | CONTENT | **[Observed]** "WON WITH" means top-3 here while "FIRST PLACE" means 1st; there's no explanation. | Ambiguous. | "TOP 3 WITH" / "1ST WITH", or the glossary tooltip. |
| S09-4 | 🟡 | RESPONSIVE | **[Observed]** `GRID_COLUMNS = 22` is tuned for one measured viewport (comment: 1600×900). | Tiny icons on 1280px; overflow scrollbar on short screens. | `grid-template-columns: repeat(auto-fill, minmax(44px, 1fr))`. |
| S09-5 | 🟢 | ARCHITECTURE | **[Observed]** `RING_WIDTH`, `tierFor` and `frameClassName` are re-declared here although `card-frame.tsx` already exports them (4 copies across modules). | Drift. | Import from `card-frame.tsx`; build one `HallOfFameGrid` component (X-4). |

---

### Slide 10 — Bans

#### What works
- An ambitious, genuinely Arena-specific idea: correlating ban presence with your results.
- The combined row design (ban-rate bar + swing rail + win%) is information-dense and consistent with the row-list template.

#### Issues

| ID | Priority | Type | Issue | Impact | Recommendation |
|---|---|---|---|---|---|
| S10-1 | 🔴 | CONTENT / DATA | **[Observed]** Wrong footer semantics and "NO BAN %" denominator (C-11). | Misleading. | Rewrite; fix the denominator. |
| S10-2 | 🔴 | DATA | **[Observed]** "BIGGEST SWING" sorts by `abs(winRateWhenNotBanned − baseline)` with no sample floor, and the sample size ("times open and picked") is never shown. | The biggest swings are one-game flukes. | Min sample, show n, sort by shrunk delta. |
| S10-3 | 🟠 | VISUALIZATION | **[Observed]** The swing rail maps 17px per percentage point and clamps at ±108px, so **everything beyond ±6.4pp looks identical**. There are no tick labels. | Big and moderate effects are indistinguishable. | Scale the rail to the data's max absolute delta (or a fixed ±25pp) with tick marks at ±10/±20. |
| S10-4 | 🟠 | UX / CONTENT | **[Observed]** Bans are lobby-wide with no banner attached (charter §2), yet the slide reads as if it's about the summoner. The dial "TOTAL BANS" (≈ 17 × games) is uninformative. | Confusing framing; wasted focal point. | Reframe: "BANS IN YOUR LOBBIES". Replace the dial with "YOUR MAINS BANNED" (the % of games where one of your top-3 champions was banned), which is personally meaningful. |
| S10-5 | 🟡 | CONTENT | **[Observed]** Differences are labeled "%" ("+4.2%") but are percentage points. The same applies in Vault. | Statistically incorrect notation. | "+4.2 pp". |
| S10-6 | 🟢 | ARCHITECTURE | **[Observed]** Inline copy of `FadingRule`; `CountPercentValue` duplicates `ValuePercentRow` / `GoldShareValue`. | Drift. | Reuse shared components. |

---

### Slides 11–12 — Damage Dealt / Damage Taken

#### What works
- Sharing one component for dealt/taken is the right call. The physical/magical/true palette is consistent with the dossier.
- Sortable column headers plus metric tabs, and a detail band with "% of total".

#### Issues

| ID | Priority | Type | Issue | Impact | Recommendation |
|---|---|---|---|---|---|
| S11-1 | 🟠 | DATA | **[Observed]** Totals by default: the most-played champion leads (H-06). There's no per-game or per-minute damage anywhere on the page. | "Which champion do I deal the most damage on?" can't be answered. | Default metric DMG / GAME; add DMG / MIN; keep TOTAL as a toggle. |
| S11-2 | 🟠 | VISUALIZATION | **[Observed]** Bar widths use `ratio^0.55` (H-07): a champion with ⅓ of the leader's damage draws at ~55% width. | Distorted comparison. | Linear widths. |
| S11-3 | 🟡 | UX | **[Observed]** In BEST GAME mode, the TOTAL column is one real match while PHYS/MAGIC/TRUE are each independently maxed across matches, so a row's parts don't add up to its total. No explanation is shown. | Looks like an arithmetic bug. | Tooltip or caption "Each column is its own record", or use `maxGame` parts consistently. |
| S11-4 | 🟡 | BUG | **[Observed]** The detail band always shows season totals, even in BEST GAME mode. | The mode toggle appears to not affect the band. | Make the band mode-aware. |
| S11-5 | 🟡 | UX | **[Observed]** Two nearly identical back-to-back slides. Damage *taken* ranked descending has no clear good/bad direction. | Page length; ambiguous meaning. | Merge into one DAMAGE slide with a DEALT/TAKEN toggle, and add a "damage share" or "dealt : taken ratio" column. |
| S11-6 | 🟢 | CONTENT | **[Observed]** Title "DMG DEALT", while the previous slide's cue says "DAMAGE". | Label mismatch. | Registry-driven cues (X-3). |

#### Missing opportunities
- **Damage share of team** (your damage / your team's damage) is a much better Arena "carry" metric than raw damage, and the data is already in `match_participants`.

---

### Slide 13 — Augments (Augment Picks)

#### What works
- The rarity filter plus sort is the right control set, and the selection fallback when the filter removes the selected item is handled thoughtfully.

#### Issues

| ID | Priority | Type | Issue | Impact | Recommendation |
|---|---|---|---|---|---|
| S13-1 | 🔴 | DATA | **[Observed]** No sample floor on "BY 1ST RATE" (C-06). | Noise. | Shared rule. |
| S13-2 | 🟠 | DATA | **[Likely — verify]** **Survivorship bias.** Augments are offered at fixed rounds, so a team eliminated early holds fewer augments. Augments that tend to be picked *later* are then over-represented in good finishes regardless of their strength. | Late-round augments look stronger than they are. | Verify (non-zero augment count vs placement). If confirmed, compare each augment against the baseline *for the same augment slot/round*, or show the slot. |
| S13-3 | 🟠 | UI | **[Observed]** The PRISMATIC *rarity* tab sits directly above prismatic *1st-place* segments (H-02). | Same color, two meanings on one screen. | Use rarity colors only for rarity (icon ring); outcome segments use the dedicated outcome palette. |
| S13-4 | 🟡 | BUG | **[Observed]** `isSelected` compares against `selectedAugmentId` rather than the resolved `selected`, so after a filter change the sidebar shows `sorted[0]` but no bar is highlighted. | Selection state out of sync. | Compare against `selected?.augmentId`. |
| S13-5 | 🟡 | UX | **[Observed]** Potentially 150+ augment columns in a horizontal scroller. | Mostly hidden. | Top 20 by default, then "show all". Or a sortable table (icon, name, rarity, picks, top-3 %, Δ baseline). |
| S13-6 | 🟡 | BUG | **[Observed]** Cue label "HALL OF FAME" vs next title "AUGMENT GOD". | Mismatch. | X-3. |

#### Missing opportunities
- **Champion + augment combos** (charter priority #2): "Your best augments on Samira".
- **Augment offered vs picked** isn't available from Riot, so don't attempt it. Note it in CLAUDE.md so no one tries.

---

### Slide 14 — Augment God (Augment Hall of Fame)

#### What works
- The dynamic column solve for filtered counts is thoughtful. The grid looks complete and collectible.

#### Issues

| ID | Priority | Type | Issue | Impact | Recommendation |
|---|---|---|---|---|---|
| S14-1 | 🟡 | RESPONSIVE | **[Observed]** `PANEL_CONTENT_WIDTH = 1368` / `HEIGHT = 455` are hard-coded measurements of one viewport. | Wrong column count on any other size. | Measure with `ResizeObserver` (as the coverflow does), or use CSS `auto-fill`. |
| S14-2 | 🟡 | UX | **[Observed]** Non-interactive icons, native tooltips only. | Dead end. | Hover card (rarity, picks, top-3 %); click selects the augment on the Augments slide. |
| S14-3 | 🟡 | UX | **[Observed]** Two augment slides show the same data in two forms. | Redundancy. | Merge as views of one slide: CHART / COLLECTION toggle. |
| S14-4 | 🟢 | ARCHITECTURE | **[Observed]** Third copy of the hall-of-fame grid logic. | Drift. | `HallOfFameGrid` (X-4). |

---

### Slide 15 — Guests of Honor

#### What works
- The accordion of splash art is visually striking. The framed cards use Riot's real card art, and compact cards for large sets is a sensible adaptation.

#### Issues

| ID | Priority | Type | Issue | Impact | Recommendation |
|---|---|---|---|---|---|
| S15-1 | 🟠 | CONTENT | **[Observed]** No explanation of the mechanic. Even many Arena players won't know that these augments come from a *teammate* being Vayne/Kindred/Yone/Tahm Kench. | Slide is opaque to most viewers. | One-line explainer under the title: "When one of these champions is on your team, you can receive their exclusive augments." |
| S15-2 | 🟡 | UX | **[Observed]** Hover-to-expand ("HOVER A CHAMPION TO OPEN THEIR LINE"): sweeping the pointer across the panel triggers several expansions, and there's no hover on touch. | Flicker; mobile-hostile. | `trigger="click"` with the first panel open, or hover with a ~150ms intent delay. Copy: "SELECT A CHAMPION". |
| S15-3 | 🟡 | DATA | **[Observed]** "WON" in the stat row means top-3 finishes; the label is unexplained and differs from everywhere else (X-2). | Terminology drift. | Glossary term "TOP 3". |
| S15-4 | 🟢 | CONTENT | **[Observed]** Display names are used here while the rest of the app uses Riot keys (C-02), and `iconName()` strips spaces as a workaround. | Inconsistent. | Resolves with C-02. |

---

### Slide 16 — Augment Crafting (Meta Augments)

#### What works
- A real framed-card presentation for a real mechanic, with honest tiering by best finish.

#### Issues

| ID | Priority | Type | Issue | Impact | Recommendation |
|---|---|---|---|---|---|
| S16-1 | 🟠 | UX | **[Observed]** A 5-item set is shown in a coverflow designed for 60+ cards, so neighbors are dimmed and turned away when all five could sit flat side by side. The coverflow also traps the wheel (C-10). | Hides content that would fit; scroll trap. | A flat row of five framed cards. |
| S16-2 | 🟡 | CONTENT | **[Observed]** No explanation of what augment crafting is; the header is only "5 AUGMENTS" with no rule, unlike other panels. | Opaque; visually inconsistent. | One-line explainer and the standard header row. |
| S16-3 | 🟡 | UX | **[Opportunity]** A standalone slide for 5 numbers. | Page length. | Merge with Guests of Honor into "SPECIAL AUGMENTS". |

---

### Slides 17–18 — Prismatic Items / Prismatic God

#### What works
- Consistent with the augment pair. The curated prismatic catalog is well documented.

#### Issues

| ID | Priority | Type | Issue | Impact | Recommendation |
|---|---|---|---|---|---|
| S17-1 | 🔴 | DATA | **[Observed]** No sample floor on "BY 1ST RATE" (C-06). | Noise. | Shared rule. |
| S17-2 | 🟠 | DATA | **[Likely]** Survivorship bias again: holding a Prismatic item at match end correlates with surviving long enough to afford the anvil. Every prismatic item will look like it "wins". | Misleading item strength. | Show Δ vs your baseline *in games where you held any prismatic item*, not vs all games. |
| S17-3 | 🟡 | CONTENT | **[Observed]** Tooltip vocabulary differs between the three picks charts ("N picks" vs "N games"); the square item icon sits in a circular ring. | Inconsistency. | Shared `OutcomeStackChart` (X-4); rounded-square ring for items. |
| S18-1 | 🟡 | UX | **[Observed]** Two slides for 49 items; the grid is non-interactive. | Page length; dead end. | Merge (CHART / COLLECTION toggle) like augments. |

---

### Slide 19 — Anvils

#### What works
- The Shardblade medallion with the spinning tick dial is one of the most beautiful compositions on the page.

#### Issues

| ID | Priority | Type | Issue | Impact | Recommendation |
|---|---|---|---|---|---|
| S19-1 | 🟠 | CONTENT / DATA | **[Observed]** Titled ANVILS, but the panel is about the Shardblade (not an anvil). The anvil split the API sends (`anvils.stat/legendary/prismatic`, `anvilGoldSpent.*`, `mostStatAnvilsInOneMatch`) is summed into one dial and never shown. | The slide doesn't answer "what anvils do I buy?" | Panel: three anvil tiers (count, gold, per game). Move the Shardblade to Special Items, where it belongs thematically. |
| S19-2 | 🟡 | CONTENT | **[Observed]** Same quote as Vault ("Gold is the only thing that never lies."); "MOST IN ONE RUN" vs "game" elsewhere. | Repetition; terminology drift. | Unique quote; "MOST IN ONE GAME". |
| S19-3 | 🟡 | RESPONSIVE | **[Likely]** Content is absolutely positioned at `top-[36%]` plus `mt-[182px]` plus an 80px number and the rate pair inside `overflow-hidden`, so the rates clip on viewports under ~850px tall. | Key numbers hidden on laptops. | Flex column layout; scale the medallion with `clamp()`. |
| S19-4 | 🟡 | DATA | **[Observed]** Shardblade WIN/TOP 1 rates have no baseline tick (Vault has one). | Can't tell good from normal. | Add "vs your average" deltas. |

---

### Slide 20 — Special Items

#### What works
- The reliquary cards with blurred item-color backdrops look premium.

#### Issues

| ID | Priority | Type | Issue | Impact | Recommendation |
|---|---|---|---|---|---|
| S20-1 | 🟡 | BUG / CONTENT | **[Observed]** The code strips a leading "The " from every name and then **always** renders "THE" above it, so the cards read "THE / WOOGLET'S WITCHCAP" and "THE / VOID IMMOLATION" ([SpecialItems.tsx:23, 55](apps/web/src/modules/SpecialItems.tsx#L23)). | Incorrect item names. | Render the "THE" eyebrow only when the original name started with it. |
| S20-2 | 🟡 | UI | **[Observed]** The only content slide without a `HextechPanel`; there's no baseline and no explanation of how each item is obtained. | Visual inconsistency; missing context. | Keep the cards but add a one-line "how you get it" per card and a baseline delta. |
| S20-3 | 🟢 | RESPONSIVE | **[Likely]** 190px medallion + 60px number + name + rate pair per card clips under ~800px of height. | Clipping. | Scale with `clamp()`. |

---

### Slide 21 — Vault

#### What works
- **The best statistical design on the page:** a minimum sample (≥5) with dimmed low-sample rows, rate bars with a baseline tick, explicit "WIN = TOP 3 FINISH" copy, and "vs baseline" in the detail band. Use it as the template for every rate view.

#### Issues

| ID | Priority | Type | Issue | Impact | Recommendation |
|---|---|---|---|---|---|
| S21-1 | 🟡 | CONTENT | **[Observed]** "VAULT" doesn't say what's inside (gold and legendary items); "TIMES PICKED" is used for items. | Discoverability. | Title "GOLD & BUILDS"; "TIMES BUILT". |
| S21-2 | 🟡 | DATA | **[Likely]** Survivorship bias as S17-2: more rounds survived means more legendaries built. | Late-game items look strong. | Baseline per "games reaching N items" or by purchase order. |
| S21-3 | 🟡 | UI | **[Observed]** Row bar tier colors by pick rank (#1 prismatic, #2–3 gold), a meaningless use of achievement colors (H-02). | Color noise. | Neutral bars. |
| S21-4 | 🟢 | CONTENT | **[Observed]** The gold dial always formats as `X.XXM` ("0.00M" for a new player); "MOST IN ONE GAME" shows a raw comma number while neighbors use compact format. "+x%" deltas should be pp. | Formatting inconsistency. | Shared `formatGold`; pp notation. |
| S21-5 | 🟢 | CONTENT | **[Observed]** "ITEMS PURCHASED" and "CONSUMABLES" totals carry little insight. | Low value. | Replace with "AVG GOLD / GAME" and "GOLD LEAD IN TOP-3 GAMES". |

#### Missing opportunities
- **Build order / first legendary** ("your most common first legendary, and its top-3 rate") from timeline purchase events. Answers "What are my strongest builds?"

---

### Slide 22 — Boots

#### What works
- Built on timeline purchase/sale events with undo correction, which is correct and well documented. "BAREFOOT FINISHES" is a genuinely Arena-specific stat.

#### Issues

| ID | Priority | Type | Issue | Impact | Recommendation |
|---|---|---|---|---|---|
| S22-1 | 🟠 | DATA / UX | **[Observed]** The slide's stated "actual story" is the sell-off, but it never connects selling boots to *outcome*. | The most interesting insight is missing. | "Sold boots: 58% top-3 · Kept boots: 44% top-3 (n=…)". Add average sell time from the timeline. |
| S22-2 | 🟡 | VISUALIZATION | **[Observed]** An 8-slice donut colored along a continuous gradient by rank: neighboring slices are near-identical colors, and the legend list next to it already shows the same ranking with bars. | Duplicate encodings; hard to distinguish slices. | Drop the donut; keep the ranked list with item icons and add share %. Or a single 100% stacked bar. |
| S22-3 | 🟡 | CONTENT | **[Observed]** "BAREFOOT FINISHES" and "GAMES WITH NO BUY" are counts without a percentage of games. | Hard to interpret. | "163 · 49%". |
| S22-4 | 🟢 | ACCESSIBILITY | **[Observed]** Hover-only focus in the donut and legend. | Mouse-only. | Focusable legend rows. |

---

### Slide 23 — Ability Casts

#### What works
- Consistent with the Damage template; the Q/W/E/R colors stay stable across the page and the dossier.

#### Issues

| ID | Priority | Type | Issue | Impact | Recommendation |
|---|---|---|---|---|---|
| S23-1 | 🟠 | UX / DATA | **[Observed]** Cast counts aren't comparable across champions (a Q on Ezreal isn't a Q on Malphite), and totals track games played. The slide answers no real player question. | Low-value full screen. | Remove as a standalone slide; keep casts in the dossier. If kept, show casts per minute on the selected champion only. |
| S23-2 | 🟡 | BUG | **[Observed]** The detail band ignores BEST GAME mode (same as S11-4). | Mode confusion. | Mode-aware band. |
| S23-3 | 🟢 | CONTENT | **[Observed]** "SKILLSHOTS HIT" lives on the Damage slide, not here. | Odd placement. | If Ability stays, move skillshot accuracy here as hit / (hit + dodged by enemies) where available. |

---

### Slide 24 — Utility

#### What works
- The tornado layout (heal ← portrait → CC) is a clever, compact dual metric, and the portrait FLIP layer is well engineered.

#### Issues

| ID | Priority | Type | Issue | Impact | Recommendation |
|---|---|---|---|---|---|
| S24-1 | 🟡 | CONTENT | **[Observed]** "SAVES" (the dial) is undefined. "CC SCORE" has no unit (it's seconds) and is displayed three different ways (S08-4). | Opaque metrics. | Tooltips: "Saves: times you prevented an ally's death (Riot challenge stat)"; CC score as duration. |
| S24-2 | 🟡 | VISUALIZATION | **[Observed]** Two independently scaled axes plus power-scaled widths: a long heal bar and a long CC bar mean different things. | Misleading symmetry. | Label each side's max and use linear scales. |
| S24-3 | 🟡 | UX | **[Observed]** Portrait-only rows (no champion names) unlike Damage/Ability, and totals rather than per game. | Recognition relies on icon knowledge. | Name on hover/focus; per-game default. |

---

### Slide 25 — Team Synergy

#### What works
- A thoughtful API: "Other" aggregation, uncapped totals, and a minimum pair sample for "best pairing".

#### Issues

| ID | Priority | Type | Issue | Impact | Recommendation |
|---|---|---|---|---|---|
| S25-1 | 🟠 | UX / CONTENT | **[Observed]** The dial "BEST DUO TOP3%" shows a percentage **without saying which pair it is**. "MOST PLAYED DUO" shows only a count. | The headline answers "how good?" but not "who?" | Show the pair's two portraits and names, top-3 rate, and n. |
| S25-2 | 🟠 | VISUALIZATION | **[Observed]** The chord diagram encodes only **co-occurrence frequency**, not performance, so the "synergy" slide doesn't show synergy. With 20 arcs, rotated 11px labels and hover-dependent reading, it's also hard to read. | Looks impressive, answers nothing. | Replace or complement it with a ranked pairs table: pair, games, top-3 %, Δ vs baseline, with a min sample. A heat-map matrix (your champion × teammate champion, color = Δ top-3 rate) is a stronger visual. |
| S25-3 | 🟡 | DATA | **[Observed]** Pairs include the summoner's *own* pick mixed with teammate–teammate pairs. | "Synergy" mixes "my champion with X" and "two teammates together". | Default to "your champion + teammate champion" pairs; teammate–teammate pairs as a secondary view. |
| S25-4 | 🟡 | CONTENT | **[Observed]** "DUO" terminology, although teams are 3 players (charter §2 supersedes duo with team synergy). | Outdated framing. | "PAIR". Add "TRIO" compositions once samples allow. |
| S25-5 | 🟡 | IA | **[Observed]** Team-related content is split between slide 4 (TEAM) and slides 25–27. | Fragmented story. | One "Your Team" chapter. |

---

### Slide 26 — Teammates

#### What works
- Distinguishing tracked FRIENDS from randoms is exactly right for a friend-group product.

#### Issues

| ID | Priority | Type | Issue | Impact | Recommendation |
|---|---|---|---|---|---|
| S26-1 | 🟠 | FEATURE | **[Observed]** Tracked friends aren't linked to their own profile pages, even though `tracked`/`region` are in the payload. | A missed core navigation path for a friend group. | Make friend rows (and the detail band) link to `/summoner/{region}/{name}-{tag}`. |
| S26-2 | 🔴 | DATA | **[Observed]** Rate sorts have no sample floor (C-06); hundreds of 1-game randoms float to the top. | Noise. | Default filter "FRIENDS ONLY" / "≥3 GAMES"; min sample on rate sorts. |
| S26-3 | 🟠 | DATA | **[Observed]** A teammate's top-3 rate is shown with no comparison to the summoner's overall rate. | "Do I do better with Alex?" can't be answered. | Δ vs baseline column (pp), colored by direction. |
| S26-4 | 🟡 | CONTENT | **[Observed]** The sidebar "BEST DUO TOP3%" shows a percentage without the name (same as S25-1). | Incomplete. | Show the name. |
| S26-5 | 🟠 | PERFORMANCE | **[Likely]** The list is unbounded and unvirtualized. With ~2 random teammates per match, a few hundred matches means hundreds to a thousand-plus DOM rows, all mounted at page load. | Slow render; heavy DOM. | Cap randoms server-side (e.g. ≥2 games) or virtualize. |

---

### Slide 27 — Nemesis

#### What works
- A head-to-head "record vs you" is a fun, social metric, and a sidebar minimum sample is applied.

#### Issues

| ID | Priority | Type | Issue | Impact | Recommendation |
|---|---|---|---|---|---|
| S27-1 | 🟠 | DATA | **[Observed]** No baseline. In a 6-team lobby, any given opponent finishes ahead of you roughly in line with your own average placement, so "beats you 55%" may be completely normal. | "Nemesis" is mostly noise. | Show expected vs actual: expected = P(random other team finishes ahead of you) from your placement distribution. Rank by the excess. |
| S27-2 | 🟡 | CONTENT | **[Observed]** "RECORD VS YOU" shows `timesBeat–timesBeatenBy`, which is *your* W-L, while the label reads as the opponent's record. | Ambiguous direction. | "YOU vs THEM: 7–4". |
| S27-3 | 🟠 | PERFORMANCE | **[Likely]** Up to ~15 opponents per match means thousands of rows, unvirtualized and always mounted. The worst list on the page. | Large DOM; slow initial render. | Server-side cap (≥2 games faced) plus virtualization. |
| S27-4 | 🟡 | FEATURE | **[Observed]** Tracked rivals aren't linked to their profiles. | Missed navigation. | Link as in S26-1. |

---

### Slide 28 — Pings

#### What works
- The real in-game ping icons, and an evidence-based mapping of Riot's counters to them (documented in code).

#### Issues

| ID | Priority | Type | Issue | Impact | Recommendation |
|---|---|---|---|---|---|
| S28-1 | 🔴 | CONTENT | **[Observed]** Placeholder quote "Allan add quote here" (C-01). | Unfinished look. | Real quote. |
| S28-2 | 🟡 | UI | **[Observed]** Title "Pings" is mixed case; every other title is uppercase. No next cue. | Inconsistency. | "PINGS"; registry cues. |
| S28-3 | 🟡 | CONTENT | **[Observed]** Tiles "Basic" and "Command" are Riot internals (and the code notes "Command" is the modern default ping). Three always-zero tiles are shown dimmed. | Confusing labels; clutter. | Rename "Command" to "Generic ping"; hide always-zero types behind "show all". |
| S28-4 | 🟢 | DATA | **[Opportunity]** No per-game rate or "ping personality". | Low insight. | "11.4 pings / game — most: Enemy Missing". Compare with friends ("the group's loudest pinger"). |

---

### Slides 29–30 — Farewell (Fist Bumps) / Thank You

#### What works
- Bookending with the Welcome composition gives the page a sense of closure, and fist bumps are a delightful, human stat.

#### Issues

| ID | Priority | Type | Issue | Impact | Recommendation |
|---|---|---|---|---|---|
| S29-1 | 🟠 | UX | **[Observed]** No call to action at the end: no back to top, no compare, no match history, no share. | Dead end after 30 screens. | CTAs: "Compare with a friend", "Match history", "Back to top", "Copy link". |
| S29-2 | 🟡 | IA | **[Observed]** Two consecutive ending screens; ThankYou carries no information. | Padding. | Merge ThankYou's sign-off into Farewell. |
| S29-3 | 🟢 | CONTENT | **[Observed]** No explanation of what a fist bump is. | Opaque to non-players. | Caption: "post-game fist bumps given". Compare with the group average. |
| S29-4 | 🟢 | ARCHITECTURE | **[Observed]** The background stack and corner brackets are copy-pasted across Welcome, Farewell and ThankYou. | Drift. | `HeroSection` component. |

---

## Cross-Slide Consistency

### X-1: One palette, seven meanings

| Meaning encoded by silver/gold/prismatic | Where |
|---|---|
| Placement outcome (1st / 2nd–3rd / 4th+) | Picks, Augments, Prismatic picks segments; Team Slot; dossier finishes |
| Rank position (#1 / #2–3 / rest) | KDA bars, Placement bars (by index), Vault item bars |
| Ban-rate threshold (>90 / >50 / rest) | Bans |
| Best-ever finish on an entity | Arena God, Augment God, Prismatic God rings; framed cards; gallery cards |
| Augment rarity | Rarity filter tabs (Augments, Augment God) |
| Activity volume (continuous) | Calendar, hour radial, Boots donut, Synergy arcs |
| Anvil type | Dossier anvil donut |

**Recommendation.** Use two semantic scales only. (1) **Outcome** (1st / top-3 / rest) keeps prismatic/gold/silver, matching the in-game emotional ladder. (2) **Rarity** also uses the in-game tiers but only on *icon rings/frames*, never on data marks. Rank and volume become a single-hue cyan (hextech magic) ramp. Document this in a `lib/semantic-colors.ts` plus a short §5 note in CLAUDE.md.

### X-2: Terminology drift

| Concept | Labels currently used | Proposed single term |
|---|---|---|
| Top-3 finish rate | WINRATE %, WIN RATE, WIN %, WIN WHEN OPEN, TOP 3 RATE, BEST DUO TOP3%, WON, WON WITH, "% top 3" | **TOP 3 RATE** (glossary: "Finishing 1st–3rd") |
| 1st-place rate | TOP 1 %, TOP 1 RATE, 1ST RATE, FIRST PLACE, TOP 1 | **1ST RATE** |
| Rate differences | "+4.2%" | **"+4.2 pp"** |
| Tracked period | SEASON 3, SEASON TOTAL | **ALL TRACKED GAMES** / date range |
| A match | game, match, run | **GAME** |
| Pairs of champions | duo | **PAIR** (teams are trios) |
| Item acquisition | picked, held, bought | **BUILT** (bought or granted) · **HELD AT END** · **BOUGHT** (boots), each with a tooltip |

### X-3: Next-section cues are hand-maintained and drift

| From | Cue label | Actual next title |
|---|---|---|
| Time | TEAMS | TEAM |
| Team | *(none)* | KDA |
| Bans | DAMAGE | DMG DEALT |
| Damage Dealt | DAMAGE TAKEN | DMG TAKEN |
| Augments | HALL OF FAME | AUGMENT GOD |
| Augment God | GUEST OF HONOR | GUESTS OF HONOR |
| Boots | ABILITY | ABILITY CASTS |
| Pings | *(none)* | Farewell |

Several modules also have stale `nextSectionLabel` defaults ("PINGS" on Utility and Teammates, "ECONOMY" on Prismatic God). **Recommendation:** a single `SLIDES` registry (`id`, `title`, `shortLabel`, `component`, `background`, `chapter`) rendered by `stats-view.tsx`. Cues, the chapter rail (C-03), `#hash` anchors and background assignment all derive from it.

### X-4: Duplicated patterns that should be components

| Pattern | Copies | Proposed component |
|---|---|---|
| "Diamond + label + value" sidebar row | `SidebarStatRow` + local copies in KDA and TimePlayed | Use the shared `SidebarStatRows` everywhere |
| Hall-of-fame ring grid (`RING_WIDTH`, `tierFor`, `frameClassName`) | Champions, AugmentHallOfFame, PrismaticItemHallOfFame, card-frame.tsx | `HallOfFameGrid` |
| Outcome-stacked picks chart plus ring sidebar | ChampionPicks, AugmentPicks, PrismaticItemPicks | `OutcomeStackChart` + `EntitySpotlight` |
| Sortable row list with FLIP icon layer | Damage, Ability, Utility | `RankedRowList` |
| Account list with sort headers and avatar fallback (`InitialAvatar` ×2) | Teammates, Nemesis | `AccountTable` |
| Value / percent fixed-column cell | `ValuePercentRow`, `CountPercentValue`, `GoldShareValue` | One `ValueShare` |
| Power-scaled `barWidthPercent` | Damage, Ability, Utility | Delete (linear scale, H-07) |
| Detail-band icon with two corner diamonds | KDA, Bans, Damage, Ability, Utility, Synergy, Vault | `FramedIcon` |
| Hero background stack plus corner brackets | Welcome, Farewell, ThankYou | `HeroSection` |
| Two `StatCell`s with different sizes/colors | header-stat-strip.tsx, detail-band.tsx | One `StatCell` with a `size` prop |
| Inline fading rule | Bans, Vault | `FadingRule` |
| `CARD_ASPECT = 155/256` | ChampionGallery, MetaAugments | Export a numeric constant from card-frame.tsx |
| Rate colors `TOP3_RATE_COLOR` / `FIRST_RATE_COLOR` | 6 modules | `lib/semantic-colors.ts` |

### X-5: Other inconsistencies

| ID | Priority | Issue | Recommendation |
|---|---|---|---|
| X-5a | 🟠 | Minimum-sample thresholds: none (picks, bans, lists), 3 (synergy API), 5 (Vault, Teammates/Nemesis sidebars). | One `MIN_SAMPLE` constant plus shared "low sample" styling. |
| X-5b | 🟡 | Number formatting: `formatCompact` (1 decimal), `formatGold` (2 decimals M, 0 decimals K), Vault dial `toFixed(2)M`, raw `toLocaleString()` for records. | `lib/format.ts` owns every formatter; ban inline formatting. |
| X-5c | 🟡 | Tooltips: native `title` (bars, grids), styled nivo tooltips (calendar, hour, boots, synergy), none (donuts, plates). | One `HextechTooltip` (Radix Tooltip, keyboard-accessible). |
| X-5d | 🟡 | Empty states: "No tracked matches yet." on some panels, while sidebars show zeros / "0.00M" / "0%" and Team Slot, Kills, Bans and Pings have none. | A `EmptyState` component plus a page-level "no games yet" screen that replaces all slides. |
| X-5e | 🟡 | Background art reused: Special Items = Prismatic Items, Vault = Time, Thank You = Welcome (intended). | Unique art per slide, or chapter-level art. |
| X-5f | 🟢 | Duplicate/near-duplicate quotes: Anvils = Vault; "Cast first. Ask questions never." vs "Peel now, ask questions never." | Unique quotes. |
| X-5g | 🟢 | `text-md` on the quote isn't a Tailwind v4 default size and isn't defined in globals.css, so the class is a no-op. | Use `text-base` or define the token. |
| X-5h | 🟢 | Row selection (tinted row plus inset gold ring) is consistent across lists, but chart selection uses "brightness" in some charts and "lift" in others. | Pick one selection language. |

---

## Missing Features

### Essential
*Features users would reasonably expect from a stats tracker.*

| Feature | Why it's essential |
|---|---|
| **Match history** (list: date, champion, placement, KDA, augments, items, teammates; click for match detail) | Charter priority #1. It's the ground truth that makes every aggregate trustworthy, and the natural drill-down from any record ("best game → open it"). |
| **Slide navigation**: chapter rail, `#hash` deep links, keyboard shortcuts (C-03) | Makes 30 (or ~18) screens usable and shareable. |
| **Home page with tracked summoners and search/switcher** (C-09) | Currently no way in. |
| **Friend-profile links** from Teammates/Nemesis/leaderboard | The social graph *is* the product for a friend group. |
| **Loading, error and not-found states** (H-04) | Basic robustness. |
| **Time range filter** (last 20 / 30 days / patch / all) (H-05) | Arena changes every patch; improvement must be visible. |
| **Glossary tooltips** for Top 3, 1st rate, pp, CC score, Saves, Guests of Honor, Augment Crafting | Removes the required domain knowledge. |
| **Responsive layout and keyboard accessibility** (C-04, C-05) | Friends open links on phones. |
| **Data freshness indicator** ("updated 2h ago") | Trust. |

### Useful
*Substantially improves the experience.*

| Feature | Value |
|---|---|
| **Friend leaderboard** (charter #4): avg placement, top-3 %, 1st %, games, most-played champion, "Arena God progress" race | The main reason friends return. |
| **Compare mode** (you vs a friend, side by side on key stats) | High social value; reuses existing components. |
| **Personal records ("Hall of Records")**: most kills, highest damage, most gold, longest game, penta list, each linked to its match | Turns scattered BEST GAME toggles into one memorable, shareable slide. |
| **Champion filter** applied page-wide ("show everything for Samira") | The dossier covers part of this; page-wide filtering generalizes it. |
| **Champion × augment explorer** (charter #2) | Answers "what should I pick on X?" |
| **Insight callouts** at the top of slides ("You finish top-3 14pp more often on Samira than on average") | Turns numbers into meaning. |
| **Share a slide**: copy link to `#slide`, and optionally an OG image per slide | Friend-group virality. |
| **Remember last filter/slide** (localStorage) | Convenience. |

### Experimental
*Could differentiate the product.*

| Idea | Why it might work |
|---|---|
| **"Season recap" / Wrapped mode**: the current slide deck, auto-played with generated captions | The page is *already* structured like Spotify Wrapped; lean into it as a special mode while the default view becomes a navigable dashboard. |
| **Tilt detector**: placement by game number in a session, with a "take a break?" note | Actionable, personal, uniquely Arena-session shaped. |
| **Elimination round analysis** from timeline `KILL_ACE` / `timePlayed` ("you usually go out in round 9–11") | Explains *why* placements are what they are. |
| **Augment-round-aware augment ratings** (controls survivorship bias, S13-2) | More honest than any public Arena site. |
| **Friend-group meta**: most-banned, most-picked and best champions across the whole crew | Fun, and it reuses the aggregation layer. |
| **Rivalry cards** for tracked-friend nemeses ("Alex has finished ahead of you 12 of 19 times") | Social banter fuel. |
| **"What if" build suggestions** from your own history (best-performing first legendary per champion) | Coaching from personal data. |

---

## Missing / Recommended Statistics

| Statistic | User question answered | Value | Implementation complexity |
|---|---|---|---|
| Average placement (overall, per champion already exists) | "How good am I, in one number?" | Very high | Low: one `avg()` in the aggregate query |
| Rolling average placement over time (e.g. 20-game window) | "Am I improving?" | Very high | Low–medium: ordered placements already queried for streaks |
| Last-10 placement strip / current streak | "How am I doing lately?" | High | Low (`currentStreakDays` already computed; placements ordered) |
| Δ top-3 rate vs your baseline (champions, augments, items, teammates) with n | "What actually helps me win?" | Very high | Low: client-side from existing counts |
| Damage / game, damage / minute, damage share of team | "Where do I carry?" | High | Medium: team totals need a join on `match_id` + `team_id` |
| Champion × augment performance | "Best augments on my main?" | High | Medium: augment rows already carry `championId` via participant |
| Pair performance (your champion + teammate champion), trios | "Which team comps work?" | High | Medium: pairs exist; add baseline and own-champion filter |
| Expected vs actual head-to-head (Nemesis) | "Is this person really my nemesis?" | Medium | Low: derive from placement distribution |
| Performance by hour / weekday (avg placement) | "When do I play best?" | Medium | Low: extend existing hour/day queries with `avg(placement)` |
| Placement by game-number-in-session | "Should I stop after N games?" | High | Medium: window function over `gameCreation` with a gap threshold |
| Personal records, each linked to a match | "What were my best performances?" | High | Low–medium: `ORDER BY … LIMIT 1` per record plus match id |
| Boots sold vs kept → top-3 rate; average sell time | "Is selling boots right?" | Medium | Low: `boots_sold` plus placement; timing from timeline |
| First legendary item and its outcome | "What's my strongest build path?" | Medium | Medium: timeline purchase order (already parsed for purchases) |
| Elimination round distribution | "When do I usually get knocked out?" | Medium | Medium: derive from `timePlayed` or `KILL_ACE` events |
| "Your mains banned" rate | "How often can't I play my best champion?" | Medium | Low: existing ban data × top champions |
| Arena God progress (distinct champions with a 1st) | "How close am I to Arena God?" | High (motivation) | Low: count already computed |

**Not recommended:** more raw totals (casts, consumables, items purchased), ping sub-types beyond the top few, and any "damage vs specific opponent" approximation (charter §2 already rules it out).

---

## Data Visualization Review

| Visualization | Where | Verdict | Notes / fix |
|---|---|---|---|
| Vertical placement bars | Placement | ✅ Right form | Tier by placement number, add % labels and a uniform-expectation line (S02-2, S02-4). |
| TimeRange activity calendar | Time | ✅ Good | Fix captions, show the timezone, color-by-placement label (S03-1 to S03-3). |
| Polar bar by hour | Time | ✅ Good for volume | Add avg placement per hour; label UTC/local. |
| Stacked outcome bars (log total) | Team Slot, Picks, Augments, Prismatic | ⚠️ Distorted | Log totals plus linear segment shares make segments incomparable. Use a linear scale or 100%-stacked bars sorted by rate with n (S07-2). |
| Log-scaled single bars with raised floor | KDA | ❌ Misleading | Linear from zero (H-07). |
| Power-scaled horizontal bars (`^0.55`) | Damage, Ability, Utility | ❌ Misleading | Linear. |
| Swing rail | Bans | ⚠️ Saturates at ±6.4pp | Data-driven scale with ticks (S10-3). |
| Rate bars with baseline tick | Vault | ✅ **Best on page** | Reuse for champions, augments, prismatic items, teammates, bans. |
| Diamond plates | Kills | ✅ Fine for 4 values | Add champion attribution. |
| Coverflow cards | Collection | ✅ Good for browsing | Add search/sort; not a comparison tool (that's fine). |
| Coverflow for 5 cards | Augment Crafting | ❌ Wrong form | Flat row (S16-1). |
| Accordion gallery | Guests of Honor | ✅ Works for 4 | Click trigger. |
| Ring grids | Arena God, Augment God, Prismatic God | ✅ Good "collection" metaphor | Add progress, filters, interaction. |
| Donut (8 slices, rank gradient) | Boots | ❌ Weak | Ranked list or single stacked bar (S22-2). |
| Small composition donuts | Dossier | ✅ OK at 3–4 slices | Keyboard-accessible legend. |
| Tornado (dual bars) | Utility | ⚠️ Independent scales | Label maxes, linear. |
| Chord diagram | Team Synergy | ❌ Answers the wrong question | Pairs table or matrix heat-map with Δ top-3 (S25-2). |
| Icon tile grid | Pings | ✅ Fine | Hide zeros, add per-game rate. |

**Statistical cross-cutting notes:**

1. **Volume vs performance.** Totals rank play frequency. Per-game rates should be the default (H-06).
2. **Small samples.** Every rate needs n and a floor, or shrinkage (C-06).
3. **Baselines.** A rate is only interpretable next to "your normal". Vault is the model (S21).
4. **Survivorship bias** in augments, prismatic items and legendary items. Longer survival means more augments and items (S13-2, S17-2, S21-2).
5. **Percentage points** for differences, not % (S10-5).
6. **Axes.** No chart states its scale. With linear scales and direct value labels, axes can remain implicit.

---

## Responsive Review

All findings are **[Likely]**, derived from fixed sizes. Verify in DevTools device mode at each width.

| Viewport | Expected result today | Main causes |
|---|---|---|
| **Large desktop 1920×1080** (browser viewport ~1920×950) | ✅ Designed for this; mostly fine. | — |
| **Ultrawide 3440×1440** | ✅ The frame caps at 1920×1080 and centers; backgrounds fill. Consider letting the panel grow slightly for dense tables. | `max-w-[1920px] max-h-[1080px]` |
| **Laptop 1440×900** (viewport ~1440×780) | ⚠️ Sidebar slides clip the bottom stat rows (~80px); Anvils rates and Special Items rates may clip; the dossier is cramped. | ~857px minimum height for sidebar slides; `overflow-hidden` |
| **Laptop 1366×768** (viewport ~1366×650) | ❌ ~200px of sidebar content clipped on every sidebar slide; Kills plates overflow horizontally; Augment God column math is wrong. | Fixed px; `h-screen` + `overflow-hidden` |
| **Tablet 1024×768 / 768×1024** | ❌ Sidebar (344px) + padding (168px) + gap (48px) leave ~460px for panels designed for ~1,000px. Tables unreadable; ~50% of slides unusable. | Fixed grid templates (`36px 104px 1fr 240px 62px`, etc.) |
| **Mobile 375×812** | ❌ Unusable: horizontal clipping everywhere, 92px name, 286px dials, hover-only interactions, `100vh` address-bar jump, scroll-snap fighting inner scrollers. | All of the above |

**Recommended approach (in order):**

1. **Unblock (hours).** Below `lg`, or when height < 800px: `min-h-dvh` instead of `h-screen`, no `overflow-hidden`, disable scroll-snap. Content then scrolls naturally instead of clipping.
2. **Stack (days).** `CategorySection` sidebar layout becomes a single column below `xl` (header → dial row → panel). Dials use `clamp()` sizes. Row lists collapse to two-line cards (icon + name on top, bars below). Header stat strips wrap.
3. **Mobile-first components.** Tabs become a horizontally scrollable segmented control; hover interactions become tap; bar-chart scrollers get snap points and edge fades; tooltips become tap popovers.
4. **Typography floor.** No text below 11px on mobile (see Accessibility).

---

## Accessibility Review

| ID | Priority | Issue | Recommendation |
|---|---|---|---|
| A-01 | 🔴 | **[Observed]** Core interactions are mouse-only `div`s (C-04). | Semantic buttons, tabs, listboxes; roving tabindex. |
| A-02 | 🟠 | **[Observed]** No semantic structure: no `h1`/`h2` (titles are `div`s), no landmarks, no `aria-labelledby` on sections. | `<main>`; each slide a `<section aria-labelledby>` with an `<h2>`; Welcome name as `<h1>`. |
| A-03 | 🟠 | **[Observed]** Very small type is pervasive: 8.5px, 9px, 9.5px, 10px and 10.5px labels with wide tracking, often in `#7f7a6e` (~4.5:1 on `#050e16`, only borderline even at normal sizes) or at `opacity: .55`. `text-lol-text-disabled` (#5b5a56) is ~2.8:1. | Minimum label size 11px (12px preferred). Muted text at ≥4.5:1 against the *actual* translucent panel background. Don't reduce contrast with opacity for inactive states; use a lighter color. |
| A-04 | 🟠 | **[Observed]** Charts have no text alternative. Bars, rails, donuts and the chord expose nothing to screen readers (icons have `alt`, values don't). | Visually hidden data tables, or `aria-label` summaries per chart ("Samira: 42 games, 61% top 3"). |
| A-05 | 🟡 | **[Observed]** Reduced motion is only partially respected. CSS animations and the coverflow honor it, but JS count-ups (`useCountUp`), Motion FLIP/spring layouts (HextechBarChart, Damage, Ability, Utility), accordion 3D tilt and `scroll-smooth` don't. | Wrap the app in `<MotionConfig reducedMotion="user">`, make `useCountUp` return the target immediately under reduced motion, and use `motion-safe:scroll-smooth`. |
| A-06 | 🟡 | **[Observed]** Color-only encodings: Bans worse/better (garnet/cyan), Vault above/below baseline, damage types. | Add +/− signs and ▲/▼ glyphs (partly present), pattern or labels. |
| A-07 | 🟡 | **[Observed]** Native `title` tooltips are the only way to learn names in the hall-of-fame grids and bar segments. They're unreachable by keyboard or touch. | Accessible tooltip component (X-5c). |
| A-08 | 🟡 | **[Observed]** Scroll-snap with `snap-always` plus smooth scroll can disorient screen-magnifier users and keyboard PageDown users (focus doesn't move with snaps). | Move focus to the slide heading on cue/nav activation; offer a "classic scroll" preference. |
| A-09 | 🟢 | **[Observed]** Decorative diamonds and rings aren't marked `aria-hidden`. | `aria-hidden` on decorative layers. |

---

## Performance Review

Only concerns that are realistically relevant at friend-group scale are listed.

| ID | Priority | Issue | Evidence | Recommendation |
|---|---|---|---|---|
| P-01 | 🟠 | ~13 MB of section backgrounds downloaded on first load (H-03). | All 30 sections mounted; CSS `background-image` fetches regardless of viewport; three PNGs at 2.4–2.9 MB shown at `blur(16px)`. | Pre-blurred, downscaled AVIF/WebP (~30 KB each); lazy-attach near viewport. |
| P-02 | 🟠 | ~45 sequential DB queries, uncached, per page view (H-04). | `buildSummonerStats` awaits each query in turn; `fetch(..., { cache: "no-store" })`. | `Promise.all` for independent queries; per-summoner response cache invalidated on ingest; optionally `revalidateTag` in Next. |
| P-03 | 🟠 | Unvirtualized, unbounded Teammates/Nemesis lists (S26-5, S27-3). | Every account in every match rendered as a DOM row at load. | Server-side minimum games; virtualization (`@tanstack/react-virtual`). |
| P-04 | 🟡 | 400+ remote icons load eagerly (171 champion icons, 225 augment icons, bar-chart icons). | Plain `<img>` without `loading="lazy"`; lint flags 40+ `no-img-element`. | `loading="lazy" decoding="async"` on grid/list images, or `next/image` with Data Dragon/Community Dragon remote patterns. |
| P-05 | 🟡 | Infinite CSS animations run on every slide at all times: dial spins, breathes, sheen sweeps on every gold/prismatic ring (up to ~400 rings across the three hall-of-fame grids), plus `backdrop-filter` blur on every panel and card. | globals.css keyframes; no pause offscreen. | `content-visibility: auto` per section, or toggle `animation-play-state: paused` via IntersectionObserver; drop `backdrop-filter` where the background is already blurred. |
| P-06 | 🟡 | The whole response is serialized twice into the HTML (RSC props + dehydrated query state) and also `console.log`ged on the client. | [stats-view.tsx:91](apps/web/src/app/summoner/%5Bplatform%5D/%5BriotId%5D/stats-view.tsx#L91) | Remove the log. Since the query never refetches (`staleTime: Infinity`), pass data as props and drop the React Query hydration for this page. |
| P-07 | 🟢 | Unused dependencies and dead components: `@nivo/bar`, `@nivo/funnel`, `@nivo/heatmap`, `@nivo/scatterplot`, `embla-carousel-react` (via unused `ui/carousel.tsx`), `stat-card.tsx`, `stat-grid.tsx`, `animated-stat.tsx`, `champion-icon-tick.tsx`. | No imports found. | Remove (install size and maintenance, not bundle size, since they're tree-shaken). |
| P-08 | 🟢 | 16 OTF font files (10 Beaufort weights/styles). | [fonts/index.ts](apps/web/src/fonts/index.ts) | Convert to WOFF2; drop unused weights and italics. |
| P-09 | 🟢 | `DDRAGON_VERSION` is hard-coded (`16.17.1`) and there's no `onError` fallback on remote images. | [riot.ts:3](apps/web/src/lib/riot.ts#L3) | Serve the version from the API's cached `versions.json`; add a fallback silhouette for broken images (new champions). |
| P-10 | 🟢 | `ilike` lookup with user-supplied Riot ID doesn't escape `%`/`_`, so `_` in a typed URL can match a different summoner. | `summoners.ts` by-riot-id route | Escape LIKE wildcards, or compare `lower()` equality. |

**Not a concern:** memoization. The per-module `useMemo` usage is adequate, and the coverflow's imperative painting is appropriately optimized.

---

## Design System Recommendations

1. **Semantic color tokens** (`lib/semantic-colors.ts` plus CSS variables): `--outcome-first`, `--outcome-top3`, `--outcome-rest`, `--rarity-silver/gold/prismatic` (rings only), `--scale-volume-*` (cyan ramp), `--delta-positive` (cyan), `--delta-negative` (garnet), `--damage-physical/magical/true`, `--spell-q/w/e/r`. Remove raw hex from modules (`#7f7a6e`, `#8a8578`, `#e0b563`, `#ba00fb`, `#040c14` appear dozens of times).
2. **Type scale tokens.** Replace ~25 arbitrary sizes (`text-[9.5px]`, `text-[10.5px]`, `text-[11.5px]`, `text-[13.5px]`, `text-[19px]`, `text-[21px]`, `text-[22px]`, `text-[23px]` …) with a 7-step scale: `eyebrow 11`, `label 12`, `body 14`, `value-sm 16`, `value 22`, `display 30`, `hero 52+`. Tracking tokens: `.12em`, `.22em`, `.28em` only.
3. **Surface tokens.** `panel-ink #040c14`, `hairline rgba(200,170,110,.16/.28/.45)`, `selected-fill rgba(200,170,110,.09)`. Currently inlined in every file.
4. **Component inventory to extract** (see X-4): `HeroSection`, `SlideRegistry` + `ChapterRail`, `StatCell`, `ValueShare`, `FramedIcon`, `RankedRowList`, `OutcomeStackChart`, `EntitySpotlight`, `HallOfFameGrid`, `AccountTable`, `RateBar` (from Vault), `HextechTooltip`, `EmptyState`, `GlossaryTerm`, `SampleBadge` ("n=12", dimmed below min).
5. **Formatting module.** `formatCount`, `formatCompact`, `formatGold`, `formatDuration`, `formatRate`, `formatDeltaPp`, `formatPlacement`. One source, used everywhere.
6. **Interaction states.** Define hover, focus-visible (gold ring), selected (tint + inset ring), disabled/low-sample (dim + badge) once, as utilities.
7. **Document it.** Add a "Semantic color and terminology" subsection to CLAUDE.md §5 so future slides don't re-drift.

---

## Motion & Interaction Recommendations

**Keep:** the FLIP re-sort (it communicates "ranks changed"), coverflow momentum, dossier cross-fade, count-ups on first reveal, and the slow ambient dial spin on the *focused* slide.

| ID | Priority | Recommendation | Purpose |
|---|---|---|---|
| M-01 | 🟠 | Fix wheel capture and scroll chaining (C-10). | Predictable scrolling. |
| M-02 | 🟡 | Pause ambient animations offscreen (P-05) and on non-focused slides; limit animated sheen to the top 1–3 rings per grid. | Draws the eye to what matters; saves battery. |
| M-03 | 🟡 | Slide-enter choreography: header rule draws in, then panel fades up, then data marks grow from baseline (bars from 0, rate bars from left), with ~60ms staggers, once per slide, reduced-motion aware. Today bars appear at full size and only animate on re-sort. | Guides reading order; reinforces "instrument powering on". |
| M-04 | 🟡 | Tab-change transitions: cross-fade the caption and tween values (already done for bars) consistently in the row lists and dossier. | Continuity. |
| M-05 | 🟡 | Guests of Honor accordion: click, or hover-intent delay (S15-2). | Avoids flicker. |
| M-06 | 🟢 | Chapter rail indicator slides between dots on snap; the current chapter's label briefly expands. | Wayfinding feedback. |
| M-07 | 🟢 | One-shot "achievement" flourish (prismatic sheen sweep) only on genuinely rare values: a penta, a 1st-place streak ≥3, Arena God milestones. | Delight that carries meaning. |
| M-08 | 🟢 | Standardize durations/easings: 150ms (hover), 240ms (view swap), 450ms spring (data). Several one-off values exist (180, 250, 300, 500, 600ms). | Consistency. |

---

## Product / Information Architecture

### What the page does today

1. **Learn first:** name, level and a fake season (no performance).
2. **Next:** placement counts, time played, lobby slot (noise), KDA, multikills.
3. **Most interesting information** is buried: Vault's baseline comparisons (21), Teammates (26), Nemesis (27).
4. **Curiosity leads** into the dossier (8), but there's no path from any other champion mention to it.
5. **Reasons to continue** weaken after slide ~12. Slides 13–24 are seven consecutive item/augment/economy screens followed by two low-insight slides (Ability, Utility).
6. **Redundant slides:** Picks/Collection/Arena God; Damage Dealt/Taken; Augments/Augment God; Prismatic/Prismatic God; Anvils/Special Items/Vault/Boots; KDA/Kills; Farewell/Thank You.
7. **Transitions** are cue labels only; there are no chapter headings.
8. **Conclusion:** fist bumps, then "thank you". Charming, but no summary and no next step.

### Proposed structure (30 → ~18 screens, in 6 chapters)

| Chapter | Screen | Merges / replaces | Core question |
|---|---|---|---|
| **I. Overview** | 1. Welcome + Headline stats + Recent form | Welcome | "Who is this and how are they doing?" |
| | 2. Placement & Trend (distribution + rolling avg placement + streaks) | Placement | "How do I finish, and am I improving?" |
| | 3. When I Play (calendar, hour/weekday performance, session fatigue) | Time | "When do I play, and when do I play best?" |
| **II. Champions** | 4. Champions (sortable per-game table / chart with Δ baseline; click → dossier) | Picks + Kills attribution | "Which champions am I best with?" |
| | 5. Collection & Dossier (+ Arena God progress as the header) | Collection + Arena God | "Everything about one champion; what's left to conquer?" |
| | 6. Lobby Bans ("your mains banned", swing with n) | Bans | "How do bans affect me?" |
| **III. Combat** | 7. Combat (KDA per game, multikill plates, records) | KDA + Kills | "How do I fight?" |
| | 8. Damage (dealt/taken toggle, per game, team share) | Damage + Damage Taken | "Where do I carry?" |
| | 9. Utility (per game) | Utility (+ Ability folded into the dossier) | "How do I support my team?" |
| **IV. Builds** | 10. Augments (chart/collection toggle, Δ baseline, champion combos) | Augments + Augment God | "Which augments work for me?" |
| | 11. Special Augments (Guests of Honor + Crafting, with explainers) | GoH + Crafting | "How do I use special augment mechanics?" |
| | 12. Prismatic Items (chart/collection toggle) | Prismatic + Prismatic God | "Which prismatics win?" |
| | 13. Gold & Legendaries (Vault's table as-is) + Anvil tiers | Vault + Anvils | "How do I spend gold?" |
| | 14. Special Items & Boots (Shardblade, Spatula, Wooglet's, Void; sold vs kept outcome) | Special Items + Boots + Shardblade | "Do the odd items and the boot sell-off pay off?" |
| **V. People** | 15. Team Synergy (pairs table/matrix with Δ baseline) | Team Synergy (+ Team Slot as a footnote) | "Which team comps work?" |
| | 16. Teammates & Rivals (tabs: Teammates / Nemesis; friend links) | Teammates + Nemesis | "Who do I win with, and who beats me?" |
| **VI. Wrap-up** | 17. Hall of Records (best games, each linked to a match) | *(new)*, absorbs scattered BEST GAME records | "What were my greatest moments?" |
| | 18. Personality & Farewell (pings, fist bumps, CTAs) | Pings + Farewell + Thank You | "What's my vibe? What next?" |

Separately, **Match History** should be its own route (`/summoner/.../matches`, with `/matches/[id]` detail), linked from Welcome, from records and from the chapter rail. It shouldn't be one more slide.

**Two consumption modes, one data layer:** keep the cinematic snap-scroll deck as a "Recap" mode (great for the first visit and sharing), and default returning visitors to a navigable **dashboard** layout (chapter rail + normal scrolling + filters). The slide registry makes both cheap.

---

## Polish Opportunities

Every item has a purpose, not just decoration.

1. **Insight headline per slide.** Replace or augment the italic quote with one generated, data-driven sentence in the same slot ("Your best stretch: 9 top-3 finishes in a row, 4–6 Sep"). Keep the quote as a small epigraph. *Purpose: meaning before numbers.*
2. **Sample-size badges** (`n=12` in muted type; dimmed and dashed below the minimum) on every rate. *Purpose: honesty, at a glance.*
3. **Chapter title cards** (a thin Hextech band, chapter number and name) at the top of each chapter's first slide. *Purpose: narrative structure.*
4. **Arena God progress ring** in the Welcome identity ring (a thin prismatic arc filling toward the goal). *Purpose: a motivating hook on screen 1.*
5. **Record "trophy" plates.** Reuse the Kills diamond plates for the Hall of Records, with champion splash art peeking through the diamond. *Purpose: memorable, shareable moments.*
6. **Friend presence.** Tracked-friend avatars as small diamond chips wherever a friend appears (teammates, nemesis, synergy, leaderboard), all linked. *Purpose: social cohesion.*
7. **Empty-state art.** A dim, unlit version of the slide's centerpiece ("No pentas yet — the plate awaits") rather than "No tracked matches yet." *Purpose: turns absence into anticipation.*
8. **Hover-card consistency.** One Hextech tooltip card (portrait, name, 3 key numbers, "open dossier →") on every champion or augment icon on the page. *Purpose: every icon becomes a doorway.*
9. **Placement pips.** A tiny 6-segment pip under any match or record showing where it finished. *Purpose: consistent visual shorthand for "how did that game end?"*
10. **Unique background art per slide/chapter** (X-5e), pre-blurred (P-01). *Purpose: sense of progression.*
11. **Number tweening on filter change** (not just first reveal) once time filters exist. *Purpose: shows what changed.*
12. **Closing screen CTA row** styled like the Welcome region/season chip. *Purpose: satisfying loop back into the product.*

---

## Recommended Roadmap

Tick items as they ship. IDs link back to the sections above.

### Phase 1 — Fix
*Critical and high-priority correctness, access and robustness.*

- [x] C-01 Placeholder quote removed; Pings has a real quote (S28-1)
- [x] C-02 Champion display names from the API, rendered everywhere
- [x] C-07 KDA BEST GAME uses per-metric records (S05-1)
- [x] C-08 "SEASON 3" / "SEASON TOTAL" replaced with true labels (S01-1, S05-6)
- [x] C-11 Bans footer copy and NO BAN denominator (S10-1)
- [x] C-06 Shared minimum-sample rule on every rate sort, low-sample rows dimmed (S07-1, S10-2, S13-1, S17-1, S26-2)
- [x] S02-2 Placement tier by placement number; API zero-fills placements
- [x] S20-1 Special Items "THE" prefix
- [x] S07-3 / S13-4 / S04-3 Segment tooltips, selection desync, invalid box-shadow
- [x] S08-3 Dossier Legendary items = built (bought ∪ held)
- [x] C-10 Coverflow wheel released at the ends; contained inner scrolling
- [~] C-04 / A-01 Keyboard: tabs, rows, sort headers, cues, chart columns, focus ring, donut legends, gallery typeahead, focus on navigation done; hall-of-fame icons and chord/hour charts remain
- [x] C-05 (step 1) `deck`/`flow` layouts; no clipping; snap only on large/tall viewports
- [x] C-03 Slide registry + chapter rail + `#hash` deep links (X-3)
- [x] H-04 Response cache, parallel queries (cold 9.4 s → 3.75 s), loading/error/not-found pages
- [x] H-03 / P-01 Optimized, lazily attached backgrounds
- [x] C-09 (step 1) Home page lists tracked summoners; dead button removed
- [x] D-08 Production `next build` passes
- [x] H-01 Average placement on the Placement slide; "Top 3" defined up front
- [x] P-06 (part) `console.log("stats")` removed

### Phase 2 — Improve
*Important UX, data and IA improvements.*

- [ ] **Match history route** (list + match detail) (C-09)
- [ ] H-05 Global time-range filter
- [x] H-06 Per-game defaults on KDA, Damage, Ability, Utility
- [x] H-07 Linear scales on every bar chart
- [~] Δ-vs-baseline (pp): Teammates, teammate picks, augments, prismatic items, Vault (pick-weighted), Shardblade, special items, boots outcomes done; champions not yet
- [~] Last-10 form strip on Welcome done (S01-2); rolling average placement trend not done
- [x] S26-1 / S27-4 Tracked friends link to their profiles
- [~] S27-1 Nemesis expected rate shown; not used for ranking
- [x] S25-1/2/3/4 Best pair named; TEAMMATE PICKS view (own-champion pairs measured too sparse)
- [?] H-02 / X-1 Semantic color system (outcome vs rarity vs volume): needs sign-off
- [~] X-2 Terminology pass done on touched slides; glossary tooltips not done
- [?] IA consolidation 30 → ~18 screens: needs sign-off (the registry makes the reorder a one-file change; merges need component work)
- [~] S19-1 Anvil tier split shown; Shardblade not moved
- [x] S22-1 Boots sold vs kept outcome (with survivorship caveat)
- [~] S09-1 Arena God denominators + explanation; progress ring, filter and clickable grids not done
- [x] S15-1 / S16-2 Explainers for Guests of Honor and Augment Crafting
- [x] S13-2 / S17-2 / S21-2 Survivorship bias verified; pick-weighted baselines
- [~] C-05 (step 2) Stacked/scrolling responsive layouts done; step 3 mobile-native components not done
- [~] A-02…A-08 Headings/landmarks, spoken labels, 11 px type floor, reduced motion, focus on navigation done; accessible tooltips remain
- [x] P-03 Teammates/Nemesis capped server-side; [x] P-04 lazy images; [x] P-05 pause offscreen animation
- [~] X-4 Several shared components extracted; [~] dead code and unused deps (P-07)
- [ ] Friend leaderboard (charter priority #4)
- Won't implement — D-05 as written: re-measured, the response is serialized once (see Discovered)

### Phase 3 — Polish
*Visual refinement and delightful interactions.*

- [ ] Insight headline per slide (Polish #1) and sample badges (#2)
- [ ] Chapter title cards (#3); unique per-chapter art (#10)
- [ ] Slide-enter choreography (M-03); standardized motion tokens (M-08)
- [ ] Unified Hextech hover card on every champion/augment/item icon (#8)
- [ ] Hall of Records slide with trophy plates, linked to matches (#5)
- [~] Empty-state art (#7) not done; page-level "no games yet" (X-5d) done
- [x] Merge Farewell + Thank You with CTAs (S29-1/2)
- [ ] Rare-achievement flourishes (M-07); Arena God ring on Welcome (#4)
- [ ] Type scale and surface tokens (Design System §2–3)

### Phase 4 — Explore
*Experimental features and differentiators.*

- [ ] Recap mode (deck) vs dashboard mode
- [ ] Compare with a friend (side by side)
- [ ] Champion × augment explorer
- [ ] Session tilt detector
- [ ] Elimination-round analysis
- [ ] First-legendary build path outcomes
- [ ] Friend-group meta page
- [ ] Rivalry cards and per-slide share images

---

## Top 10 Recommended Improvements

1. **Fix wrong and fake data on screen:** champion display names (C-02), the "SEASON 3" placeholder (C-08), KDA best-game ranking (C-07), Bans copy and denominator (C-11), the placeholder quote (C-01), and the Special Items "THE" bug (S20-1). Trust is the foundation of a stats product.
2. **Add navigation:** a slide registry driving a chapter rail, `#hash` deep links and consistent cues (C-03, X-3). It makes the whole page reachable and shareable.
3. **Apply one small-sample rule everywhere** (minimum n, visible `n`, dimmed low-sample rows, shrunk rates for ranking), so "best" lists stop being dominated by one-game flukes (C-06).
4. **Make baselines and per-game rates the default:** Δ vs your own top-3 rate in pp using Vault's rate-bar pattern, and per-game instead of totals (H-06, X-2). This turns numbers into answers.
5. **Build match history and a real home page** with tracked summoners, friend links and a leaderboard. These are the charter's #1 and #4 priorities, and the page is currently undiscoverable (C-09, S26-1).
6. **Put average placement and its trend at the top.** Average placement, a rolling trend and a last-10 form strip answer "How am I doing, and am I improving?" on screens 1–2 (H-01, S01-2).
7. **Make it keyboard-accessible and stop scroll traps:** semantic tabs, buttons and listboxes; focus styles; coverflow wheel release; contained inner scrolling (C-04, C-10).
8. **Make it work on laptops and phones:** first stop clipping (`min-h-dvh`, no `overflow-hidden`, no snap on small screens), then stack layouts responsively (C-05).
9. **Consolidate 30 slides into ~18 chaptered screens,** merge redundant pairs, and restore one meaning per color (outcome vs rarity vs volume) (IA, H-02).
10. **Cut load cost:** pre-blurred lazy backgrounds (~13 MB → <1 MB), parallel and cached stats queries with proper loading/error states, and capped, virtualized account lists (H-03, H-04, P-03).

---

## Implementation History

### 2026-09-17

#### Implemented
- **Slide registry + navigation:**
  - The ordered `slides` list in `stats-view.tsx` drives section ids, `#hash` deep links, "next" cues (`SlideCue`) and a new `ChapterRail`.
  - Chapters: Overview, Combat, Champions, Damage, Augments, Items, Playstyle, People, Wrap-up.
- **Layouts:** `deck` / `flow` responsive variants in `globals.css`. `CategorySection` and the new `HeroSection` grow with content outside large, tall viewports; `HextechPanel contentMinWidth` makes table panels scroll horizontally as one unit.
- **Recent form and freshness:**
  - Welcome: headline stats (games, avg placement, top 3 rate, 1st rate), last-10 placement pips, tracked-since date, last-game freshness.
  - API: `avgPlacement`, `recentPlacements`, `lastMatchAt`.
- **Per-game and sample-size defaults:**
  - PER GAME is the default mode on KDA, Damage, Damage Taken, Ability and Utility (`lib/per-game.ts`).
  - Shared sample-size rule in `lib/sample.ts`, applied to every rate ranking, including the scale maximum.
  - Teammates "Δ YOU" column in percentage points; Nemesis expected "ahead of you" rate.
  - "BY TOP 3 RATE" sort on Picks, Augments and Prismatic Items.
- **Keyboard:** ARIA tablist with roving tabindex; pressable rows and chart columns; button sort headers and cues; global focus ring; coverflow Home/End.
- **Home and route states:** home page lists tracked summoners; themed loading, error and not-found pages; Farewell absorbs Thank You and ends with calls to action.
- **Performance:**
  - `scripts/optimize-backgrounds.mjs` plus lazy background attachment (13.6 MB → 1.73 MB of art, loaded on demand).
  - Per-summoner stats cache in the API (cached response 9.4 s → 0.62 s).
  - Teammate and opponent lists capped to people met twice or more.
- **Documentation:** CLAUDE.md §6 records the new conventions (registry, layout modes, display names, sample rule, linear scales, optimized art, stats cache).

#### Fixed
- **Wrong or placeholder data:**
  - Champion internal keys shown as names (C-02); fake "SEASON 3" (C-08); placeholder quote (C-01).
  - KDA best-game ranking read the best-KDA match (C-07); API gains `fewestDeaths`.
  - Bans copy and NO BAN denominator (C-11). Placement tiers were assigned by column index (S02-2).
  - Special Items "THE" eyebrow on every card (S20-1); invalid Team Slot glow (S04-3).
  - Dossier Legendary items came from end-of-match inventory only, disagreeing with Vault (S08-3).
- **Misleading scales:** log and power bar scales (H-07); a Bans swing rail that saturated at ±6.4 pp (S10-3).
- **Terminology and units:** "N picks" tooltips on outcome segments (S07-3); CC score shown in three different units (S08-4); boots "% of games" above 100% (S08-5).
- **State and scrolling:** Augments selection highlight out of sync (S13-4); coverflow wheel trap (C-10); scroll chaining out of inner lists.
- **Layout and hydration:**
  - Clipped sidebars and horizontal overflow on laptops and phones (C-05).
  - A hydration mismatch in the Anvils tick dial: server and browser trig differed in the last floating-point digits. This bug predated the pass; the dev overlay showed "1 Issue".
- **Leftovers:** the debug `console.log`.

#### Deferred
- **Match history, leaderboard, time-range filter (H-05):** each needs new API endpoints and design work, too large to fold into this pass.
- **Semantic color system (H-02/X-1), IA consolidation 30 → ~18 screens, glossary tooltips:** these are design-system decisions. The registry makes the reorder cheap, but the merges need component work and a product sign-off.
- **Parallelizing the ~45 stats queries:** the cache removes the cost for repeat views; cold builds are still ~9.5 s.
- **Mobile-native components (C-05 step 3), donut and hall-of-fame keyboard access, reduced motion for JS count-ups and springs.**
- **Baseline deltas on champions, augments and prismatic items; synergy pairs table; Boots sold vs kept outcome; "your mains banned".**
- **Survivorship-bias verification (S13-2/S17-2/S21-2):** needs a data investigation before any UI change.

#### Won't implement (as written)
- **S23-1, "Remove Ability as a standalone slide":** kept for now. With per-game values the slide answers a real question ("how spell-heavy is my play on X"). Revisit during IA consolidation. Marked `[?]`.
- **P-03, "Virtualize Teammates/Nemesis lists":** unnecessary after the server-side cap (36 and 571 rows render instantly). Revisit only if a heavier player's list grows past ~2,000 rows.

#### Discovered
- **D-01 (fixed):** after switching KDA to per game, a dimmed 1-game champion set the chart's maximum, and the leading real bar drew at 27% instead of 70% of the track. Measured via CDP. Fixed by computing every scale maximum from rows that meet the sample, in KDA, Damage, Ability and Utility. Now a rule in CLAUDE.md.
- **D-02 (fixed):** Team Synergy's "best pair" used a 3-game minimum and displayed "100%". The API minimum is now 5, and the dial row names the pair with its game count.
- **D-03 (fixed):** Team Synergy "TOP PARTNER" could be the aggregate "Other" bucket; it is now excluded.
- **D-04 (fixed):** `DetailBand` stat cells overlapped whenever the panel was narrower than ~1,000 px. This happened at 1366 px windows and also in the `deck` layout at 1280–1535 px. It now uses a container query.
- **D-05 (re-diagnosed in pass 2, 🟢):** the summoner page HTML is ~3.4 MB, but the pass-1 diagnosis was wrong: the stats data is serialized **once** (~593 KB of inline scripts; `page.tsx` passes no stats props). The other ~2.8 MB is server-rendered markup (`class` attributes 1.29 MB, `style` 748 KB; Nemesis alone 571 KB for 571 rows, Augments 332 KB, Bans 284 KB). Over the wire it is **241 KB gzipped** in a production build (0.72 s). Won't implement the props change. If it ever matters, render long lists (Nemesis) progressively.
- **D-06 (open, 🟢, confirmed in production):** an unknown summoner renders `not-found.tsx` but with HTTP 200, in dev and in a production build, because `loading.tsx` starts streaming before `notFound()` resolves. Fixing it means giving up the streamed loading screen for that route. Harmless for a friend-group tool with no SEO goals.
- **D-07 (open, 🟡 DATA):** Team Synergy's chord diagram is dominated by the "Other" node (148 of 168 champions), confirming S25-2: the chart shows little beyond "you play many champions".
- **D-08 (fixed in pass 2):** `next.config.ts` reads `distDir` from `NEXT_DIST_DIR`, so `NEXT_DIST_DIR=.next-build pnpm build` runs beside a live dev server. The production build passes (TypeScript included). `.next-build/` is git-ignored.

### 2026-09-17 (pass 2)

#### Implemented
- **Faster cold stats build (H-04):**
  - The 27 queries that depend only on the summoner start concurrently.
  - The teammate, opponent and ban follow-up queries use subqueries instead of waiting on earlier results.
  - Cold build 9.4 s → 3.75 s; the response is byte-identical.
- **Honest baselines (S13-2/S17-2/S21-2, S19-4, S20-2):**
  - The survivorship-bias claims were checked with SQL and confirmed.
  - Augments, Prismatic Items and Vault compare with the pick-weighted average of their list (`pooledRate`).
  - Shardblade and Special Items show pp against your overall rates, or FEW GAMES.
- **New answers:**
  - Boots outcome by what happened to your boots (S22-1).
  - MAINS BANNED dial (S10-4).
  - TEAMMATE PICKS view on Team Synergy (S25-2/3).
  - Hour-of-day detail band (S03-4).
  - "PENTAS ON" row (S06-4).
  - KDA career records (S05-7).
  - Most games in a day and favorite day (S03-7).
  - Percentages on the Boots counts (S22-3).
- **Navigation and access:**
  - Focus moves to the section heading on cue and rail navigation (A-08).
  - Type-to-jump in the champion gallery (S08-2).
  - Focusable donut and boots legends (S08-9).
  - An 11 px type floor with lighter column headers (A-03).
  - Reduced motion for Motion springs and count-ups (A-05).
- **Layout:**
  - Measured column counts for the hall-of-fame grids (S14-1).
  - Container-query dossier with a "+N" item chip (S08-6/7).
  - Edge fades on overflowing bar charts (S05-5/S13-5).
- **Performance and hygiene:**
  - Lazy remote images (P-04); offscreen animations paused (P-05); broken images hidden (P-09).
  - 9 unused font faces dropped (P-08).
  - Dead components and 4 unused nivo packages removed (P-07); LIKE wildcards escaped (P-10).
  - Page-level empty state (X-5d).
  - `Positions` renamed `Placement` (S02-5); shared tier/ring helpers (S04-5, S09-5); shared `formatGold` (S21-4).
- **Wording:** "WON" → TOP 3 on framed cards and hall-of-fame strips; Kills record headings; Damage best-game caption (S06-2, S11-3, X-2).
- **Tooling:** `NEXT_DIST_DIR` for side-by-side production builds (D-08). CLAUDE.md §6 updated (pick-weighted baselines, short-deck sizing, measured grids, reduced motion, production build).

#### Fixed
- **D-09:** see Discovered.
- **D-10:** see Discovered.
- **D-11:** see Discovered.
- **D-12:** see Discovered.

#### Deferred
- **Match history, friend leaderboard, time-range filter (C-09, H-05):** each needs new API endpoints, caching per range and new screens. Too large for an incremental pass.
- **Mobile-native components (C-05 step 3):** tables as cards and tap tooltips on every slide. Too large; the page works on phones by scrolling tables horizontally.
- **One accessible tooltip component (X-5c, A-07):** it replaces native `title` on hundreds of icons and every nivo tooltip.
- **Viewer-timezone bucketing (S03-3):** needs a timezone parameter or raw timestamps from the API.
- **Hall-of-fame icon → dossier (S09-2), gallery sort chips (S08-2), dossier group semantics (S08-8):** cross-slide state or minor.
- **WOFF2 fonts (P-08) and serving the Data Dragon version from the API (P-09).**
- **Visible names on Utility rows (S24-3):** needs a redesign of the mirrored heal/CC layout.

#### Needs a product decision (skipped, not implemented)
- **Semantic color system (H-02, X-1, S13-3):** which meaning keeps the prismatic/gold/silver tiers.
- **IA consolidation 30 → ~18 screens (S06-5, S11-5, S16-3, S18-1, S25-5, S23-1):** which slides merge.
- **Dropping the Boots donut (S22-2):** a visual design call.

#### Discovered
- **D-09 (fixed, 🟠 RESPONSIVE):** dials were squashed into ovals on every sidebar slide at deck heights under ~1000 px. The ring's fixed size shrank in the flex column. At 1280×860, Placement's and Nemesis's sidebars also ran 43 px and 26 px into the next-section cue. Fixed with a non-shrinking ring plus `zoom: .74` and tighter sidebar rows for 860–999 px deck heights. Measured with a sidebar-vs-cue script on every section.
- **D-10 (fixed, 🟠 regression from pass 1):** the flat Augment Crafting row wrapped into two clipped rows at 1280×860. Cards now keep a fixed width and scale to 80% between 1280 and 1535 px.
- **D-11 (fixed, 🟡):** Team Slot's team labels overflowed the panel at 1280×860. Bars were fixed pixel heights, and pass 1's description shortened the panel. Bars now use percent heights.
- **D-12 (fixed, 🟡):** the Bans and Vault tables scrolled horizontally inside their panels at a 1280 px deck, clipping the last column and the captions. Their columns now flex, with lower minimum widths.
- **D-13 (open, 🟢 DATA):** own-champion × teammate-champion pairs are too sparse to rank for this summoner (1 of 589 pairs reached 5 games). Any future "best duo for your champion" feature needs far more games or a pooled model.
- **D-14 (open, 🟢):** in headless screenshots, lazily loaded item icons often haven't arrived by capture time. They load after a few seconds (checked via `img.complete`). Not a user-facing bug, but screenshot-based checks should wait for images.

