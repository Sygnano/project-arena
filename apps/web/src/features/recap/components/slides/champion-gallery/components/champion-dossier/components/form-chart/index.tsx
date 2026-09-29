"use client";

import { useRef, useState, useEffect } from "react";
import { useReducedMotion, motion } from "motion/react";
import type { ChampionFormStats } from "@arena/types";
import { ordinal } from "@/utils/format";
import { TIER_STYLE } from "@/utils/tier-bars";
import { FORM_PAD_PX, FORM_PAD_X_PX, FORM_STEP_PX } from "./constants";
import { streakCaption } from "./utils";

/** Every game on this champion as a placement line, oldest on the left:
 * 1st at the top, the worst place any tracked match reached at the bottom,
 * a dashed rule marking where a win (top 3) ends. Each game gets a fixed
 * step, so a long history scrolls sideways; it opens scrolled to the newest
 * games. The line draws itself in and each game's tier diamond pops in
 * after it. The plot fills whatever height its cell has — it sits in an
 * absolutely positioned scroller so its own height never feeds back into
 * the row's. */
function FormChart({ form, maxPlacement }: { form: ChampionFormStats; maxPlacement: number }) {
  const reduceMotion = useReducedMotion();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const measure = () => setSize({ width: scroller.clientWidth, height: scroller.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, []);

  const games = [...form.games].reverse();
  const width = Math.max(size.width, FORM_PAD_X_PX * 2 + (games.length - 1) * FORM_STEP_PX);
  const height = size.height;
  const worst = Math.max(2, maxPlacement);

  // Open on the newest games once the plot has a real width.
  const opened = useRef(false);
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || size.width === 0 || opened.current) return;
    opened.current = true;
    scroller.scrollLeft = scroller.scrollWidth;
  }, [size.width, width]);

  const x = (index: number) =>
    games.length === 1 ? width / 2 : FORM_PAD_X_PX + (index / (games.length - 1)) * (width - FORM_PAD_X_PX * 2);
  const y = (placement: number) =>
    FORM_PAD_PX + ((placement - 1) / (worst - 1)) * Math.max(0, height - FORM_PAD_PX * 2);
  const points = games.map((game, index) => `${x(index)},${y(game.placement)}`).join(" ");
  const caption = streakCaption(form);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative mt-1 min-h-12 flex-1">
        <div
          ref={scrollerRef}
          className="absolute inset-0 overflow-x-auto overflow-y-hidden [scrollbar-color:rgba(200,170,110,.35)_transparent] [scrollbar-width:thin]"
        >
          {size.width > 0 && height > 0 && games.length > 0 ? (
            <div className="relative" style={{ width, height }}>
              {worst > 3 ? (
                <div
                  className="absolute inset-x-0 border-t border-dashed border-[rgba(200,170,110,.22)]"
                  style={{ top: (y(3) + y(4)) / 2 }}
                />
              ) : null}
              <svg className="absolute inset-0 overflow-visible" width={width} height={height} aria-hidden>
                <motion.polyline
                  points={points}
                  fill="none"
                  stroke="rgba(200,170,110,.5)"
                  strokeWidth={1.25}
                  strokeLinejoin="round"
                  initial={reduceMotion ? false : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.9, ease: "easeOut" }}
                />
              </svg>
              {games.map((game, index) => {
                const tier = TIER_STYLE[game.placement === 1 ? "prismatic" : game.placement <= 3 ? "gold" : "silver"];
                const newest = index === games.length - 1;
                return (
                  <motion.div
                    key={`${game.playedAt}-${index}`}
                    className="absolute h-2.5 w-2.5"
                    style={{ left: x(index) - 5, top: y(game.placement) - 5 }}
                    initial={reduceMotion ? false : { scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{
                      delay: 0.9 * (index / Math.max(1, games.length - 1)),
                      type: "spring",
                      stiffness: 420,
                      damping: 18,
                    }}
                    title={`${ordinal(game.placement)} · ${game.kills}/${game.deaths}/${game.assists} · ${new Date(game.playedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
                  >
                    <div
                      className={`h-full w-full rotate-45 ${tier.fillClass}`}
                      style={
                        newest
                          ? { boxShadow: tier.glow, outline: `1px solid ${tier.edge}`, outlineOffset: 2 }
                          : undefined
                      }
                    />
                  </motion.div>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
      {/* Wraps onto two lines in a narrow column rather than truncating. */}
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3 text-[11px] tracking-[.14em]">
        <span style={{ color: caption.color }}>{caption.text}</span>
        {form.longestWinStreak > 1 ? (
          <span className="text-lol-text-muted">BEST STREAK {form.longestWinStreak}</span>
        ) : null}
      </div>
    </div>
  );
}

export { FormChart };
