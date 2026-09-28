"use client";

import { cn } from "cn";

/** The gold triangle marking the sorted column. Inactive columns keep it in
 * the layout at zero opacity (revealed on hover) so a header doesn't shift
 * sideways when it becomes the sort. */
function Caret({ active, dir, fill = false }: { active: boolean; dir: "asc" | "desc"; fill?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex-none transition-opacity duration-150",
        fill && "absolute top-1/2 -right-2.5 -translate-y-1/2",
        active ? "opacity-100" : "opacity-0 group-hover:opacity-45",
      )}
      style={{
        width: 0,
        height: 0,
        borderLeft: "3.5px solid transparent",
        borderRight: "3.5px solid transparent",
        ...(dir === "desc" ? { borderTop: "4px solid currentColor" } : { borderBottom: "4px solid currentColor" }),
      }}
    />
  );
}

export { Caret };
