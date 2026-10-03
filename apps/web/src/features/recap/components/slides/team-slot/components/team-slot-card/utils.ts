import type { TeamSlotBreakdown } from "@arena/types";

function slotGames(row: TeamSlotBreakdown) {
  return row.top1 + row.top3ExclTop1 + row.remaining;
}

function percent(part: number, whole: number) {
  return whole > 0 ? (part / whole) * 100 : 0;
}

export { percent, slotGames };
