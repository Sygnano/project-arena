"use client";

import { cn } from "cn";
import { motion } from "motion/react";
import { Appear } from "@/components/appear";
import type { MultikillHeroes } from "@/features/recap/components/story-slides/combat/types";
import { useChampionName } from "@/features/recap/stores/champion-names";
import { championIconUrl } from "@/utils/riot";

type Props = {
  heroes: MultikillHeroes | null;
  delay?: number;
};

/** Champions shown in the banner; more are summed into "+N". */
const MAX_AVATARS = 6;

/**
 * The season's pentakills, shown off: the count, big, in prismatic, and the
 * champion who scored each, avatars popping in one by one. Quadrakills in
 * gold when there's no penta yet, a quiet line when there's neither.
 */
function MultikillBanner({ heroes, delay = 1.5 }: Props) {
  const championName = useChampionName();
  if (!heroes) {
    return (
      <Appear delay={delay}>
        <p className="text-[15px] text-lol-text-muted">No pentakill yet. Next season is the one.</p>
      </Appear>
    );
  }
  const penta = heroes.kind === "PENTAKILL";
  const shown = heroes.champions.slice(0, MAX_AVATARS);
  const hidden = heroes.champions.length - shown.length;

  return (
    <Appear delay={delay}>
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-[clamp(16px,3vw,40px)] gap-y-3 border px-[clamp(14px,2.5vw,28px)] py-[clamp(10px,1.8vh,18px)]",
          penta
            ? "border-[rgba(201,169,228,.7)] bg-[linear-gradient(100deg,rgba(185,138,221,.22),rgba(159,189,232,.08))] shadow-[0_0_48px_rgba(185,138,221,.3)]"
            : "border-[rgba(200,155,60,.55)] bg-[linear-gradient(100deg,rgba(200,155,60,.18),transparent)]",
        )}
      >
        <div className="flex items-baseline gap-3">
          <span
            className={cn(
              "font-display text-[clamp(40px,min(6vw,9vh),72px)] leading-none",
              penta
                ? "bg-[linear-gradient(120deg,#f0b8dc,#c9a0ec_40%,#9fc4ef_75%,#a8e0cf)] bg-clip-text text-transparent"
                : "text-[#e6c27a]",
            )}
          >
            {heroes.total}
          </span>
          <span className="font-display text-[clamp(16px,2vw,26px)] tracking-[.14em] text-lol-gold-50">
            {heroes.kind}
            {heroes.total === 1 ? "" : "S"}
            {penta ? "!" : ""}
          </span>
        </div>
        <ul className="flex flex-wrap gap-[clamp(10px,1.6vw,20px)]">
          {shown.map((hero, i) => (
            <motion.li
              key={hero.championName}
              className="flex flex-col items-center"
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: delay + 0.3 + i * 0.15, type: "spring", stiffness: 260, damping: 16 }}
            >
              <span className="relative">
                <img
                  src={championIconUrl(hero.championName)}
                  alt=""
                  width={64}
                  height={64}
                  className={cn(
                    "size-[clamp(44px,7vh,64px)] rounded-full border-2 object-cover",
                    penta ? "border-[#d9b8f0] shadow-[0_0_18px_rgba(185,138,221,.6)]" : "border-[#d4ab62]",
                  )}
                />
                {hero.count > 1 ? (
                  <span className="absolute -right-1.5 -bottom-1 rounded-full bg-lol-navy-950 px-1.5 text-[11px] text-lol-gold-50 ring-1 ring-lol-gold-300">
                    ×{hero.count}
                  </span>
                ) : null}
              </span>
              <span className="mt-1 max-w-20 truncate text-[11px] text-lol-text-secondary">
                {championName(hero.championName)}
              </span>
            </motion.li>
          ))}
          {hidden > 0 ? <li className="self-center text-sm text-lol-text-muted">+{hidden} more</li> : null}
        </ul>
      </div>
    </Appear>
  );
}

export { MultikillBanner };
