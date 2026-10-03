import { describe, expect, it } from "vitest";
import { MIN_SAMPLE, pooledRate, sortByRate } from "@/features/recap/utils/sample";

interface Row {
  id: string;
  rate: number;
  games: number;
}

const rows: Row[] = [
  { id: "one-game-wonder", rate: 100, games: 1 },
  { id: "solid", rate: 60, games: 20 },
  { id: "small-but-ok", rate: 60, games: MIN_SAMPLE },
  { id: "weak", rate: 30, games: 40 },
  { id: "tiny-loss", rate: 0, games: 2 },
];
const ids = (list: Row[]) => list.map((r) => r.id);

describe("sortByRate", () => {
  it("ranks low-sample rows after every eligible row, by the same rate", () => {
    expect(
      ids(
        sortByRate(
          rows,
          (r) => r.rate,
          (r) => r.games,
        ),
      ),
    ).toEqual(["solid", "small-but-ok", "weak", "one-game-wonder", "tiny-loss"]);
  });

  it("breaks rate ties toward the larger sample", () => {
    const [first, second] = sortByRate(
      rows,
      (r) => r.rate,
      (r) => r.games,
    );
    expect([first?.id, second?.id]).toEqual(["solid", "small-but-ok"]);
  });

  it('ranks everyone together with lowSample "mixed"', () => {
    expect(
      ids(
        sortByRate(
          rows,
          (r) => r.rate,
          (r) => r.games,
          "desc",
          "mixed",
        ),
      ),
    ).toEqual(["one-game-wonder", "solid", "small-but-ok", "weak", "tiny-loss"]);
  });

  it("sorts ascending, still demoting low samples", () => {
    expect(
      ids(
        sortByRate(
          rows,
          (r) => r.rate,
          (r) => r.games,
          "asc",
        ),
      ),
    ).toEqual(["weak", "solid", "small-but-ok", "tiny-loss", "one-game-wonder"]);
  });
});

describe("pooledRate", () => {
  it("weights each row by its sample (sum of hits / sum of games), in percent", () => {
    const picks = [
      { wins: 1, games: 1 },
      { wins: 3, games: 9 },
    ];
    expect(
      pooledRate(
        picks,
        (p) => p.wins,
        (p) => p.games,
      ),
    ).toBe(40);
  });

  it("is 0 with no games", () => {
    expect(
      pooledRate(
        [],
        () => 1,
        () => 0,
      ),
    ).toBe(0);
  });
});
