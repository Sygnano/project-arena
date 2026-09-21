"use client";

import type { CSSProperties, ReactNode } from "react";
import { cn } from "cn";
import { useSectionInView } from "@/hooks/use-section-in-view";

type Props = {
  children: ReactNode;
  /** Merged onto the wrapper, which replaces the plain `<div>` it stands in
   * for — pass the layout classes that div already had rather than nesting a
   * second element inside it. */
  className?: string;
  style?: CSSProperties;
  /** Offsets this block's entrance, for staggering the parts of one section
   * (e.g. the panel a beat behind the title column). */
  delayMs?: number;
  /** Drives the entrance from outside instead of this block observing itself
   * — `CategorySection` passes its whole section's state so every block of a
   * slide shares one trigger. Left undefined, the block observes its own
   * position. */
  inView?: boolean;
};

/**
 * Fades and lifts its content in whenever it scrolls into view, and out again
 * as it leaves, so returning to a section replays the entrance.
 *
 * This is the page-wide baseline every section gets through `CategorySection`
 * and `HeroSection`; it deliberately stays a plain CSS transition on one
 * wrapper rather than animating a section's individual rows or bars. Sections
 * that have their own richer motion (HourStrip's growing bars, the activity
 * calendar's staggered cells, `HextechBarChart`'s re-sort) keep it — those run
 * on mount, inside a block this has already faded up.
 *
 * Under `prefers-reduced-motion` `useSectionInView` reports true from the start, so
 * the content renders at rest with nothing to transition.
 *
 * A block observing itself only counts as in view inside the middle band of
 * the scroll container, so a short block near a slide's top edge (a
 * full-width slide's title row) never gets there and stays invisible. Pass
 * `inView` from an ancestor that spans the slide for anything like that.
 */
function Reveal({ children, className, style, delayMs = 0, inView: inViewProp }: Props) {
  const [ref, ownInView] = useSectionInView<HTMLDivElement>();
  const inView = inViewProp ?? ownInView;
  return (
    <div
      ref={inViewProp === undefined ? ref : undefined}
      className={cn(
        "transition-[opacity,transform,translate] duration-500 ease-out",
        inView ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
        className,
      )}
      style={{ transitionDelay: inView ? `${delayMs}ms` : "0ms", ...style }}
    >
      {children}
    </div>
  );
}

export { Reveal };
