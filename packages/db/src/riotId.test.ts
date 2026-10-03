import { describe, expect, it } from "vitest";
import { riotIdColumns, riotIdKey } from "./riotId.js";

describe("riotIdKey", () => {
  it("trims and lowercases beyond ASCII (Postgres's C collation can't)", () => {
    expect(riotIdKey("  ÉLÈVE Ωmega ", " EuW ")).toBe("élève ωmega#euw");
  });

  it("gives composed and decomposed spellings the same key", () => {
    expect(riotIdKey("Café", "EUW")).toBe(riotIdKey("Café", "EUW"));
  });
});

describe("riotIdColumns", () => {
  it("stores trimmed names next to their key", () => {
    expect(riotIdColumns("Name ", " TAG")).toEqual({
      riotIdGameName: "Name",
      riotIdTagline: "TAG",
      riotIdKey: "name#tag",
    });
  });
});
