/** The value's font-size at its largest — the design's original size, never
 * scaled up past this. */
const MAX_VALUE_FONT_SIZE = 72;

/** Floor so an unusually long formatted value never shrinks to illegible. */
const MIN_VALUE_FONT_SIZE = 30;

/** Comfortable horizontal room for the value inside the 286px ring's inner
 * circle, with a little padding left over on every side — deliberately well
 * short of the 246px inner-circle diameter itself: the value's own text
 * height eats into the circle's usable chord width away from dead-center,
 * and the ring's hairline border needs daylight around the glyphs, not a
 * tangent touch. */
const VALUE_MAX_WIDTH = 168;

/** The label's font-size at its largest — matches the original fixed
 * `text-sm`, never scaled up past this. */
const MAX_LABEL_FONT_SIZE = 14;

/** Floor so an unusually long label never shrinks to illegible. */
const MIN_LABEL_FONT_SIZE = 9;

/** Comfortable horizontal room for the label, same reasoning as
 * `VALUE_MAX_WIDTH` — a short label (e.g. "TOTAL DMG") never approaches this
 * and stays at `MAX_LABEL_FONT_SIZE`; a long one (e.g. "SAVES FROM DEATH")
 * shrinks to fit rather than overflowing the ring's own hairline border. */
const LABEL_MAX_WIDTH = 190;

export {
  LABEL_MAX_WIDTH,
  MAX_LABEL_FONT_SIZE,
  MAX_VALUE_FONT_SIZE,
  MIN_LABEL_FONT_SIZE,
  MIN_VALUE_FONT_SIZE,
  VALUE_MAX_WIDTH,
};
