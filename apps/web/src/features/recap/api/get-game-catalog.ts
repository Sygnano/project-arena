import "server-only";
import type { GameCatalog } from "@arena/types";
import { apiFetch } from "@/lib/api-client";

const CATALOG_TTL_MS = 60 * 60_000;
let catalogCache: { at: number; catalog: Promise<GameCatalog> } | null = null;

/**
 * Champion, item and augment names and icons (`GET /catalog`), which recaps
 * reference by id. Kept in this server's memory for an hour (it changes with
 * a patch), shared by every page; a failed fetch isn't kept.
 */
function getGameCatalog(): Promise<GameCatalog> {
  if (!catalogCache || Date.now() - catalogCache.at > CATALOG_TTL_MS) {
    const catalog = apiFetch("/catalog").then((res) => {
      if (!res.ok) throw new Error(`Failed to load the game catalog (${res.status})`);
      return res.json() as Promise<GameCatalog>;
    });
    catalogCache = { at: Date.now(), catalog };
    catalog.catch(() => {
      if (catalogCache?.catalog === catalog) catalogCache = null;
    });
  }
  return catalogCache.catalog;
}

export { getGameCatalog };
