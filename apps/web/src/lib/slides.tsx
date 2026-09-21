"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Where a summoner-page section sits in the scroll sequence. Provided by
 * `stats-view.tsx` from its single ordered slide list, so every section's
 * DOM id, "next section" cue label and cue target come from one place
 * instead of being hand-typed per module (they had drifted: cues pointing at
 * "TEAMS" for a section titled "TEAM", "HALL OF FAME" for "AUGMENT GOD", …).
 */
type SlidePosition = {
  id: string;
  /** The following slide's id and short label, or null on the last slide. */
  next: { id: string; label: string } | null;
};

const SlideContext = createContext<SlidePosition | null>(null);

function SlideProvider({ value, children }: { value: SlidePosition; children: ReactNode }) {
  return <SlideContext.Provider value={value}>{children}</SlideContext.Provider>;
}

function useSlide(): SlidePosition | null {
  return useContext(SlideContext);
}

/** Smooth-scrolls to a slide by id (instant under reduced motion) and moves
 * keyboard focus to its heading, so Tab continues from the new section and
 * screen readers announce where the user landed. */
function scrollToSlide(id: string) {
  const section = document.getElementById(id);
  if (!section) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  section.scrollIntoView({
    behavior: reduceMotion ? "auto" : "smooth",
    block: "start",
  });
  const heading = section.querySelector<HTMLElement>("h1, h2");
  if (heading) {
    if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
  }
}

export { SlideProvider, useSlide, scrollToSlide };
export type { SlidePosition };
