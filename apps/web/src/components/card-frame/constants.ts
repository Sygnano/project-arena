import type { Tier } from "@/utils/tier-bars";

/**
 * Riot's own in-game augment-offer card frame art (the chamfered card
 * border/fill a player sees on the actual draft screen), as a standalone
 * decorative layer. Pulled out of `augment-framed-card.tsx` once the champion
 * gallery's cards (`features/recap/components/slides/champion-gallery`) needed the identical frame
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
const CARD_ASPECT_RATIO = "155 / 256";

/** How far the frame art's opaque border band reaches inward. Anything that
 * should sit *inside* the frame rather than under it — a card's fill, or its
 * artwork — is inset by this much, so the frame's chamfered corners lie over
 * that layer's edge instead of leaving it poking out square at the corners. */
const CARD_INNER_INSET = "12px";

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
const CARD_FILL_BACKGROUND = "linear-gradient(155deg, rgba(9,20,40,.86), rgba(3,10,18,.93))";

/** Ring thickness scales 1.5px -> 3px as tier climbs, per
 * design_handoff_arena_hof/README.md's "Layout" section (a tier-less
 * grey/never-played ring is a plain 1px hairline, set by each caller). */
const RING_WIDTH: Record<Tier, string> = {
  silver: "1.5px",
  gold: "2.25px",
  prismatic: "3px",
};

export {
  CARD_FRAME_URL,
  CARD_FRAME_SLICE,
  CARD_FRAME_WIDTH,
  CARD_ASPECT_RATIO,
  CARD_INNER_INSET,
  CARD_FILL_BACKGROUND,
  RING_WIDTH,
};
