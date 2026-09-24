import type { CSSProperties } from "react";
import { cn } from "cn";
import { TIER_STYLE, type Tier } from "@/lib/tier-bars";

/**
 * Riot's own in-game augment-offer card frame art (the chamfered card
 * border/fill a player sees on the actual draft screen), as a standalone
 * decorative layer. Pulled out of `augment-framed-card.tsx` once the champion
 * gallery's cards (`modules/ChampionGallery`) needed the identical frame
 * around completely different content — the frame is the app's generic
 * "collectible card" chrome at this point, not an augment-specific thing.
 *
 * Hosted locally (`apps/web/public/images/augmentcard_frame_*.png`) rather
 * than hotlinked from Community Dragon: these copies are pre-cropped tight to
 * the card's own bounding box (310x512, transparent center) instead of
 * sitting inside a larger square canvas, so their pixel geometry can be
 * measured exactly instead of guessed (see `CARD_FRAME_SLICE`).
 */
const CARD_FRAME_URL: Record<Tier, string> = {
  prismatic: "/images/augmentcard_frame_prismatic.png",
  gold: "/images/augmentcard_frame_gold.png",
  silver: "/images/augmentcard_frame_silver.png",
};

/** The source frame is a 310x512 PNG, fully transparent from ~20px in on
 * every edge inward (measured directly off the pixel alpha channel, not
 * eyeballed) — `20 fill` slices exactly that opaque band off each edge as the
 * 9-slice border and keeps the (transparent) center instead of discarding it,
 * so the card's own dark fill shows through cleanly instead of a hard cutout.
 * `stretch` (not `round`) keeps each edge's single decorative notch centered
 * on that edge rather than risking a second partial repeat on a card taller
 * than the source's own proportions. */
const CARD_FRAME_SLICE = "20 fill";
const CARD_FRAME_WIDTH = "16px";

/** The framed card's width/height ratio, regardless of how tall its
 * container ends up — these cards fill available height and derive their
 * width from this ratio via CSS `aspect-ratio`, rather than a fixed width
 * whose height would otherwise stretch/squash with the content around it.
 * Matches the frame art's own exact pixel dimensions (310x512, measured off
 * the source PNG) rather than an assumed trading-card ratio. */
export const CARD_ASPECT_RATIO = "155 / 256";

/** How far the frame art's opaque border band reaches inward. Anything that
 * should sit *inside* the frame rather than under it — a card's fill, or its
 * artwork — is inset by this much, so the frame's chamfered corners lie over
 * that layer's edge instead of leaving it poking out square at the corners. */
export const CARD_INNER_INSET = "12px";

/** The card's own dark fill. The frame art's centre is fully transparent (see
 * `CARD_FRAME_SLICE`), which is invisible on a dark section background but
 * leaves the card see-through anywhere it sits over artwork — e.g. Guest of
 * Honor's accordion panels, whose background is champion splash art.
 *
 * Deliberately the same frosted navy gradient as `HextechPanel`'s own fill,
 * just carried to a higher opacity: the panel only ever sits over a blurred
 * section photo, while a card can sit over full-brightness art, and at the
 * panel's own 0.62/0.72 stops the art still reads straight through the card.
 * Kept translucent rather than solid so it stays glass in the same visual
 * language as every other surface here. */
export const CARD_FILL_BACKGROUND = "linear-gradient(155deg, rgba(9,20,40,.86), rgba(3,10,18,.93))";

/** Ring thickness scales 1.5px -> 3px as tier climbs, per
 * design_handoff_arena_hof/README.md's "Layout" section (a tier-less
 * grey/never-played ring is a plain 1px hairline, set by each caller). */
export const RING_WIDTH: Record<Tier, string> = {
  silver: "1.5px",
  gold: "2.25px",
  prismatic: "3px",
};

/** Silver stays the non-animated `-static` variant — calmer with several
 * rings/frames on screen at once than a shimmer on every commonly-picked
 * one. */
export function frameRingClassName(tier: Tier | null): string {
  if (tier === "prismatic") return "augment-frame augment-frame-prismatic";
  if (tier === "gold") return "augment-frame augment-frame-gold";
  if (tier === "silver") return "augment-frame augment-frame-silver-static";
  return "border grayscale opacity-30 brightness-[.7]";
}

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
export function CardFrame({
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
