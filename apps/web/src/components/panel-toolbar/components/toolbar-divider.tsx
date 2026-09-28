"use client";

import { cn } from "cn";

type DividerProps = {
  /** Match the DiamondTabs size beside it: their labels sit above the row's
   * centre (space is reserved under them for the underline), and the divider
   * lifts by the same margin to centre on the labels. */
  alignWith?: "md" | "sm";
};

/** The short vertical gold hairline between two groups of tabs. */
function ToolbarDivider({ alignWith = "md" }: DividerProps) {
  return (
    <div
      aria-hidden
      className={cn("h-4 w-px flex-none bg-[rgba(200,170,110,.25)]", alignWith === "md" ? "mb-2" : "mb-1.25")}
    />
  );
}

export { ToolbarDivider };
