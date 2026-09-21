# Handoff: Arena Stats — Welcome card (10a)

## Overview

A new opening screen for the Arena Stats summoner page — a held identity moment before any stats load, replacing the small `Overview` block currently at the top of `stats-view.tsx` with a full-screen card in the Hextech language.

The real header it replaces lives in `apps/web/src/app/summoner/[platform]/[riotId]/stats-view.tsx`, the `<CategorySection title="Overview">` block (~lines 73–105): avatar + `{riotIdGameName}#{riotIdTagline}` + one line `Level {summonerLevel} • {matchesPlayed} Arena matches`. This design keeps the icon, name, tag and level; it deliberately does **not** carry over the match count (see below) and adds two facts the header doesn't currently show (region, season).

## About the design file

`Arena Stats - Hextech.dc.html` is a **design reference written in HTML**, not production code to copy. Recreate it in `apps/web` with the existing React/Next/Tailwind setup and `CategorySection`. Open the file in a browser and scroll to section `10a` — it's a single static 1440×900 card, no interaction.

**Reuse, do not rebuild:** `CategorySection` for the section wrapper/background stack; `Avatar`/`AvatarImage`/`AvatarFallback` for the profile icon (swap in the new frame treatment around it, don't replace the primitive).

## Fidelity

High-fidelity. Two font substitutions, same as every other panel in this project:
- **Marcellus** stands in for **Beaufort for LoL** (`--font-display`).
- **Barlow** stands in for **Spiegel** (`--font-body`).

## Layout (top to bottom, all centred on a single column)

1. **Corner brackets** — four 20px `L`-shaped corner marks, `1px solid rgba(200,170,110,.5)`, `inset: 40px` from each edge. Purely decorative frame, no label content in the corners.

2. **Medallion** (228×228px), profile icon at the centre:
   - Outer dashed ring: full circle, `border: 1px dashed rgba(200,170,110,.38)`, `border-radius: 50%`, spinning `64s linear infinite`.
   - Middle ring, `inset: 20px`, counter-spinning `44s linear infinite reverse`: a rotated-45° square outline (`1px solid rgba(200,170,110,.45)`) with an 8px gold diamond fixed at its top point and another at its bottom point (so the two diamonds appear to orbit as the square spins).
   - Inner plate, `inset: 38px`, rotated-45° square, `border: 1px solid rgba(200,170,110,.7)`, `background: rgba(4,12,20,.6)`, `box-shadow: 0 0 70px rgba(200,170,110,.16)` — this is what actually frames the icon; the icon itself is NOT rotated (counter-rotate it, or lay it on top unrotated at the same center).
   - A soft inner teal glow breathing behind everything: full circle, `box-shadow: 0 0 90px rgba(10,200,185,.1) inset`, `animation: breathe 7s ease-in-out infinite`.
   - Profile icon: 104×104px circle (well, square with `border:1px solid rgba(200,170,110,.5)` in the prototype — round it in the app to match `Avatar`), `profileIconUrl(profile.profileIconId)`.
   - Level badge: rotated-45° 36×36px square pinned at the medallion's bottom edge (`bottom: 14px`), `background: #040c14`, `border: 1px solid rgba(200,170,110,.75)`, counter-rotated number inside, display 15px, `#c8aa6e`. Value = `summonerLevel`.

3. **Eyebrow**: `WELCOME, SUMMONER`, 10.5px, `letter-spacing: .42em`, `#c8aa6e`, `margin-top: 52px` from the medallion.

4. **Name row**, `margin-top: 22px`: `{riotIdGameName}` at display **92px** (`line-height:1`, `letter-spacing:.05em`, `#f0e6d2`, `text-shadow: 0 0 48px rgba(200,170,110,.22)`), baseline-aligned next to `#{riotIdTagline}` at display 30px, `#7f7a6e`.

5. **Divider**, `margin-top: 34px`: two 180px fading gold rules flanking a 9px outlined diamond, same motif used as the "cue" divider elsewhere in the app.

6. **Plaque**, `margin-top: 36px` — a bordered rectangle (`1px solid rgba(200,170,110,.3)`, `background: rgba(4,12,20,.45)`, padding `16px 34px`) with four 11px rotated-45° corner diamonds (`background:#040c14; border:1px solid rgba(200,170,110,.7)`) at each corner, containing two fact-groups separated by a 1px vertical rule (`rgba(200,170,110,.22)`, 42px tall):
   - **Left — REGION**: 9px `.26em` `#7f7a6e` label over display 19px `.14em` `#c8c2b6` value (e.g. `EUROPE WEST`).
   - **Right — SEASON**: a small hextech seal icon (44×44px: rotated-45° square `border:1px solid #c8aa6e; background:rgba(200,170,110,.1); box-shadow:0 0 22px rgba(200,170,110,.25)`, with a smaller breathing rotated-45° ring inset 9px and a 7px solid gold diamond at the centre) beside a 9px `.26em` `#c8aa6e` label over display 19px `.14em` `#f0e6d2` value (e.g. `SEASON 3`).

   **The match count is intentionally not shown anywhere on this card.** It was cut from the plaque deliberately (an earlier iteration sealed it behind blank bars; the current version just omits it) — the count is meant to land as a stat once the report itself begins, not on the welcome card.

7. **Scroll cue**, pinned to the card's bottom edge (`bottom: 62px`): `SCROLL TO BEGIN` at 9.5px `.34em` `#7f7a6e`, then a chevron. **Implementation note the app must get right**: the chevron's 45° rotation and its rise animation must be on *separate* nested elements — `@keyframes rise` animates `transform: translateY(...)`, so if the same element also carries `transform: rotate(45deg)` inline, the animation silently replaces the rotation for the whole cycle and the chevron renders as an unrotated corner bracket. Structure: outer `div` with `animation: rise 2.6s ease-in-out infinite`, inner `div` with `transform: rotate(45deg)` + the two borders (`border-right`, `border-bottom`, `1px solid #c8aa6e`, 11×11px).

## Background stack

Same three-layer stack as every other panel, but **sharper** than the rest of the app — this card is meant to read as a real photo, not a texture:
1. `inset: -20px`, `bg-arena.jpg` (swap for the real hero art), `center 42% / cover`, `filter: blur(2px) saturate(.7) brightness(.46) contrast(1.06)` — much lighter blur than the standard `blur(16px)` used elsewhere.
2. `radial-gradient(78% 70% at 50% 48%, rgba(3,10,18,.28) 0%, rgba(2,8,14,.86) 58%, #01050a 100%)`.
3. `linear-gradient(180deg, rgba(9,20,40,.5), transparent 34%, transparent 62%, rgba(1,5,10,.9))`.

## Data

| Element | Source |
|---|---|
| Profile icon | `profileIconUrl(profile.profileIconId)` — pin to the app's real Data Dragon version (`DDRAGON_VERSION` in `lib/riot.ts`, currently `16.17.1`; the prototype used a stale `14.24.1`, fix on port) |
| Name / tag | `profile.riotIdGameName`, `profile.riotIdTagline` |
| Level | `profile.summonerLevel` |
| Region | Not currently in `SummonerProfile` — comes from the `[platform]` route param today. Either thread it into the profile response or read it from the route. |
| Season | Not in the API at all yet — needs a real source (a season identifier from the backend, or a static value if Arena doesn't version by season server-side). Placeholder in the prototype is `SEASON 3`. |
| Matches played | Deliberately unused on this screen. |

## Assets

- Profile icon — same `profileIconUrl()` helper the rest of the app uses.
- Background — `bg-arena.jpg` in this bundle is a stand-in; use real hero art for the welcome moment specifically (it's allowed to be a different image than the section backgrounds, since it's sharper here).

## Files

- `Arena Stats - Hextech.dc.html` — the prototype; open it and go to `#10a`.
- `bg-arena.jpg`, `support.js` — supporting assets to view the prototype, not part of the design.
