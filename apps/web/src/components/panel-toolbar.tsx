"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "cn";
import { FadingRule } from "@/components/fading-rule";

type Props = {
  /** The tabs, left to right: DiamondTabs groups split by `ToolbarDivider`s. */
  children: ReactNode;
  /** Sits after the rule at the row's right end — the `LowSampleSwitch`,
   * while a rate sort is active. */
  trailing?: ReactNode;
  /** What the panel currently shows ("PER GAME · BY ASSISTS · ..."), on its
   * own line under the controls. */
  caption?: ReactNode;
  /** Identifies the caption for its crossfade when it isn't a plain string. */
  captionKey?: string;
  className?: string;
};

/**
 * A panel's header: the tabs on the left, a fading rule, the trailing switch
 * at the right end, and the caption on a line of its own underneath. The
 * caption used to share the controls' row, so it (or the switch, when it
 * appeared) wrapped onto a second line wherever the row ran out of width —
 * now the second line is the design rather than an accident.
 *
 * The switch slides in from the right when it appears. The row is tall
 * enough for the switch whether or not it's showing, so the
 * content below doesn't jump when a tab brings the switch in or out. The
 * caption's hollow diamond sits in the same column as the tabs' active
 * diamonds, and it crossfades when the caption changes with a tab.
 */
function PanelToolbar({ children, trailing, caption, captionKey, className }: Props) {
  const key = captionKey ?? (typeof caption === "string" ? caption : undefined);
  return (
    <div className={cn("mb-4 flex flex-col gap-1.5", className)}>
      <div className="flex min-h-10 flex-wrap items-center gap-x-6 gap-y-3">
        {children}
        <FadingRule className="mb-2" />
        <AnimatePresence initial={false}>
          {trailing ? (
            <motion.div
              key="trailing"
              className="flex-none"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              {trailing}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
      {caption ? (
        <div className="flex min-h-4 items-center gap-2 pl-0.5 text-[11px] tracking-[.28em] text-lol-text-muted">
          <span aria-hidden className="h-1.5 w-1.5 flex-none rotate-45 border border-lol-gold-300/55" />
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={key}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              {caption}
            </motion.span>
          </AnimatePresence>
        </div>
      ) : null}
    </div>
  );
}

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

export { PanelToolbar, ToolbarDivider };
