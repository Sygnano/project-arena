# Arena Stats — Design Context Export

This doc is a snapshot of the "Arena Stats" project for a design-focused conversation on
Claude web/desktop (this project doesn't have image generation, so design/mockup work happens
there instead). Upload this file, `CLAUDE.md`, and the screenshots in this same folder as
Project knowledge so Claude there has full context without re-explaining the whole build.

## What this is

A League of Legends **Arena** game-mode stats tracker for a friend group — think "op.gg, but
scoped to Arena mode and to the summoners we actually track." Not a public tool: a small,
fixed-ish list of tracked Riot IDs, no auth, no public lookup.

## Tech stack (context, not what design conversations need to touch)

Next.js (App Router) + Tailwind v4 + shadcn/ui on the frontend, Fastify + Postgres/Drizzle on the
backend, pnpm/Turborepo monorepo. Charts via Nivo (`@nivo/bar`, `@nivo/pie`, `@nivo/scatterplot`).
Full architecture/domain details live in `CLAUDE.md` — read that for anything data-model related;
this doc is scoped to what a design conversation actually needs.

## Design system — "Hextech" (dark, League-themed)

Ported from an earlier prototype and already fully wired up in `apps/web`. This is the *current*
visual language everything is built in — any new design work should either extend it consistently
or deliberately propose changing it.

**Fonts**
- Display/headings: **Beaufort for LoL** (serif, League's own UI font)
- Body: **Spiegel** (sans-serif)
- Both loaded as local font files via `next/font/local`.

**Color tokens** (Tailwind v4 `@theme`, so usable as `bg-lol-navy-900`, `text-lol-gold-300`, etc.)

| Group | Tokens |
|---|---|
| Backgrounds | `lol-black #010a13`, `lol-navy-950 #050e16`, `lol-navy-900 #091428`, `lol-navy-850`, `lol-navy-800`, `lol-navy-700`, `lol-surface #111820`, `lol-surface-hover`, `lol-surface-active` |
| Hextech Blue/Cyan (magic accent) | `lol-blue-50` → `lol-blue-900`, key ones: `300 #0ac8b9` (primary accent/cyan), `500 #0397ab` (primary), `400 #0ac4d9` (ring) |
| Hextech Gold (metal accent) | `lol-gold-50` → `lol-gold-900`, key ones: `50 #f0e6d2` (heading text), `300 #c8aa6e` (section labels), `400 #c89b3c` (secondary/accent numbers) |
| Text/neutrals | `lol-text #f0e6d2`, `lol-text-secondary #c8c2b6`, `lol-text-muted #a09b8c`, `lol-text-disabled`, `lol-border #3c3c41`, `lol-border-muted #1e282d`, `lol-divider` |
| Semantic | `lol-success #46c997`, `lol-heal #22c55e`, `lol-warning #e2b93b`, `lol-danger #e84057`, `lol-damage #d64545`, `lol-magic #6c5ce7`, `lol-mana #1e90ff` |
| Rarity | `lol-common` → `lol-mythic` (common/uncommon/rare/epic/legendary/mythic, muted-to-vivid) |
| Ranks | `lol-iron` → `lol-challenger` (full ranked-tier palette, not really used yet) |

**Shadows/gradients**: `shadow-hextech-blue`, `shadow-hextech-gold` (soft glow), `gradient-hextech-blue/gold/dark`.

**shadcn config**: style `radix-nova` (Base UI-based, not classic Radix), base color `neutral`,
CSS variables on. Primary=Hextech Blue, Secondary=Hextech Gold, Accent=bright cyan,
Destructive=danger red. Border radius is small (`0.25rem` base) — sharp, not rounded, matching
League's own angular UI.

**Overall feel**: single permanent dark theme (no light mode), navy/black backgrounds, gold
headings in the display serif font, cyan/gold accents, sharp corners, subtle glow shadows on
hover/emphasis states.

## Page structure so far

One page type exists today: a per-summoner stats page (`/summoner/[platform]/[riotId]`), built as
a vertical sequence of **full-viewport, scroll-snapped sections** (CSS scroll-snap — one scroll
gesture lands on the next section). Each section has a centered title in the display font/gold,
tracked letter-spacing, all-caps. In order, currently:

1. **Overview** — avatar, Riot ID, level, match count
2. **Time Played** — animated hours/minutes count-up
3. **Calendar** — GitHub-style activity heatmap, one cell per day, ~1 year trailing, ending today
4. **Positions** — vertical bar chart, placement counts (1st–6th)
5. **Team Slot** — stacked vertical bar chart, outcome by starting lobby slot
6. **Champions** — grid of every champion in the game, dimmed if unplayed, badge = games played
7. **KDA** — stat grid + scrollable horizontal bar chart (per-champion K/D/A/best), champion icons as axis labels
8. **Banned Champions** — scrollable ban-rate bar chart + a large scatterplot (ban rate vs. win rate when not banned)
9. **Top 3 Rate** — *placeholder, not built yet*
10. **Damage** / **Damage Taken** — stacked bar chart (physical/magical/true) + two donut charts (total, best game), click a champion to filter
11. **Kills** — stat grid (multi-kills, first bloods, etc.)
12. **Augments** — grid of all 225 augments, rarity-colored borders, dimmed if unpicked
13. **Prismatic Items** — grid of all 49 Arena Prismatic items, same treatment
14. **Economy** — stat grid + anvil-type donut chart
15. **Ability Casts** — stacked bar chart (Q/W/E/R) + two donut charts, same interaction as Damage
16. **Utility** — stat grid (healing, CC, saves)
17. **Fun Stats** — stat grid (fist bumps, pings, skillshots dodged)
18. **Pings** — horizontal bar chart, all 14 ping types

See the screenshots in this folder for what these actually look like today:
`01-overview.png`, `02-calendar.png`, `03-kda.png`, `04-damage.png`, `05-augments.png`.

## What's *not* built yet (fair game for new design ideas)

- "Top 3 Rate" section (currently an empty placeholder)
- Match history / individual match detail view
- Friend-group leaderboard (comparing tracked summoners against each other)
- Any navigation between tracked summoners (right now each summoner is a direct URL, no index page)
