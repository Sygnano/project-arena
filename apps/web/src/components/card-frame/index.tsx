import { cn } from "cn";
import type { CSSProperties } from "react";
import { TIER_STYLE, type Tier } from "@/utils/tier-bars";
import {
  CARD_FILL_BACKGROUND,
  CARD_FRAME_SLICE,
  CARD_FRAME_URL,
  CARD_FRAME_WIDTH,
  CARD_INNER_INSET,
} from "./constants";

/**
 * The card frame as its own absolutely-positioned layer, meant to sit on top
 * of (or behind) a card's content rather than wrap it. Kept separate
 * specifically so a `drop-shadow` glow cast on it alone hugs the frame art's
 * own chamfered silhouette — casting the same glow on the whole card would
 * also halo the icon/text sitting inside it.
 *
 * A `null` tier means "no performance tier yet"; it still draws the Silver
 * frame art so the card keeps its shape, just without the glow (callers
 * typically desaturate the whole card in that case).
 */
function CardFrame({
  tier,
  filled = false,
  className,
}: {
  tier: Tier | null;
  /** Draw the card's dark fill behind the frame (see
   * `CARD_FILL_BACKGROUND`). Leave it off for a card that supplies its own
   * inner layer, such as one filled with artwork. */
  filled?: boolean;
  className?: string;
}) {
  const style: CSSProperties = {
    borderStyle: "solid",
    borderWidth: CARD_FRAME_WIDTH,
    borderImageSource: `url(${CARD_FRAME_URL[tier ?? "silver"]})`,
    borderImageSlice: CARD_FRAME_SLICE,
    borderImageWidth: CARD_FRAME_WIDTH,
    borderImageRepeat: "stretch",
    filter: tier ? `drop-shadow(${TIER_STYLE[tier].glow})` : undefined,
  };

  return (
    <>
      {/* Rendered before the border so it paints underneath it — the frame
        art's decorative edge should overlap the fill, not the other way
        round. */}
      {filled ? (
        <div
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            inset: CARD_INNER_INSET,
            background: CARD_FILL_BACKGROUND,
            backdropFilter: "blur(6px)",
          }}
        />
      ) : null}
      <div aria-hidden className={cn("pointer-events-none absolute inset-0", className)} style={style} />
    </>
  );
}

export { CARD_ASPECT_RATIO, CARD_FILL_BACKGROUND, CARD_INNER_INSET, RING_WIDTH } from "./constants";
export { frameRingClassName } from "./utils";
export { CardFrame };
