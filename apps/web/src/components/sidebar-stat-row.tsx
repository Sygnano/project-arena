import type { ReactNode } from "react";
import { cn } from "cn";

type Size = "default" | "compact";

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

const SIZE_CLASSES: Record<Size, { row: string; label: string; value: string }> = {
  default: {
    row: "gap-3.5 px-1 py-3.25",
    label: "text-sm",
    value: "text-[22px]",
  },
  compact: {
    row: "gap-3.5 px-1 py-2.75",
    label: "text-[13.5px]",
    value: "text-[21px]",
  },
};

/**
 * One row of the "gold diamond + label + value" sidebar stat list — first
 * built inline for KDA's K/D/A totals, then duplicated (with a `last` prop)
 * as a local component in `modules/TimePlayed`. Pulled out here once the
 * design handoff called for the exact same row shape in two more places
 * (Champion Picks' and Banned Champions' identity columns), at two
 * different sizes the design distinguishes by meaning, not by section — see
 * `size`.
 */
function SidebarStatRow({
  label,
  children,
  last = false,
  size = "default",
  valueColor,
}: Props) {
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
      <div
        className={cn(
          "flex-1 tracking-[.12em] text-lol-text-secondary",
          classes.label,
        )}
      >
        {label}
      </div>
      {typeof children === "string" || typeof children === "number" ? (
        <div
          className={cn("font-display", classes.value)}
          style={{ color: valueColor ?? "var(--color-lol-gold-50)" }}
        >
          {children}
        </div>
      ) : (
        children
      )}
    </div>
  );
}

type Row = {
  label: string;
  value: ReactNode;
  valueColor?: string;
};

/** A full `SidebarStatRow` list from a plain `[{label, value}]` array —
 * automatically marks the last row so its bottom border closes the block. */
function SidebarStatRows({ rows, size }: { rows: readonly Row[]; size?: Size }) {
  return (
    <div className="flex flex-col gap-0.5">
      {rows.map((row, index) => (
        <SidebarStatRow
          key={row.label}
          label={row.label}
          last={index === rows.length - 1}
          size={size}
          valueColor={row.valueColor}
        >
          {row.value}
        </SidebarStatRow>
      ))}
    </div>
  );
}

export { SidebarStatRow, SidebarStatRows };
