/** Numeric form of `card-frame.tsx`'s `CARD_ASPECT_RATIO` (155 / 256). The
 * gallery sizes cards to fill the panel body's height from this. */
const CARD_ASPECT = 155 / 256;

/** Cross-fade between the gallery and a champion's dossier. Short and
 * opacity-led on purpose: the two views share the champion's card, so a
 * bigger positional transition would fight the impression that the card
 * simply stayed put while the stats arrived around it. */
const VIEW_TRANSITION = { duration: 0.24, ease: [0.4, 0, 0.2, 1] } as const;

export { CARD_ASPECT, VIEW_TRANSITION };
