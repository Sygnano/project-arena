import type { ReactNode } from "react";
import { cn } from "cn";

type Props = {
  /** Content of the title cartouche that cuts through the broken top edge —
   * usually a short label like a metric name. Omit for a panel with no
   * cartouche — the top edge renders as a plain unbroken line instead. */
  title?: ReactNode;
  children: ReactNode;
  /** Extra classes for the outer wrapper (sizing/positioning within
   * whatever layout this panel sits in) — this component only owns the
   * panel chrome itself, not where it's placed. */
  className?: string;
  /** Extra classes for the padded body div the children render into. */
  bodyClassName?: string;
};

const CORNER_DIAMOND_POSITIONS = [
  "-top-1.75 -left-1.75",
  "-top-1.75 -right-1.75",
  "-bottom-1.75 -left-1.75",
  "-bottom-1.75 -right-1.75",
] as const;

/**
 * The Hextech "broken-corner instrument panel" chrome from the Claude
 * Design handoff (`design_handoff_arena_kda/README.md`, "Frame chrome") — a
 * translucent frosted fill, a broken gold top edge (the gap is where the
 * title cartouche sits), four interrupted corner diamonds (not rounded —
 * this is the core Hextech move, keep it), and a centered title cartouche
 * cutting through the top edge. First built for the KDA section's
 * instrument panel; factored out here since the design calls for the same
 * panel language on the sections that follow it (Damage, Champions, Items,
 * Match history).
 *
 * The corner diamonds' fill (`bg-lol-navy-950`) and the cartouche's
 * background (`#040c14`, the design's "panel ink" token) are hardcoded
 * rather than themed — Arena Stats is a single, permanently dark Hextech
 * theme (see globals.css), not a multi-background system, so there's
 * nothing to parameterize yet.
 */
function HextechPanel({ title, children, className, bodyClassName }: Props) {
  return (
    <div className={cn("relative min-h-0 min-w-0 mt-6.5 self-stretch", className)}>
      <div
        className="absolute inset-0 border"
        style={{
          background:
            "linear-gradient(155deg, rgba(9,20,40,.62), rgba(3,10,18,.72))",
          backdropFilter: "blur(3px)",
          borderColor: "rgba(200,170,110,.3)",
        }}
      />
      <div
        className="absolute -top-px right-3.5 left-3.5 h-px"
        style={{
          background: title
            ? "linear-gradient(90deg, transparent, rgba(200,170,110,.5) 20%, transparent 44%, transparent 56%, rgba(200,170,110,.5) 80%, transparent)"
            : "linear-gradient(90deg, transparent, rgba(200,170,110,.5) 20%, rgba(200,170,110,.5) 80%, transparent)",
        }}
      />
      {CORNER_DIAMOND_POSITIONS.map((position) => (
        <div
          key={position}
          className={cn(
            "absolute h-3.25 w-3.25 rotate-45 border bg-lol-navy-950",
            position,
          )}
          style={{ borderColor: "rgba(200,170,110,.75)" }}
        />
      ))}

      {title ? (
        <div className="absolute -top-6.25 left-1/2 flex -translate-x-1/2 items-center gap-4 bg-[#040c14] px-5.5">
          <div
            className="h-2.25 w-2.25 rotate-45 border"
            style={{ borderColor: "rgba(200,170,110,.6)" }}
          />
          <div className="font-display pl-[.2em] text-[27px] tracking-[.2em] text-lol-gold-50">
            {title}
          </div>
          <div
            className="h-2.25 w-2.25 rotate-45 border"
            style={{ borderColor: "rgba(200,170,110,.6)" }}
          />
        </div>
      ) : null}

      <div
        className={cn(
          "relative box-border flex h-full min-w-0 flex-col px-9 pt-11 pb-6.5",
          bodyClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}

export { HextechPanel };
