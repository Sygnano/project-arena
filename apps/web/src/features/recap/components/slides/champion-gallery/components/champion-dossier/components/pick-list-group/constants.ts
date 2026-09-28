import type { PickSortKey } from "./types";

const PICK_COLUMNS: readonly { key: PickSortKey; label: string }[] = [
  { key: "games", label: "GAMES" },
  { key: "win", label: "WIN" },
  { key: "first", label: "1ST" },
];

export { PICK_COLUMNS };
