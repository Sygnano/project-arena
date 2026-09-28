/** The API's path for one summoner, by Riot ID. */
function summonerApiPath(region: string, gameName: string, tagLine: string) {
  return `/summoners/by-riot-id/${encodeURIComponent(region)}/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
}

export { summonerApiPath };
