// Data Dragon CDN version for static assets (profile icons, etc). Bump
// periodically — see https://ddragon.leagueoflegends.com/api/versions.json
const DDRAGON_VERSION = "16.17.1";

export function profileIconUrl(profileIconId: number): string {
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/profileicon/${profileIconId}.png`;
}

// match_participants.championName (Riot's Match-V5 field) matches Data
// Dragon's champion id for every champion except these — verified against
// all 172 distinct champions actually seen in our tracked data (checked
// 2026-09), not assumed. Add to this map if a future patch introduces
// another mismatch.
const CHAMPION_NAME_OVERRIDES: Record<string, string> = {
  FiddleSticks: "Fiddlesticks",
};

export function championIconUrl(championName: string): string {
  const id = CHAMPION_NAME_OVERRIDES[championName] ?? championName;
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${id}.png`;
}
