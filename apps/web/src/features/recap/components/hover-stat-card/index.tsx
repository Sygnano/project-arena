"use client";

import type { ReactNode } from "react";

/**
 * The Hextech hover card behind the page's chart tooltips (Placement bars,
 * activity calendar days, hour columns): a title line with a count on the
 * right, a muted subtitle, then any number of `HoverCardSection`s.
 */
function HoverStatCard({
  title,
  meta,
  subtitle,
  edgeColor = "rgba(200,170,110,.45)",
  children,
}: {
  title: ReactNode;
  meta?: ReactNode;
  subtitle?: ReactNode;
  /** Border color — the tier edge of whatever the card describes. */
  edgeColor?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className="w-60 border bg-lol-navy-900/95 px-3.5 py-3 text-xs shadow-[0_8px_24px_rgba(0,0,0,.55)] backdrop-blur-sm"
      style={{ borderColor: edgeColor }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="font-display text-[15px] tracking-[.06em] whitespace-nowrap text-lol-gold-50">{title}</div>
        {meta ? <div className="whitespace-nowrap text-lol-text-muted">{meta}</div> : null}
      </div>
      {subtitle ? <div className="mt-0.5 text-lol-text-muted">{subtitle}</div> : null}
      {children}
    </div>
  );
}

export { HoverStatCard };
export { HoverCardSection } from "./components/hover-card-section";
export { HoverCardRows } from "./components/hover-card-rows";
export { HoverCardChampions } from "./components/hover-card-champions";
export { HoverCardPlacementBars } from "./components/hover-card-placement-bars";
