"use client";

import type { ReactNode } from "react";

function HoverCardRows({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return rows.map((row) => (
    <div key={row.label} className="flex justify-between gap-3 py-0.5">
      <span className="tracking-[.12em] text-lol-text-muted">{row.label}</span>
      <span className="font-display text-lol-gold-50">{row.value}</span>
    </div>
  ));
}

export { HoverCardRows };
