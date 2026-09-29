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

/** The crest's name, or "Team N" for a slot without a known crest. */
function teamName(teamId: number): string {
  return TEAM_NAME[teamId] ?? `Team ${teamId}`;
}

/** The LoL client's own crest icon for a slot, or null without a known crest. */
function teamIconUrl(teamId: number): string | null {
  const slug = TEAM_ICON_SLUG[teamId];
  return slug
    ? `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/images/subteams/${slug}.svg`
    : null;
}

export { TEAM_NAME, teamName, teamIconUrl };
