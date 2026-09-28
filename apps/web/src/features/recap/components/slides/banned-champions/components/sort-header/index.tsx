"use client";

import type { ReactNode } from "react";
import { cn } from "cn";
import { Caret } from "./components/caret";
import { ALIGN } from "./constants";

type Props = {
  /** The column's caption. Usually a short uppercase string, but the swing
   * rail passes a whole three-part scale row. */
  children: ReactNode;
  /** True when the list is currently sorted by this column. */
  active: boolean;
  /** The direction this column is sorted in — only rendered when `active`. */
  dir: "asc" | "desc";
  onSort: () => void;
  align?: "left" | "right" | "center";
  /** Let the caption keep the cell's full width — the swing rail spreads its
   * own scale across it and has to stay aligned with the rails below, so the
   * caret floats past the edge instead of taking space from the label. By
   * default the button hugs its label, so the clickable area matches what it
   * reads as. */
  fill?: boolean;
  /** False for a header that sorts the same way as a neighbour showing the
   * caret already (Bans' swing rail sorts by WIN %), so the pair reads as one
   * sort instead of two. */
  caret?: boolean;
  className?: string;
};

/**
 * A clickable column header for the summoner page's list panels. Clicking an
 * inactive column sorts by it (in that column's natural direction, which the
 * caller decides); clicking the active one flips the direction.
 *
 * Styled to match the static `text-[11px] tracking-[.22em]` headers it
 * replaces — the active column goes gold and grows a caret, so the header row
 * itself says what the list is ordered by.
 */
function SortHeader({ children, active, dir, onSort, align = "left", fill = false, caret = true, className }: Props) {
  return (
    <button
      type="button"
      onClick={onSort}
      aria-label={typeof children === "string" ? `Sort by ${children.toLowerCase()}` : undefined}
      className={cn(
        "group flex cursor-pointer items-center gap-1.5 text-[11px] tracking-[.22em] transition-colors duration-150",
        ALIGN[align],
        fill ? "relative w-full" : "w-fit",
        active ? "text-lol-gold-100" : "text-[#a09b8c] hover:text-lol-gold-100",
        className,
      )}
    >
      {align === "right" && !fill ? (
        <>
          {caret ? <Caret active={active} dir={dir} /> : null}
          <span>{children}</span>
        </>
      ) : (
        <>
          <span className={cn(fill && "w-full")}>{children}</span>
          {caret ? <Caret active={active} dir={dir} fill={fill} /> : null}
        </>
      )}
    </button>
  );
}

export { SortHeader };
