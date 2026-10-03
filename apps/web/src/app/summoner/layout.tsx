import { getGameCatalog } from "@/features/recap/api/get-game-catalog";
import { GameCatalogProvider } from "@/features/recap/stores/game-catalog";
import { TopBar } from "./_components/top-bar";

/**
 * Every summoner page (queue screen, recap, not found) shares the top bar,
 * and the game catalog that recaps' item, augment and champion ids resolve
 * against. The layout stays mounted across summoner pages, so the catalog is
 * sent to the browser once per visit, not with every recap.
 */
export default async function SummonerLayout({ children }: LayoutProps<"/summoner">) {
  // Without it the page still works: ids show as placeholders.
  const catalog = await getGameCatalog().catch((err) => {
    console.error("[catalog] could not load the game catalog:", err);
    return null;
  });
  return (
    <GameCatalogProvider catalog={catalog}>
      <TopBar />
      {children}
    </GameCatalogProvider>
  );
}
