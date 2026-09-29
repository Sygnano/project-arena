"use client";

import type { ReactNode } from "react";

/** One `LABEL .......... value` line inside a `StatGroup`. The value is a
 * node rather than a string so callers can hand it an `AnimatedNumber` (the
 * common case) or a composite like a K/D/A triple. */
function StatLine({
  label,
  value,
  valueColor,
  note,
}: {
  label: string;
  value: ReactNode;
  valueColor?: string;
  /** Small muted text just before the value (e.g. the K/D/A behind a KDA). */
  note?: string;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="flex-1 truncate text-[11px] tracking-[.14em] text-lol-text-muted">{label}</span>
      {note ? <span className="text-[11px] text-lol-text-muted tabular-nums">{note}</span> : null}
      <span
        className="font-display text-[16px] leading-[1.45] tabular-nums"
        style={{ color: valueColor ?? "var(--color-lol-gold-50)" }}
      >
        {value}
      </span>
    </div>
  );
}

export { StatLine };
