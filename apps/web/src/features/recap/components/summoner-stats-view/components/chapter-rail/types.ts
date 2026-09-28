type RailSlide = {
  id: string;
  /** Short uppercase label, also used on the previous slide's next cue. */
  label: string;
  /** Chapter heading this slide is grouped under in the rail. */
  chapter: string;
};

export type { RailSlide };
