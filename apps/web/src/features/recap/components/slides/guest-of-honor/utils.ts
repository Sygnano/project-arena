/** `championIconUrl`/`championSplashUrl` expect Data Dragon's no-space
 * PascalCase champion id (e.g. "TahmKench"), not the space-separated display
 * name this screen otherwise shows — every other Guest of Honor champion
 * (Vayne, Kindred, Yone) is a single word already, so only Tahm Kench
 * actually needs this. */
function iconName(championName: string): string {
  return championName.replace(/\s+/g, "");
}

export { iconName };
