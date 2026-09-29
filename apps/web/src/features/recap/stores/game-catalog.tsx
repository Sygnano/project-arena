"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { GameCatalog } from "@arena/types";

/** Used when the catalog couldn't be loaded: ids then show as placeholders. */
const EMPTY_CATALOG: GameCatalog = { champions: {}, items: {}, augments: {} };

const GameCatalogContext = createContext<GameCatalog>(EMPTY_CATALOG);

/**
 * The game catalog (champion, item and augment names and icons) for every
 * summoner page, loaded once by the summoner layout. Recaps only carry ids;
 * `resolveStats` looks them up here.
 */
function GameCatalogProvider({ catalog, children }: { catalog: GameCatalog | null; children: ReactNode }) {
  return <GameCatalogContext.Provider value={catalog ?? EMPTY_CATALOG}>{children}</GameCatalogContext.Provider>;
}

function useGameCatalog(): GameCatalog {
  return useContext(GameCatalogContext);
}

export { GameCatalogProvider, useGameCatalog };
