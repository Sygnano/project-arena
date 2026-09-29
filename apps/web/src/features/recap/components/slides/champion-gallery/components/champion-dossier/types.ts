type Mode = "total" | "best";

/** One row of a `PickListGroup`: an item or augment with how many games on
 * this champion it was counted in and how many of those were won. */
type PickEntry = {
  id: number;
  name: string;
  iconUrl: string;
  games: number;
  wins: number;
  firsts: number;
};

export type { Mode, PickEntry };
