/**
 * CommunityDragon URLs. `latest` always serves the live patch, so nothing
 * here needs bumping after a patch. For a fixed patch, replace `latest` with
 * its number (`16.18`).
 * Docs: https://www.communitydragon.org/documentation/assets
 */
const BASE_URL = "https://raw.communitydragon.org/latest";

/** The League client's game-data plugin: champions, items, summoner spells. */
const GAME_DATA_URL = `${BASE_URL}/plugins/rcp-be-lol-game-data/global/default`;

export const CDRAGON_URLS = {
  champions: `${GAME_DATA_URL}/v1/champion-summary.json`,
  items: `${GAME_DATA_URL}/v1/items.json`,
  summonerSpells: `${GAME_DATA_URL}/v1/summoner-spells.json`,
  arena: `${BASE_URL}/cdragon/arena/en_us.json`,
};

/**
 * Icon URL for a game-data `iconPath`. The client addresses the plugin's
 * files as `/lol-game-data/assets/<path>`; CommunityDragon serves `<path>`
 * lowercased from the plugin's root:
 * `/lol-game-data/assets/ASSETS/Items/Icons2D/7106_DragonHeart.png` ->
 * `.../global/default/assets/items/icons2d/7106_dragonheart.png`.
 */
export function gameDataAssetUrl(iconPath: string) {
  const path = iconPath.replace(/^\/lol-game-data\/assets\//i, "");
  return `${GAME_DATA_URL}/${path.toLowerCase()}`;
}

/** Icon URL for a path into the game's own files (augment icons). */
export function gameAssetUrl(path: string) {
  return `${BASE_URL}/game/${path.toLowerCase()}`;
}
