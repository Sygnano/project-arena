type Mode = "total" | "average" | "best";

type Selection = "all" | number;

/** Cumulative damage to champions at one minute of a match. */
type DamageCurvePoint = {
  minute: number;
  physical: number;
  magical: number;
  trueDamage: number;
};

type Findings = {
  final: number;
  /** Fractional minute the curve crosses half of `final`, interpolated
   * between the two minutes around it. */
  halfMinute: number;
  byMinute10: number;
  byMinute20: number;
  /** The one-minute stretch that added the most damage, ending at `minute`. */
  peak: { minute: number; dealt: number };
};

export type { Mode, Selection, DamageCurvePoint, Findings };
