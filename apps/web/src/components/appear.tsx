"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Seconds after mount before this block starts, for staggering a screen. */
  delay?: number;
  /** Where it comes from: a short lift (default), a slide from a side, or a
   * pop from smaller. */
  from?: "below" | "left" | "right" | "scale";
  className?: string;
};

const OFFSETS = {
  below: { y: 18 },
  left: { x: -28 },
  right: { x: 28 },
  scale: { scale: 0.8 },
} as const;

/**
 * Fades its content in once, on mount, from a small offset. Unlike `Reveal`
 * (which follows scroll position), this is for content that mounts exactly
 * when it should be seen: a story slide staggers its lines with `delay`.
 * Under reduced motion `MotionConfig` drops the movement and keeps the fade.
 */
function Appear({ children, delay = 0, from = "below", className }: Props) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, ...OFFSETS[from] }}
      animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      transition={{ duration: 0.6, delay, ease: [0.2, 0.7, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}

export { Appear };
