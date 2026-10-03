import { cn } from "cn";
import type { CSSProperties, ReactNode } from "react";
import { CARD_ASPECT_RATIO, CardFrame, RING_WIDTH } from "@/components/card-frame";
import { AugmentStatsRow } from "./components/augment-stats-row";
import { augmentFrameClassName } from "./constants";
import type { AugmentFramedCardStats } from "./types";
import { tierForAugmentCard } from "./utils";

/**
 * The framed card itself: icon + name + `AugmentStatsRow`, wrapped in the
 * decorative augment-offer card frame. The frame is a separate
 * absolutely-positioned layer behind the content so a `drop-shadow` glow cast
 * on it alone hugs the frame art's own chamfered silhouette, where casting it
 * on the whole card would also halo the icon/text sitting on top of it.
 *
 * Fills its container's height by default (`h-full`, deriving width from
 * `CARD_ASPECT_RATIO`) — pass `className` to override sizing for a consumer
 * that isn't inside a height-filling flex column.
 *
 * Grow the card by setting its width, never with CSS `zoom`/`scale`: those
 * also thicken the frame art's fixed 16px border and its glow, which is what
 * made these cards look far chunkier than the Collection's champion cards.
 * The content is a size container and everything inside is sized in `cqw`,
 * so it scales with the card while the frame keeps its native thickness.
 */
function AugmentFramedCard({
  augment,
  className,
  children,
}: {
  augment: AugmentFramedCardStats;
  className?: string;
  /** Extra content rendered above the icon, e.g. `GuestOfHonor`'s champion
   * portrait isn't part of this card — omit for a plain generic card. */
  children?: ReactNode;
}) {
  const tier = tierForAugmentCard(augment);

  return (
    <div
      className={cn("relative h-full shrink-0 @container", className)}
      style={{
        aspectRatio: CARD_ASPECT_RATIO,
        ...(tier ? undefined : { filter: "grayscale(1) brightness(.55) opacity(.75)" }),
      }}
    >
      <CardFrame tier={tier} filled />

      <div className="relative flex h-full flex-col items-center gap-[3cqw] px-[9cqw] pt-[19cqw] text-center">
        {children}
        <img
          loading="lazy"
          decoding="async"
          src={augment.iconUrl}
          alt={augment.augmentName}
          title={augment.augmentName}
          width={56}
          height={56}
          style={
            {
              "--augment-frame-fill": "var(--color-lol-navy-900)",
              "--augment-frame-width": tier ? RING_WIDTH[tier] : "1px",
              borderColor: tier ? undefined : "rgba(126,138,150,.3)",
            } as CSSProperties
          }
          className={cn("aspect-square w-[36cqw] rounded-full object-cover", augmentFrameClassName(tier))}
        />
        <div className="font-display mt-[2cqw] text-[9cqw] leading-tight tracking-[.04em] text-balance text-lol-gold-50">
          {augment.augmentName}
        </div>
        <AugmentStatsRow augment={augment} />
      </div>
    </div>
  );
}

export { RING_WIDTH } from "@/components/card-frame";
export { AugmentStatsRow } from "./components/augment-stats-row";
export { augmentFrameClassName } from "./constants";
export type { AugmentFramedCardStats } from "./types";
export { tierForAugmentCard } from "./utils";
export { AugmentFramedCard };
