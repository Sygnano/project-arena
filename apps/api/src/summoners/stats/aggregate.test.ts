import { describe, expect, it } from "vitest";
import { addToSplit, addToTally, avgOf, emptySplit, emptyTally, kdaRatio, maxBy, maxOf, sumOf } from "./aggregate.js";

const rows = [{ v: 4 }, { v: null }, { v: 2 }];

describe("SQL-like aggregates", () => {
  it("sum counts null as 0, avg and max skip it, empty input gives 0", () => {
    expect(sumOf(rows, (r) => r.v)).toBe(6);
    expect(avgOf(rows, (r) => r.v)).toBe(3);
    expect(maxOf(rows, (r) => r.v)).toBe(4);
    expect(avgOf([], () => 1)).toBe(0);
    expect(maxOf([], () => 1)).toBe(0);
  });

  it("maxBy keeps the earliest row on a tie", () => {
    const tied = [
      { id: 1, s: 5 },
      { id: 2, s: 5 },
    ];
    expect(maxBy(tied, (r) => r.s)?.id).toBe(1);
  });

  it("kdaRatio is kills + assists with no deaths", () => {
    expect(kdaRatio(3, 0, 4)).toBe(7);
    expect(kdaRatio(3, 2, 4)).toBe(3.5);
  });
});

describe("placements", () => {
  it('a "win" is a top-3 finish', () => {
    const tally = emptyTally();
    const split = emptySplit();
    for (const placement of [1, 2, 3, 4, 6]) {
      addToTally(tally, placement);
      addToSplit(split, placement);
    }
    expect(tally).toEqual({ count: 5, top1: 1, top3: 3 });
    expect(split).toEqual({ top1: 1, top3ExclTop1: 2, remaining: 2 });
  });
});
