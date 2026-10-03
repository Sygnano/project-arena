import type { RiotMatchTimelineDto } from "@arena/types";
import { describe, expect, it } from "vitest";
import { groupBy } from "./fixtures/group-by.js";
import { FIXTURE_MATCH_ID, loadFixtureMatch } from "./fixtures/index.js";
import { parseMatch } from "./parseMatch.js";

type TimelineEvent = RiotMatchTimelineDto["info"]["frames"][number]["events"][number];

/** The fixture's timeline with every event replaced by `events` (frames keep their stats). */
function withEvents(timeline: RiotMatchTimelineDto, events: Partial<TimelineEvent>[]): RiotMatchTimelineDto {
  timeline.info.frames.forEach((frame, i) => {
    frame.events = (i === 1 ? events : []) as TimelineEvent[];
  });
  return timeline;
}

describe("parseMatch on a real match", () => {
  const { dto, timeline } = loadFixtureMatch();
  const { match, participants } = parseMatch(FIXTURE_MATCH_ID, "euw1", dto, timeline);

  it("takes team size, team count and placements from the match itself", () => {
    const teams = groupBy(participants, (p) => p.teamId);
    const sizes = new Set([...teams.values()].map((members) => members.length));
    expect(sizes.size).toBe(1);
    for (const members of teams.values()) {
      expect(new Set(members.map((p) => p.placement)).size).toBe(1);
    }
    const placements = [...teams.values()].map((members) => members[0]!.placement).sort((a, b) => a - b);
    expect(placements).toEqual(Array.from({ length: teams.size }, (_, i) => i + 1));
  });

  it("drops empty augment slots", () => {
    for (const p of participants) expect(p.augments).not.toContain(0);
  });

  it("matches the stored derivation", () => {
    expect(match.bannedChampionIds).toMatchSnapshot();
    expect(
      participants.map((p) => ({
        puuid: p.puuid,
        teamId: p.teamId,
        placement: p.placement,
        augments: p.augments,
        bootsBought: p.bootsBought,
        bootsSold: p.bootsSold,
        statAnvilsBought: p.statAnvilsBought,
        legendaryAnvilsBought: p.legendaryAnvilsBought,
        prismaticAnvilsBought: p.prismaticAnvilsBought,
        purchasedItemIds: p.purchasedItemIds,
      })),
    ).toMatchSnapshot();
  });
});

describe("parseMatch item events", () => {
  const BERSERKERS = 223006;
  const SWIFTNESS = 223009;

  function playerOne(events: Partial<TimelineEvent>[]) {
    const { dto, timeline } = loadFixtureMatch();
    const id = timeline.info.participants[0]!;
    const { participants } = parseMatch(FIXTURE_MATCH_ID, "euw1", dto, withEvents(timeline, events));
    return participants.find((p) => p.puuid === id.puuid)!;
  }

  it("cancels an undone purchase ({beforeId: item, afterId: 0})", () => {
    const p = playerOne([
      { type: "ITEM_PURCHASED", participantId: 1, itemId: BERSERKERS, timestamp: 1 },
      { type: "ITEM_UNDO", participantId: 1, beforeId: BERSERKERS, afterId: 0, timestamp: 2 },
      { type: "ITEM_PURCHASED", participantId: 1, itemId: SWIFTNESS, timestamp: 3 },
    ]);
    expect(p.bootsBought).toEqual([SWIFTNESS]);
    expect(p.purchasedItemIds).toEqual([SWIFTNESS]);
  });

  it("cancels an undone sale ({beforeId: 0, afterId: item}) and never subtracts sales from purchases", () => {
    const p = playerOne([
      { type: "ITEM_PURCHASED", participantId: 1, itemId: SWIFTNESS, timestamp: 1 },
      { type: "ITEM_SOLD", participantId: 1, itemId: SWIFTNESS, timestamp: 2 },
      { type: "ITEM_UNDO", participantId: 1, beforeId: 0, afterId: SWIFTNESS, timestamp: 3 },
      { type: "ITEM_SOLD", participantId: 1, itemId: SWIFTNESS, timestamp: 4 },
    ]);
    expect(p.bootsBought).toEqual([SWIFTNESS]);
    expect(p.bootsSold).toEqual([SWIFTNESS]);
    expect(p.purchasedItemIds).toEqual([SWIFTNESS]);
  });

  it("doesn't count a destroyed pair as sold", () => {
    const p = playerOne([
      { type: "ITEM_PURCHASED", participantId: 1, itemId: BERSERKERS, timestamp: 1 },
      { type: "ITEM_DESTROYED", participantId: 1, itemId: BERSERKERS, timestamp: 2 },
    ]);
    expect(p.bootsSold).toEqual([]);
  });

  it("reports unknown (null), not zero, without a timeline", () => {
    const { dto } = loadFixtureMatch();
    const [p] = parseMatch(FIXTURE_MATCH_ID, "euw1", dto, null).participants;
    expect(p!.bootsBought).toBeNull();
    expect(p!.purchasedItemIds).toBeNull();
    expect(p!.statAnvilsBought).toBeNull();
  });
});
