import type { CSSProperties, ReactNode } from "react";
import { cn } from "cn";
import { tierForBestFinish, type Tier } from "@/lib/tier-bars";
import {
  CARD_ASPECT_RATIO,
  CardFrame,
  RING_WIDTH,
  frameRingClassName,
} from "@/components/card-frame";

/**
 * The "framed augment-offer card" look — Riot's own in-game augment-offer
 * card frame art wrapping an icon + name + PICKED/WINS/1ST breakdown, tiered
 * Silver/Gold/Prismatic by how well the summoner has done while holding the
 * augment. First built for `GuestOfHonor`'s champion-exclusive augment lines
 * (Vayne/Kindred/Yone's single-row sets), then pulled out here once
 * `MetaAugments` (Arena's augment-crafting picks) needed the identical
 * card — same shape as `tier-bars.ts`'s own extraction history: build it
 * bespoke once, lift it out once a second real consumer needs the same
 * `{frame, icon, name, stats}` unit rather than re-deriving it.
 */
export interface AugmentFramedCardStats {
  augmentId: number;
  augmentName: string;
  iconUrl: string;
  timesPicked: number;
  top1: number;
  top3ExclTop1: number;
}

/** Same "best finish while holding this augment" performance tier logic
 * every augment-card module on the page uses — these augments (Guest of
 * Honor lines, augment-crafting picks) have no Silver/Gold/Prismatic rarity
 * of their own (Community Dragon lists every one as `rarity: 4`), so the
 * card border is entirely about how well the summoner has done with it. */
export function tierForAugmentCard(
  augment: AugmentFramedCardStats,
): Tier | null {
  return augment.timesPicked === 0 ? null : tierForBestFinish(augment);
}

/** Alias kept for this module's existing callers — the ring styling itself
 * is shared with every other framed card now (see `card-frame.tsx`). */
export const augmentFrameClassName = frameRingClassName;

export { RING_WIDTH };

/** One `PICKED`/`WINS`/`1ST` figure — the count on its own line, larger
 * than the label beneath it, rather than a single inline "N PICKED" run.
 * Sized in `cqw` (see `AugmentFramedCard`). */
function AugmentStatBlock({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="font-display text-[max(15px,9cqw)] leading-none text-lol-gold-50 tabular-nums">
        {value}
      </div>
      <div className="font-body mt-[1.5cqw] text-[max(10px,4.4cqw)] tracking-[.12em] whitespace-nowrap text-lol-text-muted">
        {label}
      </div>
    </div>
  );
}

export function AugmentStatsRow({
  augment,
}: {
  augment: AugmentFramedCardStats;
}) {
  const wonCount = augment.top1 + augment.top3ExclTop1;
  const divider = "h-[15cqw] w-px bg-[rgba(200,170,110,.3)]";
  return (
    <div className="flex flex-1 items-end gap-[4.5cqw] pb-[22cqw]">
      <AugmentStatBlock value={augment.timesPicked} label="PICKED" />
      <div className={divider} />
      <AugmentStatBlock value={wonCount} label="WINS" />
      <div className={divider} />
      <AugmentStatBlock value={augment.top1} label="1ST" />
    </div>
  );
}

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
export function AugmentFramedCard({
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
        ...(tier
          ? undefined
          : { filter: "grayscale(1) brightness(.55) opacity(.75)" }),
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
          className={cn(
            "aspect-square w-[36cqw] rounded-full object-cover",
            augmentFrameClassName(tier),
          )}
        />
        <div className="font-display mt-[2cqw] text-[9cqw] leading-tight tracking-[.04em] text-balance text-lol-gold-50">
          {augment.augmentName}
        </div>
        <AugmentStatsRow augment={augment} />
      </div>
    </div>
  );
}
