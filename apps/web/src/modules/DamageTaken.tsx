"use client";

import type { ChampionStats, DamageStats } from "@arena/types";
import { Damage } from "./Damage";

type Props = {
  damageTaken: DamageStats;
  champions: Record<number, ChampionStats>;
  skillshotsDodged?: { total: number; best: number };
};

/**
 * Thin wrapper around `Damage` for the DAMAGE TAKEN section — same panels,
 * chart, sorting and motion, just pointed at `variant="taken"` (which
 * switches every champion lookup to `champion.damageTaken` and swaps the
 * title/quote/dial/detail-band labels accordingly). Kept as its own file
 * rather than inlining `variant="taken"` at the call site so the summoner
 * page's module list reads the same way every other section does — one
 * import per visible section.
 */
const DamageTaken = ({ damageTaken, champions, skillshotsDodged }: Props) => (
  <Damage variant="taken" damage={damageTaken} champions={champions} skillshots={skillshotsDodged} />
);

export { DamageTaken };
