# Arena Stats — Expert Re-Audit V2

> **Audit date:** 2026-09-18 (revised the same day after a product-framing correction) · **Scope:** the summoner page (`/summoner/[platform]/[riotId]`, all 29 slides plus the champion dossier), its shared components, the stats response, and data in Postgres the page could use but doesn't.
> **What the product is:** a **season wrap** in the spirit of Spotify Wrapped. The viewer *watches* their Arena season unfold, slide by slide; they don't filter, drill down or explore. **Totals come first on purpose** ("everything you did this season"); per-game views are secondary. A compact, at-a-glance analytics interface is a separate future project and is out of scope here.
> **Audience:** Arena experts. Nothing here asks for explanations of Arena mechanics.
> **Relationship to V1:** `ARENA_STATS_AUDIT.md` is history. Its tracker was re-checked rather than trusted.

## How this audit was done

- **Run in a real browser:** Chromium at 1920×1080 (deck), 1280×860 (short deck) and 390×844 (phone), console captured, hover cards and the dossier exercised, computed styles measured where something looked wrong.
- **Code read** for every module and the shared layer; `packages/types/src/stats.ts`, the schema and the parser.
- **Database queried** (read-only): patch mix, augment counts vs placement, rounds per placement, anvil events decompressed from 56 real timelines.
- **Checks:** web typecheck passes; lint 0 errors / 41 warnings; **API typecheck fails** (T-06). No console errors at any size.
- **Dataset:** 1 tracked summoner (Sygnano#EUW), 342 matches, 26 May – 17 Sep 2026, patches 16.10 → 16.18.

**Evidence tags:** **[Observed]** seen in the browser, code or database · **[Likely]** needs one confirming check · **[Opportunity]** design/product improvement · **[Feature]** new capability.

---

## Executive Summary

The wrap already *looks* like a premium recap. The Hextech language is consistent, big numbers count up, sections animate in, the V1 trust fixes held, and the champion dossier is a genuinely rich collectible. The totals-first choice is right for a season wrap: "you dealt 16.0M damage" is a Wrapped sentence; "45.8K per game" isn't.

What keeps it from feeling like an exceptional wrap is not missing data or missing controls. It is **storytelling**:

1. **Slides show numbers, but rarely say what they mean.** Wrapped's power is the *punchline*: "You were in the top 1% of listeners." Here, most slides present a chart and leave the viewer to find the moment. 5,605 total bans, 92.9K casts and 342 games are all shown; none is turned into a sentence.
2. **Many slides are dashboards in disguise.** Twelve-row sortable tables, two tab groups, sort headers and a low-sample switch ask the viewer to *operate* the slide. In a wrap, a slide should land its point before anyone touches anything.
3. **The rhythm is flat.** 13 slides share the same composition (title, quote, dial, rows, big panel), three share the same stacked-column chart, and three the same honeycomb. The same champion (Xin Zhao) is "revealed" on Picks, KDA, Damage Dealt, Damage Taken and Team Synergy, so the biggest reveal of the season happens five times, and never as a proper moment.
4. **It isn't built for how wraps are consumed: on phones, and shared.** On a phone the page is a 40,521 px scroll (≈48 screens) with tables that scroll sideways. There is no share card for any slide and no season summary card at the end.
5. **A P0 bug** hides the title and header on **10 of 29 slides** in the designed layout, including Arena God's progress counts (C2-01). For a slide-by-slide story, an untitled slide is a broken beat.

The data needed for a much better story already exists: every lobby opponent's stats (percentiles vs the players you met), ~3,600 round duels involving this player (a champion "nemesis" and "prey"), augments in pick order, purchase order, 9 patches, dated games. The next 10–20% is **turning those into told moments**, not tools.

---

## What Improved Since V1

| Area | What changed | Verdict for a wrap |
|---|---|---|
| Trust | Real display names; no fake season; correct best games; Bans denominator | Holds. A wrap that gets a number wrong gets screenshotted wrong. |
| Structure | Slide registry, chapter rail, `#hash` deep links, cues that can't drift | Holds, and makes the pacing changes below a one-file edit. |
| Motion | Page-wide `Reveal`, count-ups, chart entrances replayed on tab change, reduced-motion support | Right foundation for a wrap. One trigger bug (C2-01). |
| Honest rates | `pooledRate` for augments/items; `MIN_SAMPLE`; low-sample dimming | Holds except Special Items (T-03). Honesty matters more in a shareable wrap. |
| Dossier | Dense per-champion card with form, combat, builds, augments | The best "collectible" on the page. |
| Performance | Cache + parallel queries; pre-blurred lazy art | Page loads in ~1.2 s locally, 0 console errors. |
| Rounds | `parseRounds()` → `match_rounds`, rounds shown on Teammates/Nemesis | Excellent derivation, barely used for storytelling (see Missing Moments). |

---

## What Still Doesn't Work

### V1 tracker entries that don't match the code

| V1 entry | Reality | Action |
|---|---|---|
| H-06 "PER GAME is the default on KDA, Damage, Ability, Utility" `[x]` | Every one (and the dossier) opens on **TOTAL**. **This is intended** (totals-first season wrap). | **Correct the V1 tracker/docs,** not the code. |
| Special Items show "FEW GAMES" under the sample minimum `[x]` | `SpecialItems.tsx:114` never passes `sample`; the 2-game Golden Spatula shows cyan "+48% VS AVG". | Fix (T-03). |
| Rate deltas use "%", never "pp" | Bans prints "−25 PP / +25 PP" and "IN PERCENTAGE POINTS" (`BannedChampions.tsx:271-273, 489`); Teammates/TeamSynergy tooltips say "percentage points". | Fix (T-05). |
| Arena God denominators `[~]` | The PLAYED / WON WITH / 1ST PLACE strip exists but is invisible (C2-01). | Fix C2-01. |
| D-07 chord dominated by "Other" (open) | Still true: "Other (148)" takes about half the circle. | See Slide 25. |

### Structural issues, judged as a wrap

- **No punchlines.** The italic quote slot is the one place a slide speaks to the viewer, and it holds a fixed champion voice line rather than a line about *this* season. The data-driven line V1 proposed (Polish #1) never shipped. For a wrap this is the single biggest gap.
- **Interaction as a prerequisite.** Several slides only reach their interesting state after a click: Bans' best-winrate view, Nemesis' "ahead of you" sort, Team Synergy's teammate picks, per-game twists. In a wrap, the default state must *be* the story; tabs are extras.
- **Repeated reveals.** Totals-first makes the most-played champion win every volume chart. That is fine, if the wrap **embraces it once** as the big "champion of your season" moment and gives every other slide a different angle.
- **Dashboard freshness signals on a recap.** Welcome shows "Recent form, newest first" and "Last game 29h ago", both dashboard ideas from V1. A season recap is about the season, not the last session.
- **No defined season.** The page says "Tracked since 26 May 2026". A wrap needs a named period ("Your Arena Season 2026 · May–September") and an ending.
- **Charter drift.** CLAUDE.md §1 still describes the product as "op.gg/u.gg, but scoped to Arena". That contradicts the wrap framing and will keep pulling future work toward dashboards (it pulled the first draft of this audit there). It should be updated.

---

## Critical Issues

### C2-01 · Titles and header strips are invisible on 10 of 29 slides (P0, [Observed])

**Affected:** every slide without a sidebar: Team Slot, Kills, Collection, Arena God, Augment God, Guests of Honor, Augment Crafting, Prismatic God, Special Items, Pings.

**Measured:** at 1920×1080, 3 s after arriving, each `<h2>` sits at y = 88–140 px with effective opacity **0**. Same at 1280×860.

**Root cause:** `useSectionInView` (`hooks/use-section-in-view.ts`) reports "in view" only inside the middle 60% of the scroll container (`rootMargin: "-20% 0px -20% 0px"`). Sidebar slides wrap title + sidebar in one tall `Reveal` that crosses the middle, so they work. On full-width slides the header has its own `Reveal` in the excluded top 20% (0–216 px), so it never becomes visible.

**Impact on the story:** a third of the beats arrive untitled. The three hall-of-fame slides lose their only payoff ("x / 171 champions won with"). On phones the same rule **likely** fades short blocks out while they are still on screen near the top.

**Fix:** reveal the full-width header with its section (one trigger for the whole slide), or observe the section element with a threshold. Keep the entrance animation.

### C2-02 · Stat-anvil "gold spent" exceeds what the player earned (P1, [Observed])

The Anvils sidebar shows "779K · 15% OF GOLD" = 1,038 stat anvils × the 750g list price (`summoners.ts:2275`). Real games contradict that:

| Match | Stat anvil purchase events | At 750g | Gold earned that game |
|---|---|---|---|
| EUW1_7951829031 (1st) | 72 | 54,000 | 48,458 |
| EUW1_7912171553 (1st) | 52 | 39,000 | 26,550 |
| EUW1_7928309869 (3rd) | 51 | 38,250 | 26,061 |
| EUW1_7960980726 (1st) | 50 | 37,500 | 32,490 |

The parser counts exactly what Riot sends (0 undos across 56 checked matches), so **some stat anvils must be granted free or discounted** [Likely: augments that grant anvils]. "Gold spent", "% of gold", "stat anvils **bought**" and "most in one game: 72" are overstated. In a wrap, "72" is exactly the number someone screenshots. Derive cost from gold deltas, or show counts labelled "obtained" and drop the gold figure.

---

## Slide-by-Slide Review

Each slide: **what the moment should be**, what works, what breaks it. Totals stay the default everywhere.

### Slide 1 · Welcome — Rework as the title card
- **Works:** identity ring, name, region, the four headline numbers, beautiful art.
- **Breaks the wrap:**
  - It spends the season's biggest numbers (games, avg place, winrate, 1st rate) in the first second, so nothing is left to reveal.
  - "Recent form · newest first" and "Last game 29h ago" are dashboard signals.
- **The moment:** "Your Arena Season 2026" title card with the period and one teaser total (e.g. hours played). Move the four headline numbers into a finale summary card (Slide 29).

### Slide 2 · Placement — Keep, add the punchline
- **Works:** big average, six finish bars, a hover with each place's average game.
- **Breaks:**
  - [Observed] At 1280×860 only 4 of 6 bars fit; 5th and 6th scroll sideways inside the panel (T-13).
  - The slide never says what the shape means: the distribution is **almost flat** (56/66/57/59/55/49). The punchline: "2nd was your most common finish — 66 times", or against chance: "You beat the lobby average (3.5) — 3.40".
- **Optional depth, told not explored:** "When you made top 3, you won 7–10 of your ~12 rounds; in 6th, you won 1.4." This comes from `match_rounds` (rounds won per game by placement: 9.6 / 7.3 / 5.6 / 4.3 / 3.3 / 1.4).

### Slide 3 · Time — Keep, fix colour and time zone, add the arc
- **Works:** 121.6 hours as the hero number (the "minutes listened" of this wrap), calendar, hour strip, streaks.
- **Breaks:**
  - [Observed] Days are coloured by games played using the **rarity tiers** (silver 1–2, gold 3–4, prismatic 5+). A busy day reads as a "prismatic" achievement even if it went badly.
  - [Observed] Bucketing is UTC ("UTC" in the caption). For EUW every hour is shifted 1–2 h, and late-night sessions split across two days. Wrap lines like "your 2 a.m. game" or "favourite day: Thursday" can be wrong.
- **Missing moments (data already in the payload):** the **season arc**: best month, the hot streak week, the first 1st place of the season, the longest single day (12 games). All come from `calendar.days` and the dated form games.

### Slide 4 · Team Slot — Keep as a fun beat, only with a punchline
- A playful slide suits a wrap ("Your lucky crest: Sentinel").
- [Observed] Distribution 8 / 32 / 42 / 69 / 94 / 97 (uniform would be 57 each). That skew is a **data anomaly** (T-15): either slot assignment isn't random or the user-supplied crest mapping is off. Check before crowning a "lucky crest".
- [Observed] Title invisible (C2-01).

### Slide 5 · KDA — Keep totals, change the angle
- **Works:** 2.61 dial; totals (2,649 kills) are good Wrapped numbers; the detail band is rich.
- **Breaks:** in TOTAL the chart is the Picks chart again (Xin Zhao 577 kills in 69 games). It's the second time the season's top champion "wins".
- **The moment:** lead with the season total as the headline ("2,649 kills"), and let the chart's story be the **twist** that totals can't show: "Your deadliest pick, game for game: <champion>." (compute the per-game leader among champions with enough games) Per game stays a tab; the sentence carries the twist without the viewer switching modes.
- Mobile: columns collapse to ~10 px bars (T-14). Horizontal bars would fit.

### Slide 6 · Kills (Multikills) — Keep, it's a good wrap slide
- Big diamonds with 363 / 76 / 2 / 1 are exactly the Wrapped register.
- **Add the story:** the penta is the rarest moment of the season. Name it (champion, date, placement) instead of just "1". "Flawless aces 153" deserves the same treatment.
- [Observed] Title invisible (C2-01).

### Slide 7 · Picks — Turn into "Champion of the Season"
- The first champion slide is where the big reveal belongs: **"Your champion of the season: Xin Zhao, 69 games, 24h played."** Make it a full-bleed splash moment (the Collection card art already exists), with a **Top 5** beneath it, Wrapped's canonical format.
- The 20-column stacked chart works as a detail, but it isn't a moment. The sidebar already shows the winner; the chart repeats it.

### Slide 8 · Collection + Dossier — Keep, fix the entrance
- The dossier is the page's best collectible. The coverflow is a good "flip through your roster" wrap gesture.
- [Observed] The coverflow opens with its first card centred, leaving the left half of the panel empty.
- [Observed] Title invisible (C2-01).

### Slide 9 · Arena God — Keep, restore the payoff
- The honeycomb is a satisfying collection wall.
- [Observed] Its payoff (PLAYED / WON WITH / 1ST PLACE WITH) is invisible (C2-01). With it restored, add one line: "**N champions to go** for Arena God", which gives the season an open ending.

### Slide 10 · Bans — Keep, tighten to one story
- 5,605 bans is a fun total; "Pyke was banned in 100% of your games" is a perfect wrap line, currently shown as a table row with "—".
- Default view is a 12-row table with a ±25 "PP" rail (T-05): analytic, not a moment.
- **The moment:** "The lobby's most feared: Pyke (100%)", and then the personal one: "**When Zyra was open, you won 71%**", the best-winrate view that's currently behind a tab.

### Slides 11–12 · Damage Dealt / Taken — Keep totals, pair them as a duo of moments
- 16.0M dealt and 18.3M taken are great totals: "You took more than you gave."
- Two identical slides back to back flatten the rhythm. Either merge into one "dealt vs taken" moment, or give each a different visual.
- [Observed] Each has two tab groups with **"TOTAL" selected twice** ("◆ TOTAL … | ◆ TOTAL"), confusing at a glance (T-11).

### Slide 13 · Augments — Keep, reveal "Augment of the Season"
- "Mystic Punch, 42 picks" is the reveal. The sidebar has it; give it the splash treatment and a Top 5.
- The pooled baseline ("+12% vs avg pick") is an honest twist; keep it as a secondary line.
- **Missing moment:** augments are stored **in pick order**. "Your go-to first augment" is a signature-move stat that no other slide can tell.

### Slide 14 · Augment God — Keep
- [Observed] Header and count invisible (C2-01). Rim colours (achievement) and icon art (rarity) use the same three hues, so the collection progress is hard to read.

### Slides 15–16 · Guests of Honor / Augment Crafting — Keep, add the line
- Both suit a wrap (niche mechanics experts care about). Crafting's five poster cards are fine as a beat, but they need a sentence: "You took an extra augment slot 61 times — and won 40."
- [Observed] Both titles invisible (C2-01).

### Slides 17–18 · Prismatic Items / Prismatic God — Keep, reveal "Prismatic of the Season"
- Same structure as augments: splash the winner (Dragonheart, 50 held), Top 5, then the collection wall.

### Slide 19 · Anvils — Rework
- [Observed] Titled ANVILS, but its main panel is **the Shardblade**; the Legendary/Prismatic anvil split sits in the **Vault** sidebar (T-12).
- [Observed] Gold spent is wrong (C2-02).
- **The moment:** "1,038 anvils opened" (once the count is labelled correctly), with the tier split as its visual. The Shardblade can join Special Items.

### Slide 20 · Special Items — Keep, fix honesty
- Three reliquary cards are a lovely rare-drop moment.
- [Observed] No sample rule (T-03): "100% · +48% VS AVG" on 2 games reads as a boast the data can't back.
- [Observed] Title invisible (C2-01).

### Slide 21 · Vault — Keep the rail pattern, lead with the total
- 5.06M gold earned is the Wrapped number. The table is excellent for readers who want it.
- **The moment:** "Your most-built Legendary: Heartsteel, 74 games". The table becomes the supporting detail.
- Deltas "−10.0%" here vs "+12%" elsewhere (DS-2).

### Slide 22 · Boots — Keep, trim
- [Observed] The donut repeats the list beside it.
- [Observed] "BAREFOOT FINISHES 165" (sidebar) and "FINISHED BAREFOOT 143 GAMES" (outcome card) on one screen read as a contradiction (T-10); 165 includes the 22 never-bought games.
- **The line:** "You sold your boots 168 times."

### Slide 23 · Ability Casts — Keep (my first draft wrongly cut it)
- "You pressed Q 42,800 times" is a quintessential wrap stat. The total is the point.
- Add the line and the champion: "Most of them on Hecarim."

### Slide 24 · Utility — Keep, fix legibility
- 229 saves as the dial is a good heroic number ("You saved a teammate 229 times").
- [Observed] Rows are icon-only; no names. In a watch-only slide, the viewer shouldn't have to hover to learn who.

### Slide 25 · Team Synergy — Replace the chord with a duo reveal
- [Observed] The chord is half "Other (148)" and illegible on phones. It's the most "tool-like" visual on the page and tells no story.
- **The moment:** "Your best duo: Xin Zhao + Swain" as a paired splash card (portraits, games, winrate). The chord can move behind a tab or go.

### Slides 26–27 · Teammates / Nemesis — Keep the idea, pick the story
- [Observed] 616 unique teammates and 4,293 opponents, **0 tracked friends**; the top rows are strangers with 2–14 games.
- The wrap lines exist: "You met 616 teammates and 4,293 opponents this season." "Your most-met rival: Plaster Glutton (14 games; duels 14–15, theirs)."
- **Better nemesis moment** (unique to this data): the **champion** that beat you most often in round duels, and the one you beat most ("Your nemesis: Yuumi · Your prey: …"). Duel data (`match_rounds`) supports ~60 duels per enemy champion on average and more for popular ones, far sturdier than any single username.
- Mobile: Nemesis names sit off-screen right of the numbers (T-14).

### Slide 28 · Pings — Keep (my first draft wrongly cut it)
- Pings are pure wrap personality. The panel is ~90% empty, though, and the punchline is missing: "133 'Assist me' pings. 1 'Retreat'. Never backing down."
- [Observed] Title invisible (C2-01).

### Slide 29 · Farewell — Extend into the season summary card
- The close is warm. What it lacks is Wrapped's ending: **a single summary card** (champion, augment, prismatic, hours, games, avg place, best duo, nemesis) designed to be screenshotted or downloaded.

---

## Expert-Level Insights & Missing Analytics

In a wrap, analysis appears as **told moments**: superlatives, comparisons and firsts. Everything below is presented to the viewer, not operated by them. **Payload** = computable from the current response; **API** = new query on existing tables.

| ID | The moment | What it answers for an expert | Source |
|---|---|---|---|
| W-1 | **"More damage than <x>% of the players you met"** (lobby percentiles for damage, kills, healing, gold) | Totals only mean something against a reference. The best reference is the ~5,800 other players already stored in `match_participants`. | API |
| W-2 | **Lobby MVP count:** "Top damage in your lobby <n> times" | A superlative experts care about, derivable per match | API |
| W-3 | **Champion nemesis & prey** from round duels | Which enemy champion you lost the most fights to, and which you farmed | API (`match_rounds`) |
| W-4 | **Duels won this season** (total), longest duel win streak, comebacks (won after losing the first 3 rounds) | Round-level stories no other Arena recap can tell | API |
| W-5 | **Season arc:** best month, hottest week, first win, first 1st place, the penta date | Wrapped's "your year in moments" | Payload (`calendar.days`, dated form games) |
| W-6 | **Signature first augment** (most common slot-1 pick) and **signature rush** (most common first Legendary) | Pick order and build order, the expert's "habits" | API (`augments` order, `purchased_item_ids` order) |
| W-7 | **Patch journey:** "9 patches; your best was 16.13" | Experts track patches; one line gives context without a filter | API (`matches.patch`) |
| W-8 | **Against chance:** "3.40 vs the lobby's 3.5; top 3 in 52% vs 50%" | Calibrates the headline numbers for an expert audience | Payload |
| W-9 | **Personality archetype** from ratios (damage share, healing, CC, deaths, pings), e.g. "The Duelist" | Wrapped's identity moment; must be derived transparently from real ratios | Payload + API |
| W-10 | **Twists per slide** (the per-game leader when it differs from the total leader) | Keeps totals-first while avoiding five identical reveals | Payload |

Deliberately **not** recommended for this page: filters, funnel plots, matchup tables to browse, per-round defaults, an explorer mode. They belong to the separate analytics project.

---

## Missing Data Relationships

Relationships the data already contains, phrased as a line the wrap could say.

| Data | Wrap line |
|---|---|
| Your stats × every lobby opponent's stats | "More kills than <x>% of the players you faced." (example shape) |
| `match_rounds` × enemy champions | "Yuumi beat you in 61% of your duels. You had Zed's number: 70%." (example shape) |
| Placement × rounds won | "In your 56 wins you won 9.6 rounds a game; in last place, 1.4." |
| Augment pick order × frequency | "Your opening move: Mystic Punch." (example shape) |
| Purchase order × Legendary | "You rushed Heartsteel first 30 times." (example shape) |
| Calendar × placement | "August was your best month." (example shape) |
| Patch × placement | "16.13 was your patch." (example shape) |
| Champion total vs per-game leader | "Most kills: Xin Zhao. Deadliest per game: <champion>." (example shape) |

*(Example-shape lines use real entity names but unmeasured figures; compute before shipping.)*

---

## Data Visualization Opportunities

- **Splash reveals** for the season's four "of the Season" winners (champion, augment, prismatic, legendary), using the existing card-frame art at full scale, followed by a **Top 5**. This is the canonical Wrapped visual, and the assets already exist.
- **Placement against a flat "chance" line**, so the near-uniform distribution tells its own story.
- **Calendar coloured by result, not volume:** average placement per day on a diverging scale, games per day as cell size or opacity. "Good days vs busy days" is a better season heat map than "busy days" in rarity colours.
- **Duo splash card** replacing the chord diagram.
- **Nemesis/prey champion pair**: two portraits facing off with duel records, an Arena-native visual.
- **Season arc strip:** a thin timeline of the season (months, patches, the penta, the best streak) that could open the Overview chapter or close the finale.
- **Remove or demote:** the Boots donut (duplicates its list); the chord diagram; duplicate tab labels.
- **Keep:** the Vault rate rail (the clearest rate visual on the page); linear scales from zero; count-ups.

---

## UX Improvements

- **The default state is the story.** Every slide should land its point without a click. Tabs, sort headers and the low-sample switch stay as extras for curious viewers, not prerequisites. Where a tab hides the best line (Bans' best winrate, per-game twists), bring the line into the default state as text.
- **One punchline per slide.** A generated sentence in (or beside) the quote slot, computed from the season: the Wrapped caption. Keep the champion voice line as the epigraph.
- **Pace the reveals.** Stage each slide: headline number → punchline → supporting chart. The count-up already exists; sequencing doesn't.
- **Share.** A "share this slide" image per slide and the summary card at the end. For a friend-group wrap, sharing is the main distribution.
- **Keep the chapter rail and deep links:** they let someone send "look at my #kills".

---

## UI / Visual Design

- **Vary the rhythm.** Wrapped alternates full-bleed type cards, splash reveals, lists and playful oddities. Here 13 slides share one layout. Introduce three or four slide archetypes:
  - **big number** (Kills already is one);
  - **splash reveal** (champion/augment/prismatic of the season);
  - **top 5 list**;
  - **collection wall** (the honeycombs).
  Assign them so no two neighbours match.
- **Dials:** big totals are right for a wrap. The spinning arc, though, implies a proportion that doesn't exist. Either give it meaning (e.g. share of the season) or keep it static. Each dial needs a context line ("16 per game", "that's 5 full days").
- **Empty panels** (Pings, Crafting, Placement at 1920 wide) are fine as breathing room *if* a punchline fills the focal point. Today the empty space has nothing at its centre.
- **Glow budget.** Every bar carries a tier gradient plus glow; on 20-bar charts it becomes haze. Save glow for the reveal of each slide.
- **Distinctiveness:** crests, round duels and augment pick order are Arena-native motifs that would make this unmistakably an *Arena* wrap, not a generic League one.

---

## Design System

**DS-1 · One palette, seven meanings ([Observed], P1).** Silver/gold/prismatic currently encode:
1. finishing place (1st / 2nd–3rd / rest);
2. rank in a list (first bar prismatic on KDA and Picks);
3. ban-rate thresholds (>90 / >50);
4. games per day (calendar);
5. best finish (hall-of-fame rims);
6. augment rarity (the art itself);
7. arbitrary category colours (Boots donut).

In a wrap, "prismatic" should mean *the best*, once per slide, and always for the same reason. Recommendation: tiers = placement outcome (and rarity only on rarity art); rank and volume use a neutral gold ramp; categories use a separate set. V1 left this as H-02 awaiting sign-off.

**DS-2 · Delta formatting:** "+12%", "−10.0%", "+14.3%", "+23%" across slides. One rule: whole percents with a real minus sign, "%" never "PP".

**DS-3 · Mode + metric tabs:** two equal-weight tab groups can show the same label twice (Damage: TOTAL | TOTAL). Make the mode a quieter segmented control on the same toolbar row.

**DS-4 · One header component** for sidebar and full-width slides. The split is how C2-01 happened.

**DS-5 · Slide archetypes** (see UI) as first-class components, so pacing is designed rather than accidental.

---

## Motion & Interaction

- **Motion is the storytelling layer here, and it's under-used.** Today each slide fades up as one block (title column, then panel 120 ms later). A wrap wants a **sequence**: headline counts up → punchline types or fades in → chart builds. The pieces exist (`Reveal`, `useCountUp`, chart entrances); they need choreography per archetype.
- **Fix the trigger** (C2-01); keep replay-on-re-entry, which suits a deck you scroll back through.
- **Reveal moments deserve a flourish:** the "of the Season" splashes, the penta, Arena God progress. Keep ambient spinning/breathing elsewhere subtle so these stand out.
- **Keep:** chart entrance replay on tab switch, FLIP re-sorts, reduced-motion handling.

---

## Responsive Design

Wraps are watched on phones and shared from phones. That makes phone the most important viewport after the designed desktop deck.

| Viewport | Status | Findings |
|---|---|---|
| Ultrawide | Fine | Capped at 1920×1080 and centred. |
| 1920×1080 | Designed target | Only C2-01. |
| 1280×860 | Regression | [Observed] Placement shows 4 of 6 bars; the rest scroll sideways inside the panel (T-13). |
| Phone 390×844 | Scroll document, not a story | [Observed] 40,521 px (≈48 screens); snap scrolling off; KDA columns ~10 px; Nemesis/Bans key columns off-screen; the chord's labels overlap. |

**Recommendation: a phone story mode.** One slide per screen with snap scrolling on phones too, and each slide rendering a **story-card variant**: headline number, punchline, top 3–5, one visual. Tables and secondary tabs are omitted (the desktop deck keeps them). This fits the rule that slides fit by scaling or simplifying, never by inner scrolling.

---

## Accessibility

- [Observed] C2-01 removes visible headings from 10 slides (screen readers still get them).
- [Observed] Icon-only rows (Utility, augment and item axes, Pings) require hover. In a watch-only format, names should be visible.
- [Likely] Low-sample dimming at `opacity-45` drops text contrast below 4.5:1.
- Punchline sentences (recommended above) double as good accessible summaries of each chart. Give each chart an `aria-describedby` pointing at its line.
- Confirm the spinning dial arcs stop under `prefers-reduced-motion`.

---

## Technical / QA

| ID | Type | Finding | Priority |
|---|---|---|---|
| T-01 | Observed bug | Full-width slide headers never reveal (C2-01) | P0 |
| T-02 | Observed data | Stat-anvil gold spent / "bought" overstated (C2-02) | P1 |
| T-03 | Observed bug | Special Items ignores the sample rule (`SpecialItems.tsx:114`) | P1 |
| T-04 | Observed docs | V1 tracker H-06 says per game is the default; totals-first is intended. Correct the tracker. | P3 |
| T-05 | Observed | "PP" / "percentage points" in Bans, Teammates, TeamSynergy | P2 |
| T-06 | Observed | API typecheck fails: `scripts/_prof.ts` imports missing `../src/routes/_prof.js` | P2 |
| T-07 | Observed | 41 lint warnings (mostly `no-img-element`) | P3 |
| T-08 | Observed docs | CLAUDE.md §2 says only 4 of 6 augment slots are populated; 204 of 342 games hold 5–6 | P3 |
| T-09 | Observed | Day/hour bucketing in UTC; EUW shifted 1–2 h, late sessions split | P2 |
| T-10 | Observed | Boots: 165 vs 143 "barefoot" on one screen without explanation | P3 |
| T-11 | Observed | Damage slides select "TOTAL" in both tab groups | P3 |
| T-12 | Observed | Anvils slide's centrepiece is the Shardblade; the anvil split lives in Vault | P2 |
| T-13 | Observed | Placement scrolls sideways inside its panel at 1280×860 | P1 |
| T-14 | Observed | Phone: KDA columns ~10 px; Nemesis/Bans key columns off-screen | P1 (with the story mode) |
| T-15 | Observed anomaly | Team slot counts 8/32/42/69/94/97 (uniform = 57); verify slot assignment or crest mapping | P2 |
| T-16 | Observed | Nemesis "WINRATE" and "AHEAD" columns near-duplicate | P3 |
| T-17 | Observed | Placement hover's "most often Nth" champion uses n = 5 | P3 |

---

## Product-Level Opportunities

1. **Define the season.** A name, start and end, and an "it's ready" moment. Everything in a wrap is framed by its period.
2. **Punchline engine.** A small, deterministic library of wrap lines per slide (superlatives, twists, comparisons against chance and the lobby), each with a guard (sample size, ties) so it never says something false.
3. **The four "of the Season" reveals** (champion, augment, prismatic, legendary) as the emotional spine of the story.
4. **Lobby percentiles and MVP counts** (W-1, W-2), the Wrapped "top X% of listeners" equivalent, from data already stored.
5. **Round-duel moments** (W-3, W-4): nemesis/prey champions and duels won. Unique to this project.
6. **Phone story mode + share cards + season summary card.** How a wrap actually travels.
7. **Friend-group layer (later):** "you vs your friends" slides need more tracked summoners (currently 1). Worth planning the season around it.
8. **Charter update:** rewrite CLAUDE.md §1 around the season-wrap purpose, with the analytics tool noted as a separate project.

### Proposed story order (same slides, re-paced)

Pacing matters more than slide count here. A suggested arc, mostly reusing existing slides:

| Act | Slides |
|---|---|
| **Opening** | Title card (Welcome) → Time (hours, season arc) → Placement (with chance line) |
| **Your champions** | Champion of the Season (Picks) → Collection → Arena God → Bans |
| **Your fights** | KDA → Kills → Damage dealt/taken → Nemesis & prey (new round moment) → Utility → Ability Casts |
| **Your builds** | Augment of the Season → Augment God → Guests of Honor → Crafting → Prismatic of the Season → Prismatic God → Vault → Anvils → Special Items → Boots |
| **Your people** | Best Duo (Team Synergy) → Teammates → Rivals (Nemesis) → Team Slot (lucky crest) |
| **Finale** | Pings → Summary card + Farewell |

---

## Things We Should NOT Change

- **Totals first.** It is the right default for a season wrap; per game stays a secondary view.
- **The Hextech visual language** and the big-number typography.
- **Fun trivia slides** (Pings, fist bumps, Ability Casts, Team Slot, Special Items): personality is a wrap feature.
- **The slide registry and chapter rail.**
- **Count-ups, section entrances and replay-on-return** (fix the trigger only).
- **The dossier's density** and its no-dimming rule.
- **`lib/sample.ts` and pooled baselines.** Honesty matters more when a number gets shared.
- **The Vault rate rail.**
- **Storing Riot's truth and documenting its quirks.**
- **`parseRounds()`**, which will power the most distinctive moments.

---

## Prioritized Backlog

### P0
- **C2-01** Full-width slide headers invisible.

### P1
- **C2-02** Anvil gold / "bought" overstated.
- **T-03** Special Items sample rule.
- **T-13** Placement fits at 1280×860.
- **Punchlines:** one generated line per slide, with guards.
- **"Of the Season" reveals** for champion, augment, prismatic and legendary (splash + Top 5).
- **Phone story mode** (snap, story-card variants) — covers T-14.
- **Season definition** (name, period) and a Welcome title card that doesn't spend the headline numbers.
- **Season summary card** at the finale.
- **DS-1** colour meanings (decision first).

### P2
- **W-1 / W-2** lobby percentiles and MVP counts.
- **W-3 / W-4** nemesis/prey champions and duel totals.
- **W-5** season arc strip and firsts.
- **W-6 / W-7** signature first augment / first rush; patch journey.
- Duo splash card replacing the chord.
- Per-slide share images.
- Reveal choreography per slide archetype.
- T-05, T-06, T-09, T-12, T-15.

### P3
- **W-9** personality archetype (only once the lines above prove trustworthy).
- DS-2 deltas · DS-3 tabs · DS-4 one header · DS-5 archetype components.
- Boots donut and barefoot wording (T-10); double TOTAL (T-11); Nemesis columns (T-16); placement hover n (T-17).
- Coverflow initial alignment; glow budget; dial arc meaning.
- T-04 and T-08 docs corrections; T-07 lint warnings.
- CLAUDE.md §1 charter update.

---

## Top 10 Most Valuable Improvements

### 1. Fix the invisible headers (C2-01)
1. **Problem:** 10 of 29 slides show no title or header in the designed layout; the hall-of-fame payoffs are hidden.
2. **Why it matters:** in a slide-by-slide story, an untitled slide is a broken beat.
3. **Change:** trigger the header with its section instead of the middle-60% band.
4. **Gain:** a third of the wrap works as designed again.
5. **Complexity:** Low.

### 2. A punchline on every slide
1. **Problem:** slides show numbers but rarely say what they mean.
2. **Why it matters:** experts can read a chart, but a wrap is remembered and shared by its lines ("You pressed Q 42,800 times").
3. **Change:** a guarded, generated sentence per slide (superlative, twist or comparison), next to the champion voice line.
4. **Gain:** every slide becomes a moment instead of a panel.
5. **Complexity:** Medium (a line library plus guards; mostly payload data).

### 3. The four "of the Season" reveals
1. **Problem:** the top champion is revealed five times, never as a moment; augment/prismatic/legendary winners sit in sidebars.
2. **Why it matters:** these are the wrap's emotional spine (Wrapped's "top artist").
3. **Change:** splash reveals with card art, then a Top 5; later slides lead with a different angle.
4. **Gain:** a memorable arc and far less repetition.
5. **Complexity:** Medium (new archetype component; data exists).

### 4. Phone story mode
1. **Problem:** on phones the wrap is a 40,521 px scroll with sideways tables and collapsed charts.
2. **Why it matters:** wraps are watched and shared on phones.
3. **Change:** snap one slide per screen; each slide supplies a story-card variant (number, line, top 3–5, one visual).
4. **Gain:** the wrap works where it will actually be viewed.
5. **Complexity:** Medium–High (a variant per slide).

### 5. Season summary card and share images
1. **Problem:** no ending card and nothing to share.
2. **Why it matters:** for a friend-group wrap, sharing is the point.
3. **Change:** a finale card (champion, augment, prismatic, hours, games, avg place, duo, nemesis) plus per-slide images.
4. **Gain:** the wrap travels.
5. **Complexity:** Medium.

### 6. Define the season and re-open with a title card
1. **Problem:** "Tracked since 26 May" plus dashboard freshness signals on the first screen; the biggest numbers are spent immediately.
2. **Why it matters:** a wrap is framed by its period, and its opening builds anticipation.
3. **Change:** named season and dates; a Welcome title card with one teaser; headline numbers move to the finale.
4. **Gain:** a real beginning and ending.
5. **Complexity:** Low–Medium (plus a product decision on boundaries).

### 7. Lobby percentiles and MVP counts (W-1, W-2)
1. **Problem:** totals have no reference point.
2. **Why it matters:** "more damage than <x>% of players you met" makes a total meaningful to an expert without any interaction.
3. **Change:** percentile and lobby-top counts from stored lobby participants.
4. **Gain:** Wrapped's "top X%" moment, grounded in real data.
5. **Complexity:** Medium (API queries).

### 8. Round-duel moments: nemesis, prey, duels won (W-3, W-4)
1. **Problem:** ~3,600 derived duels feed only two username tables.
2. **Why it matters:** "the champion that beat you most" is the most Arena-specific story available, and nobody else can tell it.
3. **Change:** nemesis/prey champion face-off card; season duels-won total; best duel streak.
4. **Gain:** a distinctive, Arena-only beat.
5. **Complexity:** Medium.

### 9. Fix the numbers people will screenshot (C2-02, T-03, T-05, T-13)
1. **Problem:** impossible anvil gold, a 2-game "+48%", "PP" labels, bars cut off on laptops.
2. **Why it matters:** a shared wrap with a wrong number undermines the whole thing.
3. **Change:** derive or drop anvil gold; apply the sample rule; "%" everywhere; fit Placement.
4. **Gain:** trustworthy, shareable slides.
5. **Complexity:** Low.

### 10. Vary the rhythm and give colour one meaning (UI, DS-1, DS-5)
1. **Problem:** 13 identical layouts; the tier palette means seven things.
2. **Why it matters:** a wrap's energy comes from contrast between beats; "prismatic" should always mean *the best*.
3. **Change:** 3–4 slide archetypes alternated through the story; tiers reserved for outcome/rarity.
4. **Gain:** a paced, premium feel, and colours that read instantly.
5. **Complexity:** Medium (decision first, then components).

---

## Questions Requiring Product Decisions

1. **What is a season?** Riot's split dates, calendar year, or custom dates? Does a new season reset the page, with past seasons archived?
2. **Opening screen:** move the headline numbers (games, avg place, winrate, 1st rate) from Welcome to the finale summary card?
3. **Punchline tone:** playful (Wrapped), stoic (League voice lines), or mixed, keeping the current quotes as epigraphs?
4. **Colour (DS-1):** do silver/gold/prismatic mean placement outcome (recommended), or rank/prestige?
5. **Sharing:** per-slide share images, a single summary card, or both? Downloaded images or share links?
6. **Phone:** is a simplified story-card variant per slide acceptable, with tables desktop-only?
7. **Team Slot anomaly:** verify `playerSubteamId` assignment before crowning a "lucky crest"?
8. **Anvils:** show a derived gold cost, or counts labelled "obtained" without gold?
9. **Friends:** track more of the friend group before the season ends, so "you vs friends" slides are possible?
10. **Charter:** rewrite CLAUDE.md §1 around the season-wrap purpose, with the at-a-glance analytics tool as a separate project?
