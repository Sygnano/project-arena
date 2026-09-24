import type { ReactNode } from "react";

type Props = {
  label: string;
  value: string;
  /** Highlights the cell gold (e.g. Placement's TOP 1, Damage's BEST GAME)
   * instead of the default muted-label/gold-50-value pairing. */
  highlight?: boolean;
  /** Skip the left border — the strip's first cell only. */
  bordered?: boolean;
};

/**
 * One `label`/`value` cell of the horizontal stat strip that sits beside a
 * no-`sidebar` `CategorySection`'s header (Placement's GAMES/TOP 1/TOP 3/...,
 * Damage's TOTAL DEALT/TOTAL TAKEN/BEST GAME — see `CategorySection`'s
 * `headerRight` prop). First built inline for Placement, pulled out once
 * Damage needed the identical cell shape.
 */
function StatCell({ label, value, highlight = false, bordered = true }: Props) {
  return (
    <div className="px-6.5" style={bordered ? { borderLeft: "1px solid rgba(200,170,110,.16)" } : undefined}>
      <div
        className="text-[11px] tracking-[.22em] whitespace-nowrap"
        style={{ color: highlight ? "var(--color-lol-gold-300)" : "#a09b8c" }}
      >
        {label}
      </div>
      <div
        className="font-display mt-1.75 text-[30px]"
        style={{
          color: highlight ? "var(--color-lol-gold-300)" : "var(--color-lol-gold-50)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

/** The strip itself — cells bottom-aligned in a row (the first cell's
 * `bordered={false}` is the caller's job, same as `DetailBand`'s stats). */
function HeaderStatStrip({ children }: { children: ReactNode }) {
  return <div className="flex items-end">{children}</div>;
}

export { HeaderStatStrip, StatCell };
