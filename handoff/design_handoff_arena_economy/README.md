# Handoff: Arena Stats — Economy (7c)

## Overview

Reverts Economy to the classic sidebar + `Dial` layout (matching Picks/Bans), and replaces the panel's right side with a new "Shardblade" sub-feature: a droppable item-art medallion, how often the summoner held it, and the stat-anvil numbers that used to live in a donut chart.

## About the design file

`Arena Stats - Hextech.dc.html` is a **design reference written in HTML**, not production code. Recreate it with `apps/web`'s existing `CategorySection` / `Dial` components. Open the file and go to section `7c`.

**Reuse, do not rebuild:** `CategorySection` (sidebar + panel grid, background stack), `Dial` (the identity-column ring — this one displays Gold Earned instead of a champion portrait).

## Layout

**Sidebar** (344px), title `VAULT`:
- `Dial`-shaped ring, standard 286px. Centre content: Gold Earned in `M` format, display 58px value + 26px unit, label `GOLD EARNED` at 10px `.24em` below. (Same ring chrome as `Dial` — two hairline circles, spinning arc, two breathing diamonds — just showing gold instead of a champion.)
- `margin-top: auto`, then the same three stat rows the previous iteration had: **MOST IN ONE GAME**, **ITEMS PURCHASED**, **CONSUMABLES** (`EconomyStats.mostGoldInOneGame`, `.itemsPurchased`, `.consumablesPurchased`).

**Panel**, titled `THE SHARDBLADE`:
- **Medallion** (172px), same construction as the 10a welcome-card medallion: dashed outer ring spinning 64s, a counter-rotating diamond ring at 44s with two gold diamonds, and an inner rotated-45° plate holding the art. **The art itself is a drop target** — wire it to `PrismaticItemStats` (find the entry named "Shardblade" or whichever ID matches the item; use its `iconUrl` directly, no derivation needed, same as the panels README already noted for prismatic items generally).
- Below it: a number/name pair — display 40px count over `Shardblade` at display 22px, then a caption `N% OF TRACKED MATCHES`. This is **how many tracked matches the summoner held this specific Prismatic Item at match end** — `PrismaticItemStats.items[].timesHeld` for this item, as a percentage of `profile.matchesPlayed`.
- Three diamond plates in a row, same 168px rotated-45° shape as the sidebar-adjacent panels use elsewhere:
  1. **TIME HELD** — cyan-edged (`rgba(10,200,185,.55)`), duration display. **This field doesn't exist in the API yet** — needs a new derived stat (sum of `timePlayedSeconds` across matches where the item was held, or similar). Placeholder in the prototype: `14h 16m`.
  2. **STAT ANVILS** — gold-edged (`rgba(200,170,110,.55)`), total count bought. Source: `EconomyStats.anvils.stat`.
  3. **MOST IN ONE MATCH** — gold-solid edge (`#c8aa6e`), single-match max. **Also not in the API yet** — `AnvilsBreakdown` only has season totals, not a per-match max. Needs a new derived stat, analogous to `EconomyStats.mostGoldInOneGame` but for `anvils.stat` specifically.

The earlier three-ring anvil donut (Stat/Legendary/Prismatic breakdown) is **removed** from this panel — Legendary and Prismatic anvil counts are no longer shown here at all. Confirm with the design owner whether those two still need a home elsewhere, or whether Stat anvils (the ones tied to the Shardblade) were deliberately made the sole focus.

## Data

| Element | Source | Status |
|---|---|---|
| Gold earned (Dial) | `EconomyStats.totalGoldEarned` | existing |
| Most in one game / Items purchased / Consumables | `EconomyStats.mostGoldInOneGame` / `.itemsPurchased` / `.consumablesPurchased` | existing |
| Shardblade art | `PrismaticItemStats.items[].iconUrl` (match by name/id) | existing field, need the right item |
| Shardblade times held (count + %) | `PrismaticItemStats.items[].timesHeld` ÷ `profile.matchesPlayed` | existing |
| Time held (duration) | — | **new field needed** |
| Stat anvils total | `EconomyStats.anvils.stat` | existing |
| Stat anvils, most in one match | — | **new field needed** |

## Assets

- Shardblade art — no verified icon URL for this specific item was available while designing; the prototype uses a drop-target placeholder (`<image-slot>`, a small drag-and-drop web component in this bundle) so the real artwork can be dropped in later. In the app, use `PrismaticItemStats.items[].iconUrl` once the right item is identified.

## Files

- `Arena Stats - Hextech.dc.html` — the prototype; open it and go to `#7c`.
- `bg-arena.jpg`, `support.js`, `image-slot.js` — supporting assets to view the prototype, not part of the design (the last is the placeholder drop-target used for the Shardblade art in the mockup only).
