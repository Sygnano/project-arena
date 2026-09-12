# Handoff: Arena Stats — Hextech panels (Champion Picks, Banned Champions, Placement, Damage, Economy, Kills)

## Overview

Six new full-screen sections for the Arena Stats summoner page, designed in the same Hextech language as the existing KDA section, plus an upgrade to the bar-fill system that should be applied to every stacked chart in the app.

All of it is built against the real data shapes in `packages/types/src/stats.ts`. Nothing here needs a new API field.

| Panel | Section | Repo module it replaces / fills |
|---|---|---|
| 5a | Champion Picks | `modules/ChampionPicks.tsx` (nivo → hand-rolled) |
| 6a | Banned Champions | `modules/BannedChampions.tsx` (scatterplot removed) |
| 7a | Placement | `modules/Positions/*` (both carousel slides merged) |
| 7b | Damage | `modules/Damage.tsx` + `modules/DamageTaken.tsx` (merged) |
| 7c | Economy | `modules/Economy.tsx` (pie → concentric rings) |
| 7d | Kills | `modules/Kills.tsx` + `modules/Fun.tsx` + part of `modules/Ability.tsx` |

## About the design files

`Arena Stats - Hextech.dc.html` is a **design reference written in HTML** — a prototype showing intended look and behaviour. It is not production code to copy. Recreate these designs in `apps/web` using the existing React/Next/Tailwind setup and the components already in `apps/web/src/components`.

The file is a single scrolling canvas of panels, newest at the top. Each panel is a 1440×900 card. Open it in a browser; every panel is interactive (toggles, row selection).

**Reuse, do not rebuild:**

| Design element | Existing component |
|---|---|
| Section background, title + gold rule + quote, bottom separator, next-section cue | `CategorySection` |
| Broken-corner frosted panel, top-edge break, corner diamonds, title cartouche | `HextechPanel` |
| Vertical bar chart with icon strip | `HextechBarChart` |
| Selected-item detail strip at the bottom of a panel | `DetailBand` |
| Circular gauge | `Dial` |

Every measurement below that matches one of those components is quoted only so you can verify the panel renders as intended — take the value from the component, not from here.

## Fidelity

**High-fidelity.** Colours, type sizes, spacing and interaction states are final. Two substitutions were made in the prototype because the real assets are not available outside the app:

- **Marcellus** stands in for **Beaufort for LoL** (`--font-display`). Use Beaufort.
- **Barlow** stands in for **Spiegel** (`--font-body`). Use Spiegel.

Everywhere the prototype says `font-family: Marcellus, serif`, use `font-display`. Unstyled text is body copy.

## The tier-fill system (apply app-wide)

The prototype's earlier panels used ad-hoc holo/gold/grey gradients. Those are gone. Every stacked or ranked bar now uses the **real** `.tier-bar-*` classes already in `apps/web/src/app/globals.css`:

- `tier-bar-prismatic` — animated iridescent loop, `border-top: 1px solid #f5eaff`, `box-shadow: 0 0 20px rgba(185,138,221,.55)`
- `tier-bar-gold` — metal ramp + sweeping sheen, `border-top: 1px solid var(--color-lol-gold-50)`, `box-shadow: 0 0 20px rgba(200,155,60,.55)`
- `tier-bar-silver` — metal ramp + sweeping sheen, `border-top: 1px solid #eef2f3`, `box-shadow: 0 0 16px rgba(185,196,200,.5)`

Assignment is **by meaning, not by rank**, exactly as `TeamSlot.tsx` already does it: 1st place = Prismatic, top 4 (excluding 1st) = Gold, everything lower = Silver. The one exception is a single-value bar ranked by size (Banned Champions' ban-rate bars), where the top three ranks take Prismatic / Gold / Silver the way `KDA/index.tsx`'s `BAR_TIER` does.

**In-segment labels** follow `HextechBarChart`'s existing rule and should not be re-invented: 12px display type, `color: #040c14`, `text-shadow: 0 0 3px rgba(240,230,210,.9), 0 0 3px rgba(240,230,210,.9)`, dropped entirely when the segment is under **20px** tall. The segment's `title` attribute always carries the exact number.

---

## 5a — Champion Picks

**Purpose.** Which champions you actually play, and how those picks turned out. Replaces the nivo stacked bar; the section gains a champion readout.

**Layout.** `CategorySection` with a sidebar. 344px identity column + `minmax(0,1fr)` panel, 48px gap, section padding `72px 84px 104px`.

**Identity column** (top to bottom):
- Title `PICKS`, `white-space: nowrap`.
- `Dial`-shaped ring at 262px (not the standard 286px — it has to clear the name block below). Inside the ring, the **selected champion's portrait**: 150px circle, `border: 1px solid rgba(200,170,110,.55)`, `box-shadow: 0 0 30px rgba(10,200,185,.22)`. Everything else about the ring is `Dial`'s (two hairline circles, the spinning double arc, two breathing gold diamonds).
- Name: display 30px, `letter-spacing: .1em`, `#f0e6d2`, centred. Under it `#N OF 20 PICKED` at 10px / `.26em` / `--color-lol-blue-300`.
- `margin-top: auto`, then four stat rows in the standard sidebar-row style (7px gold diamond, 13.5px label at `.12em`, display 21px value, `border-top: 1px solid rgba(200,170,110,.14)`, last row also gets a bottom border): **PICKED** (`#f0e6d2`), **TOP 4 RATE** (`#e0b563`), **1ST RATE** (`#7fe8de`), **AVG PLACE** (`#f0e6d2`).

**Panel.** `HextechPanel` titled `CHAMPION PICKS`.
- Header row: caption `GAMES BY CHAMPION` (11.5px / `.26em` / `--color-lol-text-muted`), fading rule, then a bordered two-chip toggle `BY PICKS` / `BY 1ST RATE` (the `TOTAL` / `BEST GAME` chip style from KDA).
- Right-aligned mode caption under it: `SORTED · BY TIMES PICKED` or `SORTED · BY 1ST-PLACE RATE`.
- Chart: 20 columns, **26px wide, 15px gap**, plot height **412px**, bottom border `1px solid rgba(200,170,110,.3)`. Bar total height = `max(16, round(picks / maxPicks * 380))`.
- Each column stacks, top to bottom: 1st (`min 3px`) → top-4-excluding-1st → remaining. Tier fills as above.
- Total picks sits **21px above** each bar, display 15px, `#f0e6d2` when selected else `#8a8578`.
- Dashed **season-average line** across the plot at `avg/maxPicks * 380` px from the baseline: `1px dashed rgba(200,170,110,.3)`, with a 9px `.24em` `AVG` label at the right end, `rgba(200,170,110,.5)`. Not interactive.
- Icon strip: 26px portraits, `border: 1px solid` — `--color-lol-gold-300` selected, else `rgba(200,170,110,.22)`; opacity 1 / .72. 6px gold diamond under the selected one.
- Footer: rarity legend (16×9 swatches) + `20 CHAMPIONS · 268 GAMES` at the right, `border-top: 1px solid rgba(200,170,110,.2)`.

**Interaction.** Click a bar or a portrait → the identity column loads that champion. Selected bar lifts `translateY(-7px)` over `.2s ease` and gains `box-shadow: 0 0 0 1px rgba(200,170,110,.85)`.

**Data.** `ChampionPicksStats.champions` — `timesPicked`, `top1`, `top3ExclTop1`, `remaining`. `AVG PLACE` is derived; if you'd rather not derive it, drop the row rather than invent a field.

---

## 6a — Banned Champions

**Purpose.** Which champions the lobby takes away from you, and whether that actually costs you anything. **The scatterplot is deleted.** Its flaw was identity: 90% of the points sat in one blob near the origin and a dot never tells you which champion it is.

**Layout.** Sidebar section, same 344px + 1fr grid.

**Identity column.** Title `BANNED`; `Dial` at the standard 286px showing your **baseline win rate** (`53.2%`) with label `BASELINE WIN RATE`; three stat rows: **TRACKED MATCHES**, **CHAMPIONS BANNED**, **NEVER AVAILABLE** (champions whose `winRateWhenNotBanned` is `null`).

**Panel.** `HextechPanel` titled `BAN LIST`.
- Tab row in KDA's metric-tab style (6px gold diamond + `border-bottom`, 13px `.26em`): `MOST BANNED` / `BIGGEST SWING`. Swing sorts by `|winRateWhenNotBanned − baseline|` descending, nulls last.
- Column header, then up to 10 rows. Both use `display: grid; grid-template-columns: 36px 104px minmax(0,1fr) 240px 62px; gap: 16px`.
  - Header labels 9.5px `.22em` `#7f7a6e`: (blank) · `CHAMPION` · `BAN RATE` · a three-part axis legend `◀ WORSE` (`#c98aa3`) / `BASELINE` / `BETTER ▶` (`--color-lol-blue-300`) · `WIN`.
  - Row: 36px portrait (`border: 1px solid` gold when selected, else `rgba(200,170,110,.22)`) · champion name display 16px · ban-rate track (`height: 12px`, `background: rgba(240,230,210,.05)`) with a fill `banRate × 2.9` px wide, then the `%` in a fixed 40px display-15px cell · the swing rail · win rate display 16px.
  - **Swing rail**: 240px wide, 22px tall. Hairline `rgba(240,230,210,.07)` across the middle; a 1px × 18px gold baseline tick at **x = 120**; a connector line from 120 to the dot; a 7px rotated-45° diamond at `120 + clamp(delta × 17, ±108)` px, transitioning `left .25s ease`. Cyan `#0ae0cf` when above baseline, garnet `#c98aa3` when below.
  - **Null case** (banned in every match — Briar): win cell shows `—` in `#5b5a56`, connector and dot are hidden (`opacity: 0`). Do not plot a zero.
  - Selected row: `background: rgba(200,170,110,.09)`, `box-shadow: inset 0 0 0 1px rgba(200,170,110,.45)`.
- Footer is a `DetailBand`: 62px portrait with the two corner diamonds, name, `BANNED IN N% OF MATCHES`, then five cells — `BAN RATE` (gold, highlighted), `BAN RANK`, `AVAILABLE IN`, `WIN WHEN OPEN`, `VS BASELINE` (cyan/garnet, signed).

**Data.** `BannedChampionStats` — `banRate`, `winRateWhenNotBanned`. `AVAILABLE IN` = `round(matchesPlayed × (1 − banRate/100))`. Baseline = the summoner's own top-3 rate (`PlacementStats.top3Finishes / matchesPlayed`), i.e. the same "win" definition `winRateWhenNotBanned` uses — they must match or the rail lies.

---

## 7a — Placement

**Purpose.** How your finishes are distributed. **Merges the repo's two carousel slides into one figure** — the bar chart is each placement's own count, and the funnel becomes a cumulative line riding over it. The carousel goes away.

**Layout. No sidebar.** `flex-direction: column`, section padding `72px 84px 104px`.
- **Header band**: title block on the left (title, 56×1px gold rule, italic quote *"If you're not first, you're last."*), `flex: 1` spacer, then a horizontal stat strip, baseline-aligned with the title. Strip cells: 9.5px `.22em` label over a display-30px value, `padding: 0 26px`, `border-left: 1px solid rgba(200,170,110,.16)` on all but the first. Cells: **GAMES**, **TOP 1** (gold), **TOP 3**, **TOP 3 STREAK**, **TOP 1 STREAK**.
- Panel below at `margin-top: 46px`, `flex: 1`.

**Panel.** `HextechPanel` titled `DISTRIBUTION`.
- Header: `MATCHES BY FINISHING PLACE` + fading rule + legend `— THIS PLACE OR BETTER` (20px dashed cyan swatch, 10px `.22em` cyan label).
- 8 columns, **108px wide, 48px gap** (pitch 156px, total 1200px), plot height **330px**. Bar height = `count / maxCount × 330`. Count label 26px above each bar, display 19px, `--color-lol-text-secondary`.
- Tiers: 1st Prismatic, 2nd–3rd Gold, 4th+ Silver.
- **Cumulative overlay**: SVG `viewBox="0 0 1200 330"`, `preserveAspectRatio="none"`, `overflow: visible`, `pointer-events: none`. Polyline through `x = 54 + i×156`, `y = 330 − (cumulative / total × 330)`, `stroke: var(--color-lol-blue-300)`, `stroke-width: 1.5`, `stroke-dasharray: 7 6`, `opacity: .85`, `vector-effect="non-scaling-stroke"`. At each vertex an 8px rotated-45° node, `background: #040c14`, `border: 1px solid var(--color-lol-blue-300)` — these are absolutely positioned divs, not SVG, so they stay square under the non-uniform scale.
- Baseline: 1px `rgba(200,170,110,.3)`.
- Axis row: 46px rotated-45° diamond per column, `border: 1px solid rgba(200,170,110,.4)`, `background: rgba(5,14,22,.5)`, ordinal counter-rotated inside at display 15px.

**Data.** `PlacementStats.byPlacement` — build columns from the keys actually present, never a hardcoded 1..8. Cumulative value for place *n* = sum of counts for places ≤ *n*.

---

## 7b — Damage

**Purpose.** Damage dealt and damage taken on one axis, so you can see who trades badly. The repo ships these as two identical sections; this merges them.

**Layout. No sidebar.** Same header band as 7a. Strip cells: **TOTAL DEALT**, **TOTAL TAKEN**, **BEST GAME** (gold).

**Panel.** `HextechPanel` titled `EXCHANGE`.
- Tab row: `TOTAL` / `BEST GAME` (diamond + underline style). On `BEST GAME` only the upper half switches to `maxGame`; taken stays at season total, and the mode caption says so.
- Legend at the right of the tab row: 14×9 swatches — **PHYSICAL** `var(--color-lol-damage)` `#d64545`, **MAGICAL** `var(--color-lol-blue-300)` `#0ac8b9`, **TRUE** `var(--color-lol-gold-300)` `#c8aa6e`. Same three colours as `Damage.tsx`'s `CATEGORIES`.
- Right-aligned mode caption: `SEASON TOTAL · DEALT VS TAKEN` / `BEST SINGLE GAME · DEALT`.
- 10 champion columns, **76px wide, 48px gap**, centred. Each column, top to bottom:
  1. Dealt total, display 15px `--color-lol-text-secondary`, 6px below it
  2. Dealt stack — container `height: 172px`, `justify-content: flex-end`; children true → magical → physical (physical largest, sits on the axis)
  3. Icon row — `padding: 7px 0`, 38px portrait with `background: #050e16` so it masks the axis line; the **axis** is an absolutely positioned 1px `rgba(200,170,110,.35)` line at `top: 50%` stretched `left: -24px; right: -24px` so it runs continuously between columns
  4. Taken stack — `height: 172px`, `justify-content: flex-start`, children physical → magical → true (mirrored), whole stack at `opacity: .5`
  5. Taken total, display 15px `#7f7a6e`
- Both halves scale independently: dealt to the largest dealt total, taken to the largest taken total, each mapping to 172px.
- Footer: `▲ DEALT` left, `▼ TAKEN` right, 10px `.24em`.

**Data.** `champions[].damage.total` / `.maxGame` and `champions[].damageTaken.total`, split `physical` / `magical` / `trueDamage`.

---

## 7c — Economy

**Purpose.** Gold and anvils. The nivo pie becomes three concentric rings — same reading, a shape the chrome already speaks.

**Layout. No sidebar.** Header band with title and quote only (no stat strip — the numbers are the content here).

**Panel.** `HextechPanel` titled `THE VAULT`, body `display: grid; grid-template-columns: 500px minmax(0,1fr); gap: 56px; align-items: center`.

**Left.** Caption `GOLD EARNED`; then the value as display **96px** (`line-height: .9`, `text-shadow: 0 0 34px rgba(200,155,60,.32)`) with the unit `M` as a separate display-40px gold glyph, baseline-aligned. A 220px fading gold rule, then three standard sidebar-style rows: **MOST IN ONE GAME**, **ITEMS PURCHASED**, **CONSUMABLES**.

**Right.** 300×300 SVG, `transform: rotate(-90deg)` so arcs start at 12 o'clock.
- Three rings at **r = 124 / 100 / 76**, `stroke-width: 13`, `fill: none`.
- Track pass first: `stroke: rgba(240,230,210,.06)`, full circle.
- Value pass: `stroke-dasharray` = `(n / maxN) × circumference × 0.78` on, remainder off; `opacity: .9`. The 0.78 factor leaves a deliberate open gap at the top so a full ring never reads as a closed circle.
- Colours: **STAT** `--color-lol-blue-300`, **LEGENDARY** `--color-lol-gold-300`, **PRISMATIC** `--color-lol-mythic` `#d946ef`. Same mapping as `Economy.tsx`'s `ANVIL_COLORS`.
- Centre: total anvils, display 52px, over `ANVILS` at 10px `.28em`.
- To the right, a legend column (`min-width: 220px`): 9px rotated diamond in the ring's colour, label 12.5px `.2em`, count display 23px, rows separated by `border-top: 1px solid rgba(200,170,110,.14)`.

**Data.** `EconomyStats` — all five fields, unchanged.

---

## 7d — Kills

**Purpose.** The repo's three flat stat grids, given a hierarchy.

**Layout. No sidebar.** Header band with title and quote.

**Panel.** `HextechPanel` titled `MULTIKILLS`.
- **Upper half** (`flex: 1`, centred, `gap: 88px`): four plates. Each is a **126×126 rotated-45°** square, `background: rgba(5,14,22,.55)`, with the count counter-rotated inside at display 42px, and a 11px `.28em` label 22px below the plate.
  - **DOUBLE** — `border: 1px solid rgba(185,196,200,.5)`, `box-shadow: 0 0 18px rgba(185,196,200,.14)`, count `#eef2f3`
  - **TRIPLE** — same, border `.7` alpha, shadow `.22`
  - **QUADRA** — `border: 1px solid #c89b3c`, `box-shadow: 0 0 22px rgba(200,155,60,.3)`, count `#f0e6d2`, label `--color-lol-gold-300`
  - **PENTA** — `border: 1px solid #f5eaff`, `box-shadow: 0 0 30px rgba(185,138,221,.45)`, count `#f5eaff`, label `#d8b6f0`, plus an `inset: 5px` prismatic-gradient plane at `opacity: .16` (the `tier-bar-prismatic` fill, animated)
- Counts are **exact per tier**: `exactDouble = doubleKills − tripleKills`, `exactTriple = tripleKills − quadraKills`, `exactQuadra = quadraKills − pentaKills`, `penta = pentaKills`. `Kills.tsx` already computes these — keep that comment, it is the non-obvious part.
- **Lower half**: `border-top: 1px solid rgba(200,170,110,.28)`, three equal columns separated by `border-left: 1px solid rgba(200,170,110,.16)`, each with a 10px `.28em` heading and three label/value rows (13.5px label, display 21px value, `border-top: 1px solid rgba(200,170,110,.14)`).
  - **KILL RECORD** (gold heading): First Bloods, First Blood Assists, Solo Kills
  - **HIGHLIGHTS** (gold heading): Largest Spree, Flawless Aces, Skillshots Hit
  - **FOR THE RECORD** (cyan heading): Fist Bumps, Pings, Skillshots Dodged

**Data.** `KillsStats` + `FunStats.totalFistBumps` / `.totalPings` / `.totalSkillshotsDodged` + `AbilityStats.totalSkillshotsHit`. This retires `modules/Fun.tsx` as a standalone section.

---

## Shared chrome (verify against the components)

- **Card**: 1440×900 in the prototype; in the app it is `CategorySection`'s clamped `max-w-[1920px] max-h-[1080px]` frame. Ratios, not pixels — the prototype is 75% scale.
- **Background stack**, three layers over `#050e16`, all `position: absolute`:
  1. `inset: -40px`, the section photo, `center 38% / cover`, `filter: blur(16px) saturate(.55) brightness(.34) contrast(1.05)`
  2. `radial-gradient(120% 90% at 50% 40%, rgba(5,14,22,.62) 0%, rgba(3,9,16,.9) 62%, #02070c 100%)`
  3. `linear-gradient(180deg, rgba(9,20,40,.55), rgba(2,7,12,.2) 40%, rgba(2,7,12,.85))`
- **Panel**: `linear-gradient(155deg, rgba(9,20,40,.62), rgba(3,10,18,.72))`, `backdrop-filter: blur(3px)`, `border: 1px solid rgba(200,170,110,.3)`; broken top edge; four 13px corner diamonds on `#050e16` with `rgba(200,170,110,.75)` borders; cartouche at `top: -25px` on `#040c14`, 27px display at `.2em` flanked by 9px outlined diamonds. Body padding `44px 36px 26px` (7c uses 52px top, 7d 56px, to centre their content).
- **Bottom separator**: `left/right: 84px`, `bottom: 76px`, the double-break gradient rule.
- **Next-section cue**: 11px diamond, 10px `.34em` gold label, chevron SVG, `animation: rise 6s ease-in-out infinite`.

## Interactions & motion

| Where | Behaviour |
|---|---|
| 5a bar / portrait | click selects; bar lifts `translateY(-7px)` `.2s ease` + 1px gold ring |
| 5a, 6a, 7b toggles | instant re-sort / re-scale; no transition on the sort itself in the prototype — in the app, `HextechBarChart`'s existing `layout="position"` FLIP reorder applies |
| 6a row | click selects; row tint + inset gold ring |
| 6a swing dot | `transition: left .25s ease` |
| 7b tabs | upper half re-scales; `HextechBarChart`'s `transition-[height] duration-450 ease-[cubic-bezier(0.34,1.56,0.64,1)]` is the right easing |
| Prismatic fills | 6s linear loop (`tier-bar-prismatic-shift`) |
| Gold / Silver sheen | 5s linear loop (`tier-bar-sheen-sweep`) |
| Dial | 22s spin, 5s diamond breathe (`Dial`) |
| All of the above | already covered by the `prefers-reduced-motion` block in `globals.css` — keep it |

## State

Per section, all local:

- 5a — `pickSort: "picks" | "rate"`, `selectedChampionId`
- 6a — `banSort: "rate" | "swing"`, `selectedChampionId`
- 7b — `dmgMode: "total" | "best"`
- 7a, 7c, 7d — none

Initial selection: the prototype preselects a mid-table champion to show the readout populated. In the app, default to the top-ranked row of the initial sort, as KDA does.

## Design tokens

Every value in these panels already exists in `apps/web/src/app/globals.css`. Nothing new was introduced except two one-off tints:

- `#c98aa3` — garnet, "below baseline" on 6a's rail and the no-top-4 day in the calendar panel. Worth promoting to a token (`--color-lol-garnet`) since it now appears in two sections.
- `#d8b6f0` — the Penta label; a lightened `--color-augment-prismatic`. Could be derived instead.

Frequently used raw values, all of which have tokens: `#f0e6d2` gold-50, `#c8c2b6` text-secondary, `#a09b8c` text-muted, `#7f7a6e` and `#5b5a56` (dimmer muted — `--color-lol-text-disabled` is `#5b5a56`), `#c8aa6e` gold-300, `#0ac8b9` blue-300, `#0ae0cf` and `#7fe8de` (brightened cyan, no token), `rgba(200,170,110,.14/.16/.22/.28/.3/.4/.6/.75)` for the hairline ladder.

Type: display 96 / 72 / 52 / 42 / 30 / 27 / 23 / 22 / 21 / 19 / 16 / 15 / 12. Body 13.5 / 12.5 / 11.5 / 11 / 10.5 / 10 / 9.5, tracking `.12em` on stat labels, `.2–.28em` on captions, `.34em` on the cue.

## Assets

- Champion portraits — `championIconUrl()`, Data Dragon 14.24.1.
- Section background — `bg-arena.jpg` in this bundle, the prototype's stand-in for `/images/kda-bg.jpg`. Use the real per-section images.
- No icon fonts, no SVG illustration. Every ornament is a rotated square or a hairline div.

## Not finished

**Augments and Prismatic Items have no panel yet.** The intended design is a catalog grid — one tile per entry, bordered by your best result with it: Prismatic if you placed 1st with it, Gold if you finished top 4, Silver if you played it and did neither, flat grey at 22% opacity with `grayscale(1)` if never picked. The frame technique is the existing `.augment-frame` in `globals.css` (transparent border + `background-clip: padding-box, border-box`), with only Prismatic animated — `.augment-frame-silver-static` exists precisely because an animated sheen on 200+ tiles reads as noise.

Sizing that works at 1440: 25 columns × 9 rows of 40px tiles with an 8px gap fits all 225 augments in 1192×424, with a `DetailBand` under it for the selected tile and an `ALL / PLAYED / NEVER` filter row above.

Augment icons resolve from `https://raw.communitydragon.org/latest/game/assets/ux/cherry/augments/icons/<file>.png`; the file names are in the `AUG_DATA` string in the prototype's logic class (all 225, paired with display names). **Prismatic item icons were the blocker** — there is no id-addressable URL I could verify, and `PrismaticItemStats.iconUrl` already carries the right one from your API, so wire that field in rather than deriving a URL.

## Files

- `Arena Stats - Hextech.dc.html` — the prototype. Panels are ordered newest-first: 7a–7d, then 6a, 5a, 4a (calendar), 3a (team slot), 2a and 1a–1c (KDA explorations, already implemented).
- `bg-arena.jpg` — background stand-in.
- `support.js` — the prototype's runtime. Not part of the design; needed only to open the HTML.
