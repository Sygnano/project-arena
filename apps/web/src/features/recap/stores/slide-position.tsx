"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Where a summoner-page section sits in the scroll sequence. Provided by
 * `SummonerStatsView` from its single ordered slide list, so every section's
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

export { SlideProvider, useSlide };
export type { SlidePosition };
