"use client";

import type { ReactNode } from "react";

function HoverCardSection({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <>
      <div className="my-2.5 h-px bg-[rgba(200,170,110,.25)]" />
      {label ? <div className="mb-1 text-[10px] tracking-[.22em] text-lol-text-muted">{label}</div> : null}
      {children}
    </>
  );
}

export { HoverCardSection };
