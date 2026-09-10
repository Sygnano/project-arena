import type { PrismaticItemsStats } from "@arena/types";
import { CategorySection } from "@/components/category-section";

type Props = {
  prismaticItems: PrismaticItemsStats;
};

/**
 * Every Arena Prismatic Item (49 total — see CLAUDE.md §2 for how this
 * catalog was verified, since no field anywhere flags item rarity), laid
 * out as a grid the same way as `Augments`, dimmed when the summoner has
 * never held it at match end. Basic premise for now: just the catalog plus
 * a held-count badge; sorting/filtering by win rate can come later.
 */
const PrismaticItems = ({ prismaticItems }: Props) => {
  const sorted = [...prismaticItems.items].sort((a, b) =>
    a.itemName.localeCompare(b.itemName),
  );

  return (
    <CategorySection title="Prismatic Items">
      <div className="grid h-[70vh] w-full max-w-6xl grid-cols-[repeat(auto-fill,minmax(64px,1fr))] content-start gap-3 overflow-y-auto p-1">
        {sorted.map((item) => (
          <div
            key={item.itemId}
            title={item.itemName}
            className={`relative flex flex-col items-center gap-1 ${
              item.timesHeld === 0 ? "opacity-30 grayscale" : ""
            }`}
          >
            <img
              src={item.iconUrl}
              alt={item.itemName}
              width={48}
              height={48}
              className="size-12 rounded-md border-2 border-lol-mythic bg-lol-navy-900 object-cover"
            />
            {item.timesHeld > 0 && (
              <span className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full bg-lol-gold-400 text-[10px] font-semibold text-lol-navy-950 ring-2 ring-lol-navy-950">
                {item.timesHeld}
              </span>
            )}
          </div>
        ))}
      </div>
    </CategorySection>
  );
};

export { PrismaticItems };
