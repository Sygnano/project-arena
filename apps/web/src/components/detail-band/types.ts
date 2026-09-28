type Stat = {
  label: string;
  value: string;
  /** Highlight this cell (e.g. the headline number). */
  highlight?: boolean;
  /** Skip the left border on this cell. */
  bordered?: boolean;
  /** Prevent wrapping — use for values that shouldn't break mid-string. */
  nowrap?: boolean;
};

export type { Stat };
