/**
 * "value | pct%" row for a sortable stat table's total column — right-
 * aligning free text puts the "|" at a different x position per row
 * whenever the value/percent digit counts differ, so this lays out as grid
 * columns with a minimum width instead. The minimum (in em, so it follows the
 * font size) keeps the "|" on one vertical line across rows; a value wider
 * than it grows its column rather than running into the "|" (a fixed 60px
 * column clipped "155.9K"). First built for Damage/DamageTaken's champion
 * table, then shared with Ability's and Banned Champions' sidebars. Only
 * meaningful when the caller's numbers actually sum to a real total (e.g.
 * TOTAL mode, not an independently-maxed BEST GAME) — see each caller's own
 * mode handling for why.
 */
function ValuePercentRow({
  value,
  pct,
  valueMinWidth = "3.3em",
}: {
  value: string;
  pct: number;
  /** Narrower for short values (e.g. plain counts), wider never needed —
   * the column grows past it on its own. */
  valueMinWidth?: string;
}) {
  return (
    <div
      className="grid items-baseline gap-x-[.3em] font-display text-[22px] text-lol-gold-50"
      style={{
        gridTemplateColumns: `minmax(${valueMinWidth}, max-content) auto minmax(3.2em, max-content)`,
      }}
    >
      <span className="text-left whitespace-nowrap tabular-nums">{value}</span>
      <span className="text-center text-lol-text-muted">|</span>
      <span className="text-right whitespace-nowrap tabular-nums">{pct.toFixed(1)}%</span>
    </div>
  );
}

export { ValuePercentRow };
