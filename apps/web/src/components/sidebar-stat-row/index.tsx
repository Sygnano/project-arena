import type { ReactNode } from "react";
import { cn } from "cn";
import { SIZE_CLASSES } from "./constants";
import type { Size } from "./types";

type Props = {
  label: string;
  /** Plain content next to the diamond+label — a string is wrapped in the
   * standard display-type value styling; pass a node directly (e.g.
   * TimePlayed's multi-part duration) for anything richer. */
  children: ReactNode;
  /** Drops the row's own top border and adds a matching bottom border —
   * for the last row in a list, so the whole stack reads as one bordered
   * block instead of doubling the border between rows. */
  last?: boolean;
  /** `"default"` (14px label / 22px value, KDA/TimePlayed's original size)
   * or `"compact"` (13.5px label / 21px value, used where the design calls
   * for a denser row — Champion Picks' identity column, Economy's vault
   * rows, Kills' record columns). */
  size?: Size;
  /** Override the value's color (e.g. Champion Picks' cyan 1ST RATE row). */
  valueColor?: string;
};

/**
 * One row of the "gold diamond + label + value" sidebar stat list — first
 * built inline for KDA's K/D/A totals, then duplicated (with a `last` prop)
 * as a local component in the TimePlayed slide. Pulled out here once the
 * design handoff called for the exact same row shape in two more places
 * (Champion Picks' and Banned Champions' identity columns), at two
 * different sizes the design distinguishes by meaning, not by section — see
 * `size`.
 */
function SidebarStatRow({ label, children, last = false, size = "default", valueColor }: Props) {
  const classes = SIZE_CLASSES[size];
  return (
    <div
      className={cn("sidebar-stat-row flex items-center", classes.row)}
      style={{
        borderTop: "1px solid rgba(200,170,110,.14)",
        borderBottom: last ? "1px solid rgba(200,170,110,.14)" : undefined,
      }}
    >
      <div className="h-1.75 w-1.75 flex-none rotate-45 bg-lol-gold-300" />
      <div className={cn("flex-1 tracking-[.12em] text-lol-text-secondary", classes.label)}>{label}</div>
      {typeof children === "string" || typeof children === "number" ? (
        <div className={cn("font-display", classes.value)} style={{ color: valueColor ?? "var(--color-lol-gold-50)" }}>
          {children}
        </div>
      ) : (
        children
      )}
    </div>
  );
}

export { SidebarStatRow };
export type { Size } from "./types";
