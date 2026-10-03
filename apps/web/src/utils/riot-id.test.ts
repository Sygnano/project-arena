import { describe, expect, it } from "vitest";
import { parseRiotIdSlug, summonerPath } from "@/utils/riot-id";

describe("parseRiotIdSlug", () => {
  it("splits the name from the tag", () => {
    expect(parseRiotIdSlug("Some Name-EUW")).toEqual({ gameName: "Some Name", tagLine: "EUW" });
  });

  it("decodes the percent-encoded params Next passes", () => {
    expect(parseRiotIdSlug("Nobody%20Here-EUW")).toEqual({ gameName: "Nobody Here", tagLine: "EUW" });
  });

  it("round-trips summonerPath", () => {
    const slug = summonerPath("euw1", "Élève Ωmega", "EUW").split("/").pop()!;
    expect(parseRiotIdSlug(slug)).toEqual({ gameName: "Élève Ωmega", tagLine: "EUW" });
  });

  it.each([
    ["no separator", "NoTagHere"],
    ["a hyphen in the game name", "Some-Name-EUW"],
    ["empty tag", "Name-"],
    ["empty name", "-EUW"],
    ["path traversal", "..-EUW"],
    ["markup", "<b>x</b>-EUW"],
    ["NUL byte", "Name%00x-EUW"],
  ])("refuses %s", (_, slug) => {
    expect(parseRiotIdSlug(slug)).toBeNull();
  });
});
