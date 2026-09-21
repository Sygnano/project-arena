"use client";

import { createContext, useCallback, useContext, type ReactNode } from "react";

/**
 * Display names for champions. Everything the API sends as `championName` is
 * Riot's internal key ("MonkeyKing", "KSante") — right for Data Dragon asset
 * URLs, wrong to show a person. The stats response carries a lowercased
 * key -> display name map (`championDisplayNames`); this context makes it
 * available to every module without threading it through props.
 *
 * Unknown keys (a champion newer than the API's Data Dragon version, or a
 * value that's already a display name, like Guests of Honor's "Tahm Kench")
 * fall back to the input unchanged.
 */
const ChampionNamesContext = createContext<Record<string, string>>({});

function ChampionNamesProvider({
  names,
  children,
}: {
  names: Record<string, string>;
  children: ReactNode;
}) {
  return (
    <ChampionNamesContext.Provider value={names}>{children}</ChampionNamesContext.Provider>
  );
}

/** Returns a `(championKey) => displayName` lookup. */
function useChampionName(): (championKey: string) => string {
  const names = useContext(ChampionNamesContext);
  return useCallback(
    (championKey: string) => names[championKey.toLowerCase()] ?? championKey,
    [names],
  );
}

export { ChampionNamesProvider, useChampionName };
