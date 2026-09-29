"use client";

import type { ReactNode } from "react";

/** One titled block of the dossier's stat grid — a small caps heading over a
 * hairline rule, then its content. */
function StatGroup({
  title,
  tabs,
  aside,
  children,
  className,
}: {
  title: string;
  /** Tabs sitting right after the title (e.g. a list's categories). */
  tabs?: ReactNode;
  /** Right-aligned note on the heading line (e.g. an average). */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`flex min-w-0 flex-col ${className ?? ""}`}>
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
        <h3 className="text-[11px] tracking-[.26em] whitespace-nowrap text-lol-gold-300">{title}</h3>
        {tabs}
        {aside ? (
          <div className="ml-auto text-[11px] tracking-[.2em] text-lol-text-muted sm:whitespace-nowrap">{aside}</div>
        ) : null}
      </div>
      <div
        className="mt-1 mb-1 h-px w-full"
        style={{
          background: "linear-gradient(90deg, rgba(200,170,110,.32), transparent)",
        }}
      />
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  );
}

export { StatGroup };
