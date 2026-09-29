/**
 * A right-aligned, sortable column header label: the label itself plus (when
 * this column is the active sort key) a small ▲/▼ showing direction.
 * `tracking-[.22em]` letter-spacing pads *after* every character including
 * the last, which visibly shifts a right-aligned string's glyphs left of the
 * box's true right edge — the `marginRight` cancels exactly that trailing
 * gap so the label's last glyph (or the indicator, when shown) actually
 * touches the column's right edge, aligned with the value below it. Shared
 * by Damage/DamageTaken and Ability's champion tables.
 */
function SortHeaderLabel({ label, active, dir }: { label: string; active: boolean; dir: "asc" | "desc" }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px]">
      <span className="tracking-[.22em]" style={{ marginRight: "-.22em" }}>
        {label}
      </span>
      {active && <span className="text-[7px] leading-none">{dir === "desc" ? "▼" : "▲"}</span>}
    </span>
  );
}

export { SortHeaderLabel };
