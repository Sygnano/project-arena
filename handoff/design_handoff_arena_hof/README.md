# Handoff: Arena Stats — Champion Hall of Fame (8a)

## Overview

A new full-screen section: the entire champion catalog as one grid, each portrait tiered by the summoner's best-ever finish on that champion. No sidebar, no per-champion drilldown — the grid itself is the content. Fills a gap noted in the earlier panels handoff (`design_handoff_arena_panels`) as "no panel yet."

## About the design file

`Arena Stats - Hextech.dc.html` is a **design reference written in HTML**, not production code to copy. Recreate it in `apps/web` with `CategorySection`. Open the file and go to section `8a` (there's also an alternate take, `8b`, with no ring/no frame — 8a is the approved direction).

**Reuse, do not rebuild:** `CategorySection` for the background stack; `HextechPanel` for the broken-corner frosted panel and corner diamonds (this panel has **no title cartouche** — see below).

## Fidelity

High-fidelity. Same two font substitutions as every other panel: **Marcellus** stands in for **Beaufort for LoL** (`--font-display`); **Barlow** stands in for **Spiegel** (`--font-body`).

## Layout

No sidebar. `flex-direction: column`, section padding `56px`.

**Header band** — title `CHAMPIONS`, 56×1px gold rule, italic quote placeholder (needs real copy), `flex:1` spacer, then a three-cell stat strip, baseline-aligned with the title, `padding: 0 26px` per cell with `border-left: 1px solid rgba(200,170,110,.16)` on all but the first:
- **PLAYED** — count of champions with at least one tracked match.
- **WON WITH** — count of champions with at least one *win* on them, where "win" is the repo's existing convention (`PlacementStats.top3Finishes`-style: placement 1st–3rd). I.e. `top1 > 0 || top3ExclTop1 > 0`.
- **FIRST PLACE** (gold-tinted label+value) — count of champions with at least one 1st-place finish (`top1 > 0`).

**Panel** — `HextechPanel` equivalent, but **no title cartouche at all** (no label breaking the top edge). Keep the broken top-edge highlight and the four corner diamonds; just omit the centered label block entirely.

Panel body padding: **32px on all four sides, equal** (not the asymmetric top-heavy padding `HextechPanel` normally uses to clear its title — there's no title here to clear).

**Grid**: `display: grid; grid-template-columns: repeat(N, minmax(0,1fr)); gap: 20px`, vertically centered in the panel (`justify-content: center` on the flex column wrapping it). `N` (columns) should be a tunable layout parameter — default **18** — the grid must support 12–28 columns without changing champion order.

Each cell: a circular portrait with a tier-colored ring —
- Ring is a rotated background (no ring, just a `border-radius:50%` padding box) filled with the tier gradient, `box-sizing: border-box`, `padding` scaling **1.5px → 3px** as tier climbs (grey lowest, prismatic thickest), matching bloom via `box-shadow`.
- On hover: `transform: scale(1.22)`, `z-index: 6`, transition `.18s ease`.
- Never-played champions: greyscale portrait at reduced opacity (prototype uses `grayscale(1) brightness(.7)` at `opacity: .3`), hairline grey ring, no glow.

## Tier logic (must match exactly)

Order is the full catalog, **never reordered by tier or by clicking** — alphabetical by champion name is what the prototype uses and should stay fixed regardless of column count changes.

Tier per champion, evaluated from `ChampionPickBreakdown` (already returned per-champion by `ChampionPicksStats.champions`) joined against the full roster from `ChampionCatalogStats.champions` (which includes champions with zero picks — `ChampionPickBreakdown` only has entries for champions actually played):

| Condition | Tier | Ring |
|---|---|---|
| Champion not present in `championPicks` (never picked) | **Grey / none** | hairline `rgba(126,138,150,.3)`, no animation, portrait greyscale + dimmed |
| Present, `top1 === 0 && top3ExclTop1 === 0` (only ever finished 4th+) | **Silver** | `.tier-bar-silver` fill (swept sheen) |
| `top1 === 0 && top3ExclTop1 > 0` (won — top 3 — but never 1st) | **Gold** | `.tier-bar-gold` fill (swept sheen) |
| `top1 > 0` (at least one 1st-place finish) | **Prismatic** | `.tier-bar-prismatic` fill (animated iridescent loop) |

This is the same tier system and the same three CSS classes already adopted for every other panel in this project (`globals.css`'s `.tier-bar-*`) — no new visual system to build.

## Data

| Element | Source |
|---|---|
| Full roster, fixed order | `ChampionCatalogStats.champions` (`championId`, `championName`) — this is the champion universe; iterate this list, not `championPicks` |
| Per-champion tier | `ChampionPicksStats.champions[].top1` / `.top3ExclTop1` (see table above) — champions absent from this array are the "never played" tier |
| PLAYED stat | count of `championCatalog.champions` that have a matching entry in `championPicks.champions` |
| WON WITH stat | count of `championPicks.champions` where `top1 > 0 \|\| top3ExclTop1 > 0` |
| FIRST PLACE stat | count of `championPicks.champions` where `top1 > 0` |
| Portrait | `championIconUrl(championName)` — reuses the existing helper in `lib/riot.ts`; mind its `CHAMPION_NAME_OVERRIDES` map (e.g. `FiddleSticks` → `Fiddlesticks`) |

No new API fields needed — this section is derivable entirely from data the other panels already consume.

## Interaction

None. This is a static display grid — no click-to-select, no readout strip, no legend. Hover only shows the scale-up (a nice-to-have, not required).

## Design tokens

Same tier-fill tokens as the rest of the app (`.tier-bar-prismatic`, `.tier-bar-gold`, `.tier-bar-silver` in `globals.css`) plus the standard hairline ladder (`rgba(200,170,110,.14–.75)`), gold-50 `#f0e6d2`, gold-300 `#c8aa6e`, text-muted `#a09b8c`.

## Not finished / open questions

- **Quote placeholder** under the title (`"Allan add quote here"`) needs real copy.
- Column count (12–28) should probably be a responsive breakpoint choice rather than a fixed constant — the prototype exposes it as a design-time tweak, not a runtime control.

## Files

- `Arena Stats - Hextech.dc.html` — the prototype; open it and go to `#8a` (alternate take at `#8b`).
- `bg-arena.jpg`, `support.js` — supporting assets to view the prototype, not part of the design.
