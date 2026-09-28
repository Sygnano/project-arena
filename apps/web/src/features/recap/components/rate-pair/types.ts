type Rate = {
  label: string;
  /** 0-100, or null when there's no sample to compute it from. */
  value: number | null;
  highlight?: boolean;
  /** The summoner's own rate over all games (0-100). When given, a signed
   * "vs average" difference (in %) is shown under the label. */
  baseline?: number;
  /** Games behind `value`; under `MIN_SAMPLE` the difference is withheld.
   * Omit it to always show the difference. */
  sample?: number;
};

export type { Rate };
