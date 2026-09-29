type DonutSlice = {
  key: string;
  label: string;
  value: number;
  /** A literal color, not a CSS variable — nivo writes it straight into an
   * SVG `fill` attribute. */
  color: string;
};

export type { DonutSlice };
