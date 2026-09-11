# Handoff: Arena Stats — KDA section (Hextech)

## Overview

The KDA section of the Arena Stats site (`Sygnano/project-arena`). One full-viewport
section at 1440×900: a left identity column (section title, KDA dial, K/D/A totals) and a
right instrument panel holding an interactive per-champion bar chart with a detail readout.
Visual language follows Riot's Hextech system — deep navy ground, gold linework, cyan energy,
diamonds instead of corners.

The page is designed as one long scroll; this is section 1 of several (Damage, Champions,
Items, Match history follow). The bottom cue hands off to the next section.

## About the design files

The files in `reference/` are **design references created in HTML** — a prototype showing the
intended look and behavior, not production code to copy. Recreate this design in the target
codebase's own environment (the repo's React/Vue/whatever stack) using its established
patterns, component library, and data layer. Where the repo already has primitives (a Card, a
Tabs control, a chart wrapper), use them and match the visual spec below rather than porting
the prototype's markup.

Open `reference/Arena Stats - Hextech.dc.html` directly in a browser to see it running.
It contains three earlier explorations too (`1a`, `1b`, `1c`) — **implement `2a`, the topmost
option**; the others are kept only as visual context for the treatments that were rejected.

## Fidelity

**High-fidelity.** Colors, typography, spacing, and interaction behavior are final. Recreate
pixel-accurately at 1440px. The only placeholder content is the data itself (see *Data* below)
and the background photograph.

## Screen: KDA section

**Frame:** 1440 × 900, `overflow:hidden`, `position:relative`. Designed for desktop at 1440;
no responsive behavior was specified.

### Background stack (4 layers, bottom to top)

1. Photo layer — `inset:-40px`, `background: url(bg-arena.jpg) center 38% / cover no-repeat`,
   `filter: blur(16px) saturate(.55) brightness(.34) contrast(1.05)`. The negative inset keeps
   the blur from feathering at the frame edge.
2. Vignette — `radial-gradient(120% 90% at 50% 40%, rgba(5,14,22,.62) 0%, rgba(3,9,16,.9) 62%, #02070c 100%)`
3. Vertical tint — `linear-gradient(180deg, rgba(9,20,40,.55), rgba(2,7,12,.2) 40%, rgba(2,7,12,.85))`
4. Base fill behind everything: `#050e16`

Content occupies roughly 60% of the frame; the remaining 40% is this darkened arena. Keep that
ratio — it is the point of the treatment.

### Layout

`position:absolute; inset:0; display:grid; grid-template-columns: 344px minmax(0,1fr); gap:48px; padding:72px 84px 104px`

The `minmax(0,1fr)` matters: with a plain `1fr` the chart's `width:max-content` row blows the
track out and the panel overflows the frame instead of scrolling.

### Left column (344px) — `display:flex; flex-direction:column`

| Element | Spec |
|---|---|
| Section title "KDA" | Marcellus 52px, `line-height:1`, `letter-spacing:.08em`, `#f0e6d2` |
| Rule under title | 56 × 1px, `rgba(200,170,110,.6)`, `margin-top:12px` |
| Quote "The KDA is the KDA." | Barlow italic 13px, `#a09b8c`, `margin-top:14px` (curly quotes) |
| KDA dial | 286 × 286, `margin:44px auto 0`, centered flex |
| Totals list | `margin-top:auto` (pins to bottom of column) |

**KDA dial**, layered center-out:
- Inner ring: `inset:32px`, `border-radius:50%`, `1px solid rgba(200,170,110,.22)`
- Cyan ring: `inset:20px`, `border-radius:50%`, `1px solid rgba(10,200,185,.16)`
- SVG arc set, `viewBox 0 0 286 286`, whole SVG `animation: spin 22s linear infinite`
  - arc A: `cx/cy 143, r 122`, stroke `#0ac4d9`, width 2, `stroke-linecap:round`,
    `stroke-dasharray:"144 622"`, `opacity:.9`, `filter: drop-shadow(0 0 8px rgba(10,196,217,.9))`
  - arc B: same geometry, stroke `#0ac8b9`, width 1, `stroke-dasharray:"38 728"`,
    `stroke-dashoffset:-290`, `opacity:.5`
- Two 12px gold diamonds (`transform:rotate(45deg)`, `#c8aa6e`) at top and bottom center
  (`top:-2px` / `bottom:-2px`, `left:50%`, `margin-left:-6px`), each
  `animation: breathe 5s ease-in-out infinite`, the lower one delayed `2.5s`
- Center value: Marcellus 72px `#f0e6d2`, `text-shadow: 0 0 26px rgba(10,200,185,.35)`
- Center label "KDA": 12px, `letter-spacing:.42em`, `#0ac8b9`, `padding-left:.42em`
  (the padding compensates for the trailing letter-space so the text stays optically centered)

**Totals rows** (KILLS / DEATHS / ASSISTS), `display:flex; flex-direction:column; gap:2px`.
Each row: `display:flex; align-items:center; gap:14px; padding:13px 4px;`
`border-top:1px solid rgba(200,170,110,.14)` (last row also gets `border-bottom`).
- 7px gold diamond (`rotate(45deg)`, `#c8aa6e`, `flex:none`)
- Label: 14px, `letter-spacing:.12em`, `#c8c2b6`, `flex:1`
- Value: Marcellus 22px, `#f0e6d2`

### Right column — the instrument panel

Wrapper: `position:relative; align-self:stretch; min-width:0; margin-top:26px`.

**Frame chrome** (all absolutely positioned on the wrapper):
- Fill: `inset:0`, `linear-gradient(155deg, rgba(9,20,40,.62), rgba(3,10,18,.72))`,
  `backdrop-filter: blur(3px)`, `border:1px solid rgba(200,170,110,.3)`
- Broken top edge: `left:14px; right:14px; top:-1px; height:1px`,
  `linear-gradient(90deg, transparent, rgba(200,170,110,.5) 20%, transparent 44%, transparent 56%, rgba(200,170,110,.5) 80%, transparent)`
  — the gap at 44–56% is where the title cartouche sits.
- Four corner diamonds: 13px, `rotate(45deg)`, `background:#050e16`,
  `border:1px solid rgba(200,170,110,.75)`, offset `-7px` on both axes. The corners are
  *interrupted*, not rounded — this is the core Hextech move, keep it.
- Title cartouche: `left:50%; top:-25px; transform:translateX(-50%)`, flex row, `gap:16px`,
  `background:#040c14; padding:0 22px` (the opaque background is what visually cuts the
  border). Content: 9px outlined diamond · metric name in Marcellus 27px `letter-spacing:.2em`
  `#f0e6d2` · 9px outlined diamond. **The title text is the active metric** (KILLS / DEATHS /
  ASSISTS / KDA), not a static label.

**Panel body:** `position:relative; height:100%; min-width:0; box-sizing:border-box;`
`padding:44px 36px 26px; display:flex; flex-direction:column`.

**1. Control row** — `display:flex; align-items:center; gap:24px; margin-bottom:20px`

Left: four metric tabs (KILLS, DEATHS, ASSISTS, KDA). Each is
`display:flex; align-items:center; gap:8px; padding:0 2px 7px; cursor:pointer` with a 6px gold
diamond and 11.5px text at `letter-spacing:.26em`.
- active: text `#f0e6d2`, `border-bottom:1px solid #c8aa6e`, diamond `opacity:1`
- inactive: text `#8a8578`, `border-bottom-color:transparent`, diamond `opacity:0`

Then a spacer rule: `flex:1; height:1px; linear-gradient(90deg, rgba(200,170,110,.28), transparent)`

Right: the mode switch, a framed pair — outer
`display:flex; align-items:center; gap:14px; padding:2px 4px; border:1px solid rgba(200,170,110,.22)`,
each chip `padding:5px 12px; font-size:10.5px; letter-spacing:.24em`.
- active: `color:#f0e6d2`, `background:rgba(200,170,110,.16)`
- inactive: `color:#8a8578`, `background:transparent`

Two switch shapes on purpose: the metric tabs are the primary axis (underlined tabs), the
TOTAL / BEST GAME mode is secondary (small framed chips). Don't unify them.

**2. Mode caption** — right-aligned, `margin:-6px 0 10px`, 11px, `letter-spacing:.28em`,
`#a09b8c`. Text: `SEASON TOTAL · BY CHAMPION`, or `BEST SINGLE GAME · BY CHAMPION`, or
`BEST SINGLE GAME · FEWEST DEATHS` for the deaths+best combination.

**3. Chart (horizontal scroller)** —
`flex:1; min-height:0; min-width:0; width:100%; display:flex; flex-direction:column;`
`overflow-x:auto; overflow-y:hidden; scrollbar-width:thin;`
`scrollbar-color: rgba(200,170,110,.45) transparent`

Bars row: `flex:1; min-height:0; display:flex; align-items:flex-end; gap:16px; padding:0 2px;`
`border-bottom:1px solid rgba(200,170,110,.3); min-width:100%; width:max-content`

Each column: `width:54px; flex:none; display:flex; flex-direction:column;`
`align-items:center; justify-content:flex-end; gap:8px; cursor:pointer`
- value label: Marcellus 17px
- cap diamond: 11px, `rotate(45deg)`, 1px border
- bar: `width:100%`, computed height, gradient fill, 1px top border

Leader (rank 1) vs the rest:

| | leader | others |
|---|---|---|
| bar fill | `linear-gradient(180deg,#0ae0cf,rgba(10,224,207,.16))` | `linear-gradient(180deg,#0aa8a0,rgba(4,82,95,.2))` |
| bar top border | `#e6fffb` | `rgba(10,224,207,.55)` |
| glow | `0 0 22px rgba(10,224,207,.65)` (on bar and cap) | none |
| cap fill / border | `#e6fffb` / `#e6fffb` | `#0b1620` / `rgba(10,200,185,.75)` |
| value color | `#e6fffb` | `#c8c2b6` |

Portrait row below: `display:flex; gap:16px; padding:12px 2px 4px; min-width:100%; width:max-content`.
Each cell `width:54px; flex:none`, column flex, `gap:5px`, `cursor:pointer` —
36×36 champion icon with a 1px border, and beneath it a 7px gold diamond that is only
visible (`opacity:1`) for the selected champion.

Icon border: `#c8aa6e` when selected, `rgba(10,224,207,.8)` for the leader,
`rgba(200,170,110,.22)` otherwise.

**4. Detail band** — `margin-top:20px; padding-top:18px;`
`border-top:1px solid rgba(200,170,110,.28); display:grid;`
`grid-template-columns: auto minmax(0,1fr); gap:26px; align-items:center`

Left: 62×62 champion portrait, `border:1px solid rgba(200,170,110,.6)`, with two 9px
diamonds pinned at its top-left (`-5px,-5px`) and bottom-right, filled `#040c14` with
`1px solid rgba(200,170,110,.8)`. Beside it: champion name in Marcellus 22px
`letter-spacing:.06em` `#f0e6d2`, and under it `{games} GAMES` at 10.5px,
`letter-spacing:.22em`, `#7f7a6e`.

Right: six stat cells, `display:grid; grid-template-columns: repeat(4,minmax(0,1fr)) 1.5fr 1fr`.
Each cell `padding:0 14px`, all but the first with
`border-left:1px solid rgba(200,170,110,.16)`. Label 9.5px `letter-spacing:.22em` `#a09b8c`
(`white-space:nowrap`), value Marcellus 21px `#f0e6d2`, `margin-top:6px`.
Cells: KILLS · DEATHS · ASSISTS · **KDA** (label `#0ac8b9`, value `#0ae0cf`) ·
BEST GAME (`"{k} / {d} / {a}"`) · 1ST PLACE (percentage).

### Bottom handoff cue

Broken rule: `position:absolute; left:84px; right:84px; bottom:76px; height:1px`,
`linear-gradient(90deg, transparent, rgba(200,170,110,.24) 26%, rgba(200,170,110,.24) 42%, transparent 47%, transparent 53%, rgba(200,170,110,.24) 58%, rgba(200,170,110,.24) 74%, transparent)`
— the 47–53% gap is where the diamond sits.

Cue stack: `position:absolute; left:0; right:0; bottom:22px; display:flex;`
`flex-direction:column; align-items:center; gap:9px; cursor:pointer;`
`animation: rise 6s ease-in-out infinite`. Contents: 11px diamond (`#040c14` fill,
`1px solid rgba(200,170,110,.7)`, `margin-bottom:-1px`) · next-section name at 10px
`letter-spacing:.34em` `#c8aa6e` `padding-left:.34em` · a chevron SVG
(`viewBox "0 0 18 8"`, `path "M1 1 L9 7 L17 1"`, stroke `#c8aa6e`, width 1.4, `opacity:.75`).

⚠ **Centering trap:** the `rise` keyframes animate `transform`, so the wrapper cannot be
centered with `translateX(-50%)` — the animation replaces it and the cue lands half its own
width off-axis. Center it with full-width + `align-items:center` (as above), or bake the
translate into the keyframes.

Clicking the cue should scroll to the next section. In the prototype the next section is
labelled DAMAGE; wire it to the real next section.

## Interactions & behavior

| Trigger | Result |
|---|---|
| Click a metric tab | `metric` = kills \| deaths \| assists \| kda. Chart re-sorts and re-scales; panel title text changes; mode caption updates. |
| Click TOTAL / BEST GAME | `mode` = total \| best. Chart re-sorts against the other value set. |
| Click a bar **or** its portrait | `sel` = that champion. Detail band swaps; that champion's icon border goes gold and its marker diamond appears. |
| Horizontal scroll in the chart | Native overflow scroll through all champions; both the bar row and portrait row scroll together (they live in the same scroller). |
| Click the bottom cue | Scroll to next section. |

**Ranking rules — get these right, they carry meaning:**
- Default sort is descending by the active value; rank 1 gets the bright leader styling.
- **DEATHS + BEST GAME is inverted**: sort ascending (fewest deaths is best) *and* invert the
  height mapping, so the best champion is still the tallest bar. Taller must always mean
  better; without the inversion the bright "leader" column is a 14px stub next to a
  full-height worst result.
- **KDA uses a raised baseline.** Values cluster (roughly 1.4–5.1), so scaling from 0 gives a
  flat wall. Bar floor = `max(0, min - (max-min) * 0.45)`.
- Bar height range: 14px minimum, 300px maximum.

**Animations** (all subtle and ambient; nothing else moves):

```css
@keyframes spin    { to { transform: rotate(360deg) } }                     /* dial, 22s linear */
@keyframes breathe { 0%,100% { opacity:.35 } 50% { opacity:.85 } }          /* dial diamonds, 5s */
@keyframes rise    { 0%,100% { transform:translateY(0) }
                     50%     { transform:translateY(-5px) } }               /* bottom cue, 6s */
```

No transition is specified on bar heights; adding a short `transform`/`height` transition
(~200ms ease-out) on metric change would be a reasonable enhancement, but ask first — the
brief called for restrained motion.

## State

```
metric : "kills" | "deaths" | "assists" | "kda"   default "kills"
mode   : "total" | "best"                          default "total"
sel    : champion name                             default the leading champion
```

All three are local UI state. Chart rows are derived from (roster, metric, mode, sel) — treat
the derivation as a pure function; there is no data fetching in the prototype.

Per champion the view needs: `games, kills, deaths, assists, firstPlacePct`, plus a `best`
object `{ kills, deaths, assists }` for the best single game. `kda` is derived
(`(kills + assists) / deaths`), as is `best.kda` (`(bestK + bestA) / max(1, bestD)`).

## Design tokens

| Token | Value | Use |
|---|---|---|
| ground | `#050e16` | section base |
| ground deep | `#02070c` | vignette outer |
| panel ink | `#040c14` | cartouche/diamond fills that cut lines |
| navy | `rgba(9,20,40,…)` | panel fill, top tint |
| gold | `#c8aa6e` | linework, diamonds, labels, active state |
| gold dim | `rgba(200,170,110,.3 / .22 / .16 / .14)` | frame border / chip frame / cell dividers / row rules |
| parchment | `#f0e6d2` | primary type |
| parchment dim | `#c8c2b6` | secondary type |
| grey | `#a09b8c` | tertiary labels, captions |
| grey dark | `#8a8578`, `#7f7a6e` | inactive tabs, meta |
| cyan | `#0ac8b9` | accent type, rings |
| cyan bright | `#0ae0cf` | leader bar, KDA value |
| cyan pale | `#e6fffb` | leader highlights, brightest ink |
| cyan deep | `#0aa8a0`, `#04525f` | standard bar gradient |

Type: **Marcellus** for all numerals and display text (stand-in for Riot's Beaufort),
**Barlow** 300–700 for labels and UI (stand-in for Spiegel). If the codebase has licensed
Beaufort/Spiegel, use those instead — the design was drawn to their proportions.

Letter-spacing scale for gold labels: `.22em` / `.26em` / `.28em` / `.34em` / `.42em` — the
smaller the type, the wider the tracking. Always add matching `padding-left` on centered
tracked text.

Radius: **none anywhere.** Every corner is square or interrupted by a diamond.
Diamond sizes in use: 6, 7, 9, 11, 12, 13, 15px — all `transform: rotate(45deg)` squares.

## Assets

- `reference/bg-arena.jpg` — arena splash art supplied by the user, used blurred/darkened only.
  Replace with whatever the production site serves; any dark, low-detail environment shot works
  given the blur.
- Champion portraits — Data Dragon, `https://ddragon.leagueoflegends.com/cdn/14.24.1/img/champion/{Champion}.png`.
  Static in the prototype; pin or update the patch version in production.

## Data

⚠ **All numbers in the prototype are hand-authored placeholders**, written so each metric has a
distinct shape (some champions kill-heavy, some assist-heavy, some death-heavy) and so the
re-ranking is visible when switching metrics. The 18-champion roster, the totals (2,590 kills /
2,481 deaths / 3,925 assists), the 2.63 dial value, and the 1st-place percentages are all mock.
Replace with real per-champion aggregates; the dial value should be the account-level KDA.

## Files

- `reference/Arena Stats - Hextech.dc.html` — the design; implement option **2a** (topmost).
  `1a` / `1b` / `1c` below it are earlier explorations, for context only.
- `reference/support.js` — runtime needed to open that file in a browser. Not part of the design.
- `reference/bg-arena.jpg` — background image.
