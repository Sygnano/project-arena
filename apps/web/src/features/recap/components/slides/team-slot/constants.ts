import { TIER_STYLE } from "@/utils/tier-bars";

// Arena's 8 lobby "teams" each have a jungle-camp crest (Poro, Wolf, Minion,
// Krug, Raptor, Scuttle, Sentinel, Gromp — see the match history client's own
// `subteams/*.svg` assets, linked below). Riot's Match-V5 API never sends
// this identity (only the bare numeric `playerSubteamId`), so it can't be
// verified against our own ingested data the way everything else in this
// codebase is — this mapping is taken on the user's own in-game knowledge,
// confirmed 1-6 only (the current 6-team format, see CLAUDE.md §2 on team
// size). 7/8 (Wolf/Gromp) are left out rather than guessed at an unconfirmed
// order, since teamId can't currently exceed 6 anyway.
const TEAM_ICON_SLUG: Record<number, string> = {
  1: "poro",
  2: "minion",
  3: "scuttle",
  4: "krug",
  5: "raptor",
  6: "sentinel",
};

const TEAM_NAME: Record<number, string> = {
  1: "Poro",
  2: "Minion",
  3: "Scuttle",
  4: "Krug",
  5: "Raptor",
  6: "Sentinel",
};

// Percent of the chart's bar track the tallest column fills, leaving room
// for its total label above. Percent (not px) so the chart follows the
// panel's real height instead of overflowing it on shorter screens.
const BAR_MAX_PERCENT = 78;

/**
 * Same three rarity tiers `HextechBarChart`'s KDA columns use for their top
 * 3 ranks, applied here by FIXED meaning instead of rank: every team's 1st
 * segment is Prismatic, 2nd-3rd is Gold, and the rest is Silver, regardless
 * of which team has the most of each. Both read `TIER_STYLE`
 * (`utils/tier-bars.ts`), so their colors can't drift apart.
 */
const SEGMENT_TIER = {
  top1: TIER_STYLE.prismatic,
  top3: TIER_STYLE.gold,
  remaining: TIER_STYLE.silver,
};

export { TEAM_ICON_SLUG, TEAM_NAME, BAR_MAX_PERCENT, SEGMENT_TIER };
