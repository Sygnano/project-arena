import type { CSSProperties } from "react";
import type {
  ChampionCatalogStats,
  ChampionPickBreakdown,
  ChampionPicksStats,
} from "@arena/types";
import { CategorySection } from "@/components/category-section";
import { championIconUrl } from "@/lib/riot";

type Props = {
  championCatalog: ChampionCatalogStats;
  championPicks: ChampionPicksStats;
};

// Same `.augment-frame-*` gradient borders as Augments/PrismaticItems, but
// keyed off this champion's best-ever placement rather than a rarity tier:
// a single top1 earns the animated Prismatic border, a top3 (no top1) earns
// the animated Gold border, and anything else played earns the static
// Silver border (`-static`: no sheen sweep — with up to ~171 icons on
// screen at once, an animated highlight on every one reads as busy rather
// than "glowy", the same reasoning documented on `.augment-frame-silver-static`
// in globals.css). A champion never played gets a plain muted border.
function tierFrameClass(pick: ChampionPickBreakdown | undefined): string {
  if (!pick) return "border-2 border-lol-border-muted bg-lol-navy-900";
  if (pick.top1 > 0) return "augment-frame augment-frame-prismatic";
  if (pick.top3ExclTop1 > 0) return "augment-frame augment-frame-gold";
  return "augment-frame augment-frame-silver-static";
}

/**
 * Every champion in the game (currently ~171), laid out as a grid the same
 * way as `Augments`/`PrismaticItems`, dimmed when the summoner has never
 * played it.
 */
const Champions = ({ championCatalog, championPicks }: Props) => {
  const pickByChampionId = new Map(
    championPicks.champions.map((pick) => [pick.championId, pick]),
  );

  return (
    <CategorySection title="Champions">
      <div className="mx-auto grid h-full w-full grid-cols-[repeat(auto-fill,minmax(64px,1fr))] content-start gap-3 overflow-y-auto p-1">
        {championCatalog.champions.map((champion) => {
          const pick = pickByChampionId.get(champion.championId);
          return (
            <div
              key={champion.championId}
              title={champion.championName}
              className={`relative flex flex-col items-center gap-1 ${
                champion.timesPlayed === 0 ? "opacity-30 grayscale" : ""
              }`}
            >
              <img
                src={championIconUrl(champion.championName)}
                alt={champion.championName}
                width={60}
                height={60}
                style={
                  {
                    "--augment-frame-fill": "var(--color-lol-navy-900)",
                  } as CSSProperties
                }
                className={`size-12 rounded-full object-cover ${tierFrameClass(pick)}`}
              />
            </div>
          );
        })}
      </div>
    </CategorySection>
  );
};

export { Champions };
