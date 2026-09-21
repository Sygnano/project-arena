import { memo } from "react";
import type { ChampionPickBreakdown } from "@arena/types";
import { cn } from "cn";
import {
  CARD_ASPECT_RATIO,
  CARD_INNER_INSET,
  CardFrame,
} from "@/components/card-frame";
import { championLoadingUrl } from "@/lib/riot";
import { tierForBestFinish, type Tier } from "@/lib/tier-bars";
import { useChampionName } from "@/lib/champion-names";

/**
 * The same "best finish on this champion" tier ladder every framed card on
 * the page uses (see `augment-framed-card.tsx`'s `tierForAugmentCard`), so
 * a Prismatic frame means the identical thing here as it does on an augment
 * card: a 1st place. `null` is never returned for a gallery card — the
 * gallery only shows champions the summoner has actually picked — but the
 * signature keeps the never-picked case explicit for callers that reuse it.
 */
export function tierForChampionCard(
  champion: ChampionPickBreakdown,
): Tier | null {
  return champion.timesPicked === 0 ? null : tierForBestFinish(champion);
}

/**
 * One champion in the gallery: the champion's portrait art filling the card,
 * their name across the bottom, and the shared Hextech card frame tiered by
 * their best finish. Hovering (or focusing the card via the keyboard) pops
 * the name forward — the tier frame already carries the record, so the card
 * stays a portrait rather than a stat block.
 *
 * Intentionally does NOT own its own scale/rotation/opacity — those are the
 * gallery's depth envelope, written imperatively onto the wrapper around this
 * card every frame (see `components/coverflow-gallery.tsx`). Adding a
 * competing transform here would be overwritten 60 times a second.
 *
 * Memoized because the gallery reports every change of centered card up to
 * the module as state, which re-renders the whole list several times a second
 * while scrolling. `champion` objects come from a memoized, sorted roster and
 * so keep their identity across those renders, letting all 60 cards bail out.
 */
function ChampionCardImpl({
  champion,
  interactive = true,
}: {
  champion: ChampionPickBreakdown;
  /** False for a card that is being displayed rather than offered — the
   * dossier's own copy of the card, which is already the thing you clicked
   * through to and so shouldn't advertise itself as clickable. */
  interactive?: boolean;
}) {
  const tier = tierForChampionCard(champion);
  const displayName = useChampionName();

  return (
    <div
      className={cn(
        "group relative w-full select-none",
        interactive && "cursor-pointer",
      )}
      style={{ aspectRatio: CARD_ASPECT_RATIO }}
    >
      <div
        className="absolute overflow-hidden bg-lol-navy-950"
        style={{ inset: CARD_INNER_INSET }}
      >
        <img
          src={championLoadingUrl(champion.championName)}
          alt=""
          loading="lazy"
          // The art is authored with the champion's face near the top of the
          // frame, so a plain center crop cuts their head off — anchor the
          // cover crop to the top edge instead.
          className={cn(
            "h-full w-full object-cover object-top transition-transform duration-500 ease-out",
            interactive && "group-hover:scale-105",
          )}
        />

        {/* Two scrims rather than one: a soft full-height wash that keeps the
          frame's gold reading against bright splash art, and a much harder
          bottom fade the name and hover record sit on. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(3,10,18,.15) 0%, rgba(3,10,18,0) 35%, rgba(3,10,18,.55) 68%, rgba(3,10,18,.94) 100%)",
          }}
        />
      </div>

      <CardFrame tier={tier} />

      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center px-4 pb-5">
        <div
          className={cn(
            "font-display w-full truncate text-center text-[19px] tracking-[.08em] text-lol-gold-50",
            // The pop itself is CSS on the gallery's card wrapper rather than
            // React state — hovering must not re-render a list of 60+ cards
            // mid-scroll (see `globals.css`, `.champion-card-name`).
            interactive && "champion-card-name",
          )}
        >
          {displayName(champion.championName)}
        </div>
      </div>
    </div>
  );
}

export const ChampionCard = memo(ChampionCardImpl);
