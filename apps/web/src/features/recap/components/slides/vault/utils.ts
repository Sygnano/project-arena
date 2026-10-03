import type { ItemOutcomeStats } from "@arena/types";

const pct = (count: number, total: number) => (total > 0 ? (count / total) * 100 : 0);

const itemRate = (item: ItemOutcomeStats, key: "top3" | "top1") =>
  item.timesPicked > 0 ? item[key] / item.timesPicked : 0;

export { itemRate, pct };
