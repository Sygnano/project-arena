/* ------------------------------------------------------------------ *
 * The fan
 * ------------------------------------------------------------------ */

/** How many cards are drawn on each side of the centered one. Past this the
 * card is `visibility: hidden` rather than merely transparent — the fan
 * compresses outward cards almost on top of each other (see `fanOffset`), so
 * without a hard cutoff a 60-champion roster would pile 50 near-invisible
 * cards into the same few pixels and composite into a smear. */
const CARDS_PER_SIDE = 5;

/** Distance from the centered card to its first neighbour, as a fraction of
 * the card's width. Each further card is placed `FAN_COMPRESS` times as far
 * from the previous one as the last step was, so the first neighbours spread
 * out clearly and the outer ones bunch into a stacked deck at each end. */
const FAN_STEP_RATIO = 0.95;

const FAN_COMPRESS = 0.6;

const CENTER_SCALE = 1.06;

/** Multiplied per card out from the center, so size falls off geometrically
 * alongside the position. */
const SCALE_DECAY = 0.92;

/** Kept deliberately shallow. A steeper tilt plus heavy z-depth made the row
 * read as the inside of a drum/cylinder rather than a deck laid out on a
 * table — the goal is a mostly flat fan with just enough turn to show depth. */
const MAX_ROTATE_Y_DEG = 30;

const ROTATE_FALLOFF_CARDS = 2;

const DEPTH_PER_CARD_PX = -22;

const MAX_DEPTH_PX = -110;

const PERSPECTIVE_PX = 2400;

/** Opacity holds near 1 for the first couple of cards and then falls away
 * sharply, reaching 0 exactly at the `CARDS_PER_SIDE` cutoff so a card never
 * blinks out while still visible. */
const OPACITY_CURVE = 2.2;

/** Dimming/desaturation saturates faster than opacity — by ~3 cards out
 * everything is equally "background", which keeps the centered card the only
 * fully colored thing without over-darkening its immediate neighbours. */
const DIM_FALLOFF_CARDS = 3;

const FAR_BRIGHTNESS = 0.55;

const FAR_SATURATION = 0.4;

/** Share of the container's height the centered (scaled-up) card fills. The
 * rest is headroom for the frame's glow, which is allowed to spill past the
 * container anyway (nothing here clips). */
const HEIGHT_FILL = 0.94;

/** Widest a card may get relative to the container's width, so the whole
 * fan (~2.3 fan steps each side) still roughly fits a wide-but-short panel. */
const MAX_WIDTH_SHARE = 1 / 4.4;

/* ------------------------------------------------------------------ *
 * The motion
 * ------------------------------------------------------------------ */

/** Time constants (ms) of the exponential glide toward the target position.
 * The flick one doubles as the projection horizon when picking where a
 * released drag lands: an exponential approach over `tau` to a target
 * `v * tau` away starts at exactly velocity `v`, so the release hands the
 * gesture's own speed over to the glide instead of snapping. */
const FLICK_TAU_MS = 380;

const WHEEL_TAU_MS = 260;

const KEY_TAU_MS = 200;

/** Position counts as arrived within this many cards of target. */
const ARRIVE_EPSILON = 0.0015;

/** Quiet time after the last wheel tick before the target is rounded onto a
 * whole card. The glide is already underway toward the raw target, so this
 * only nudges where it ends, in the direction of travel. */
const SETTLE_DELAY_MS = 160;

/** How far rounding leans in the direction of travel, in cards — a gesture
 * that got a quarter of the way to the next card carries on to it rather than
 * sliding back. */
const DIRECTIONAL_BIAS = 0.3;

/** Only pointer samples this recent count toward release velocity, and a
 * pointer held still this long before release counts as stopped. */
const VELOCITY_WINDOW_MS = 90;

/** Pointer travel past which a press counts as a drag rather than a click, so
 * a swipe across a card doesn't also open it. */
const DRAG_THRESHOLD_PX = 6;

/** Below this release speed (cards/ms) a drag just settles to the nearest
 * card instead of carrying in its direction. */
const MIN_FLICK_VELOCITY = 0.0006;

const WHEEL_SPEED = 1.1;

/** Wheel deltas arrive in different units per device/browser
 * (`WheelEvent.deltaMode`): 0 = pixels (trackpads, most mice), 1 = lines,
 * 2 = pages. Firefox reports lines for a real mouse wheel. */
const LINE_HEIGHT_PX = 16;

const PAGE_HEIGHT_PX = 400;

export {
  CARDS_PER_SIDE,
  FAN_STEP_RATIO,
  FAN_COMPRESS,
  CENTER_SCALE,
  SCALE_DECAY,
  MAX_ROTATE_Y_DEG,
  ROTATE_FALLOFF_CARDS,
  DEPTH_PER_CARD_PX,
  MAX_DEPTH_PX,
  PERSPECTIVE_PX,
  OPACITY_CURVE,
  DIM_FALLOFF_CARDS,
  FAR_BRIGHTNESS,
  FAR_SATURATION,
  HEIGHT_FILL,
  MAX_WIDTH_SHARE,
  FLICK_TAU_MS,
  WHEEL_TAU_MS,
  KEY_TAU_MS,
  ARRIVE_EPSILON,
  SETTLE_DELAY_MS,
  DIRECTIONAL_BIAS,
  VELOCITY_WINDOW_MS,
  DRAG_THRESHOLD_PX,
  MIN_FLICK_VELOCITY,
  WHEEL_SPEED,
  LINE_HEIGHT_PX,
  PAGE_HEIGHT_PX,
};
