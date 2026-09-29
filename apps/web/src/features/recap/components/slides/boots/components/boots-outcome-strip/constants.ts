import type { BootsStats } from "@arena/types";

/**
 * Boots — a donut of which pair the summoner actually buys, beside a legend
 * ranking all 8 of Arena's boots.
 *
 * The numbers behind it come from timeline purchase/sale events, not from
 * end-of-match inventory (see `BootStats`): Arena players sell their boots
 * off late in a match often enough that `items` alone would badly undercount
 * them — roughly half of this summoner's pairs were sold before the game
 * ended, and about half of their matches finished barefoot. That sell-off is
 * the section's actual story, hence the BOUGHT/SOLD toggle rather than one
 * static chart.
 *
 * Slice color runs down the app's rarity-tier gradient BY RANK (most-bought
 * pair prismatic, least silver) rather than using a categorical palette —
 * the same `tierGradient` ramp the activity calendar and the polar hour
 * chart use, so "brighter = more" reads without a color key.
 */
const OUTCOME_ROWS: { key: keyof BootsStats["outcomes"]; label: string }[] = [
  { key: "keptOn", label: "KEPT THEM ON" },
  { key: "soldOff", label: "FINISHED BAREFOOT" },
  { key: "neverBought", label: "NEVER BOUGHT" },
];

export { OUTCOME_ROWS };
