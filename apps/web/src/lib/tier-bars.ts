/**
 * The three Hextech rarity-tier bar styles (`.tier-bar-*` in globals.css)
 * shared by every ranked/stacked bar in the app — first built for KDA's top
 * 3 champion bars (`BAR_TIER` in `modules/KDA/index.tsx`) and TeamSlot's
 * fixed-meaning stack (`SEGMENT_TIER`). Pulled into one place once Champion
 * Picks, Banned Champions, and Placement all needed the identical
 * `{fillClass, edge, glow}` triples — see
 * design_handoff_arena_panels/README.md, "The tier-fill system (apply
 * app-wide)".
 */
export type Tier = "prismatic" | "gold" | "silver";

export type TierStyle = {
  fillClass: string;
  edge: string;
  glow: string;
};

export const TIER_STYLE: Record<Tier, TierStyle> = {
  prismatic: {
    fillClass: "tier-bar-prismatic",
    edge: "#f5eaff",
    glow: "0 0 20px rgba(185,138,221,.55)",
  },
  gold: {
    fillClass: "tier-bar-gold",
    edge: "var(--color-lol-gold-50)",
    glow: "0 0 20px rgba(200,155,60,.55)",
  },
  silver: {
    fillClass: "tier-bar-silver",
    edge: "#eef2f3",
    glow: "0 0 16px rgba(185,196,200,.5)",
  },
};

/** Maps a 0-based rank to a tier BY RANK (1st -> Prismatic, 2nd-3rd -> Gold,
 * everything else -> Silver) — the mapping used when ranks are re-sortable
 * (Champion Picks, Placement's bars). For a FIXED-MEANING assignment
 * (Placement's tiles are always "1st"/"2nd-3rd"/"rest" regardless of which
 * bar is tallest), index straight into `TIER_STYLE` instead. */
export function tierForRank(rank: number): Tier {
  if (rank === 0) return "prismatic";
  if (rank <= 2) return "gold";
  return "silver";
}

/** Maps a ban rate (0-100) to a tier BY THRESHOLD rather than by rank —
 * Banned Champions' bars use this so a champion's color reflects how often
 * it's actually banned, not just its position among the shown rows (e.g. two
 * champions both banned in 95%+ of matches should both read as Prismatic,
 * not just whichever sorts first). */
export function tierForBanRate(banRate: number): Tier {
  if (banRate > 90) return "prismatic";
  if (banRate > 50) return "gold";
  return "silver";
}

/** Representative flat swatches per tier — a stand-in for the full animated
 * `.tier-bar-*` gradients (see the doc comment above `TIER_STYLE`) for
 * callers that need interpolatable colors rather than a CSS background,
 * e.g. ranked charts that recolor continuously rather than in three
 * fixed bands. Picked from the same
 * source values `.tier-bar-*` itself is built from in globals.css
 * (`--color-augment-silver`, `--color-lol-gold-400`,
 * `--color-augment-prismatic(-pink)`). `prismaticPink` is only an
 * intermediate stop `tierGradient` routes through — see its doc comment. */
const TIER_SWATCH: Record<Tier | "prismaticPink", [number, number, number]> = {
  silver: [0xb9, 0xc4, 0xc8],
  gold: [0xc8, 0x9b, 0x3c],
  prismaticPink: [0xf2, 0xa6, 0xd0],
  prismatic: [0xb9, 0x8a, 0xdd],
};

function lerpChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function lerpRgb(from: readonly [number, number, number], to: readonly [number, number, number], t: number): string {
  const [r, g, b] = [0, 1, 2].map((i) => lerpChannel(from[i], to[i], t));
  return `rgb(${r}, ${g}, ${b})`;
}

/** Interpolates silver (t=0) -> gold (t=0.5) -> prismatic (t=1), clamping
 * `t` to `[0,1]` first. Gives ranked rows a continuous color along the app's
 * rarity-tier palette instead of a hardcoded 3-band scale.
 *
 * The top half routes through `prismaticPink` (t=0.75) as an extra stop
 * rather than lerping gold straight to prismatic-violet in one hop. Two
 * things were tried and rejected first: plain RGB lerp gold->violet lands on
 * a muddy, desaturated salmon-brown around t=0.65 that belongs to neither
 * tier (amber and violet are near-opposite hues, so their channel-average
 * is close to gray); switching to HSL lerp with hue taking its shortest
 * path fixed that but broke the BOTTOM half instead — silver's hue is
 * technically "closer" to gold going through green/yellow than through
 * blue/violet, so a shortest-hue-path lerp there produces a visible green
 * flash for low-activity days, which is worse. Routing through pink (one of
 * the app's own four canonical prismatic hues, see
 * `--gradient-augment-prismatic` in globals.css) keeps every hop a plain RGB
 * lerp between hues that are already close together (amber-to-pink,
 * pink-to-violet), which stays vivid without needing hue-space math at all. */
export function tierGradient(t: number): string {
  const clamped = Math.min(1, Math.max(0, t));
  if (clamped <= 0.5) {
    return lerpRgb(TIER_SWATCH.silver, TIER_SWATCH.gold, clamped / 0.5);
  }
  if (clamped <= 0.75) {
    return lerpRgb(TIER_SWATCH.gold, TIER_SWATCH.prismaticPink, (clamped - 0.5) / 0.25);
  }
  return lerpRgb(TIER_SWATCH.prismaticPink, TIER_SWATCH.prismatic, (clamped - 0.75) / 0.25);
}

/** A calendar day's tier by games played: 1+ -> Silver, 3+ -> Gold,
 * 5+ -> Prismatic. Flat bands on purpose (no gradient between them). */
export function tierForDayGames(games: number): Tier | null {
  if (games >= 5) return "prismatic";
  if (games >= 3) return "gold";
  if (games >= 1) return "silver";
  return null;
}

/** A calendar day's tier by its best finish: played -> Silver, a win (top 3)
 * -> Gold, a 1st place -> Prismatic. */
export function tierForDayBestPlacement(bestPlacement: number): Tier {
  if (bestPlacement <= 1) return "prismatic";
  if (bestPlacement <= 3) return "gold";
  return "silver";
}

/** A card/ring tier by BEST FINISH: 1st place -> Prismatic, top 3 -> Gold,
 * played without a top 3 -> Silver, never played -> `null`. Shared by every
 * hall-of-fame grid and framed card so a ring means the same thing everywhere. */
export function tierForBestFinish(outcome: { top1: number; top3ExclTop1: number } | undefined): Tier | null {
  if (!outcome) return null;
  if (outcome.top1 > 0) return "prismatic";
  if (outcome.top3ExclTop1 > 0) return "gold";
  return "silver";
}
