type MultikillHeroes = {
  kind: "PENTAKILL" | "QUADRAKILL";
  total: number;
  /** Every champion who scored one, most first. */
  champions: { championName: string; count: number }[];
};

export type { MultikillHeroes };
