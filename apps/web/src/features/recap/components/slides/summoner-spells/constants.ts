/** Each spell keeps the color of its in-game icon. Arena's own ids (2202
 * Flash, 2201 Flee) are the only two seen so far; anything else Riot ever
 * adds falls back to the palette below, in the order the API lists spells. */
const SPELL_COLORS: Record<number, string> = {
  2202: "#f5c542",
  2201: "#4fa3ff",
};

const FALLBACK_COLORS = ["#0ac8b9", "#d946ef", "#22c55e", "#ff8c34"];

const ROW_HEIGHT = 46;

const ROW_GAP = 3;

const SLOT_PITCH = ROW_HEIGHT + ROW_GAP;

const ICON_SIZE = 36;

const ROW_PADDING_X = 6;

const SPELL_COLUMN_WIDTH = 72;

export { FALLBACK_COLORS, ICON_SIZE, ROW_GAP, ROW_HEIGHT, ROW_PADDING_X, SLOT_PITCH, SPELL_COLORS, SPELL_COLUMN_WIDTH };
