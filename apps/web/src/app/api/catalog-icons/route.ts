import { getGameCatalog } from "@/lib/api";
import { championIconUrl } from "@/lib/riot";

/**
 * Every icon a recap can show (champions, augments, recap items), as URLs,
 * for `AssetPrefetch` to warm the browser cache with. Built from the same
 * game catalog the recap resolves its ids against, so it follows patches.
 */
export async function GET() {
  const catalog = await getGameCatalog().catch(() => null);
  if (!catalog) return Response.json([], { status: 503 });
  const urls = [
    ...Object.values(catalog.champions).map((champion) => championIconUrl(champion.key)),
    ...Object.values(catalog.augments).map((augment) => augment.iconUrl),
    ...Object.values(catalog.items).map((item) => item.iconUrl),
  ];
  return Response.json([...new Set(urls)], { headers: { "Cache-Control": "public, max-age=3600" } });
}
