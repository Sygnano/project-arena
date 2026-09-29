import type { ReactNode } from "react";
import { SidebarStatRow, type Size } from "./sidebar-stat-row";

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

export { SidebarStatRows };
