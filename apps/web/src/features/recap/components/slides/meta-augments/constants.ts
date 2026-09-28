/** The card's base size (flow layout, and before the deck measure). Deck
 * grows it by setting its width — never CSS `zoom`, which would also thicken
 * the frame art's border (see `AugmentFramedCard`). */
const CARD_WIDTH = 230;

const CARD_HEIGHT = (CARD_WIDTH * 256) / 155;

const CARD_GAP = 24;

/** Room kept around the row for the frame's outer glow (`TIER_STYLE` blur is
 * 20px). The row is `overflow-visible` in deck so the glow is never clipped. */
const GLOW_MARGIN = 24;

const DECK_QUERY = "(min-width: 1280px) and (min-height: 860px)";

export { CARD_WIDTH, CARD_HEIGHT, CARD_GAP, GLOW_MARGIN, DECK_QUERY };
