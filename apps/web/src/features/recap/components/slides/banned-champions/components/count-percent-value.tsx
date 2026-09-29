"use client";

import { ValuePercentRow } from "@/components/value-percent-row";

/** "count | pct%" sidebar value — see `ValuePercentRow`. */
function CountPercentValue({ count, total }: { count: number; total: number }) {
  return (
    <ValuePercentRow value={count.toLocaleString()} pct={total > 0 ? (count / total) * 100 : 0} valueMinWidth="2.2em" />
  );
}

export { CountPercentValue };
