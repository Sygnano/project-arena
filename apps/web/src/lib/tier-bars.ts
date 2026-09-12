/**
 * The three Hextech rarity-tier bar styles (`.tier-bar-*` in globals.css)
 * shared by every ranked/stacked bar in the app — first built for KDA's top
 * 3 champion bars (`BAR_TIER` in `modules/KDA/index.tsx`) and TeamSlot's
 * fixed-meaning stack (`SEGMENT_TIER`). Pulled into one place once Champion
 * Picks, Banned Champions, and Placement all needed the identical
 * `{fillClass, edge, glow}` triples — see
 * design_handoff_arena_panels/README.md, "The tier-fill system (apply
 * app-wide)". KDA's and TeamSlot's own local tables are left as-is (already
 * shipped, byte-identical values) rather than migrated onto this.
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
 * e.g. TimePlayed's activity calendar, which recolors every day cell
 * continuously rather than in three fixed bands. Picked from the same
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

function lerpRgb(
  from: readonly [number, number, number],
  to: readonly [number, number, number],
  t: number,
): string {
  const [r, g, b] = [0, 1, 2].map((i) => lerpChannel(from[i], to[i], t));
  return `rgb(${r}, ${g}, ${b})`;
}

/** Interpolates silver (t=0) -> gold (t=0.5) -> prismatic (t=1), clamping
 * `t` to `[0,1]` first. Used by TimePlayed's activity calendar to give every
 * day cell a continuous color along the app's rarity-tier palette instead of
 * a hardcoded 3-band scale.
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
    return lerpRgb(
      TIER_SWATCH.gold,
      TIER_SWATCH.prismaticPink,
      (clamped - 0.5) / 0.25,
    );
  }
  return lerpRgb(
    TIER_SWATCH.prismaticPink,
    TIER_SWATCH.prismatic,
    (clamped - 0.75) / 0.25,
  );
}

/** Maps a day's games-played count to a `tierGradient` position — silver
 * starting at 1 game, gold at 5, prismatic from 10+. */
export function gamesTierPosition(games: number): number {
  if (games <= 1) return 0;
  if (games >= 10) return 1;
  if (games <= 5) return ((games - 1) / (5 - 1)) * 0.5;
  return 0.5 + ((games - 5) / (10 - 5)) * 0.5;
}

/** Maps a day's average placement to a `tierGradient` position — inverted,
 * since a LOWER placement is better: prismatic at an average of 1st, gold at
 * 3rd, silver from 6th (worst) down. */
export function placementTierPosition(avgPlacement: number): number {
  if (avgPlacement <= 1) return 1;
  if (avgPlacement >= 6) return 0;
  if (avgPlacement <= 3) return 1 - ((avgPlacement - 1) / (3 - 1)) * 0.5;
  return 0.5 - ((avgPlacement - 3) / (6 - 3)) * 0.5;
}
