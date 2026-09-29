import type { ReactNode } from "react";
import type { StoryTransition } from "./constants";

/** What a slide can do to the player (the finale's replay button). */
type StoryControls = {
  restart: () => void;
  close: () => void;
};

type StorySlide = {
  id: string;
  /** Short name, for the progress bar's buttons and screen readers. */
  label: string;
  /** How long it stays before the next one: long enough to read its text. */
  durationMs: number;
  /** How it comes in. */
  transition: StoryTransition;
  /** Its background art, preloaded while the slide before it plays. */
  background: string;
  render: (controls: StoryControls) => ReactNode;
};

export type { StoryControls, StorySlide };
