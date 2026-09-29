import type { Transition, Variants } from "motion/react";

/** How a story slide comes in. `custom` is the direction (1 forward, -1
 * back), so going back plays each entrance mirrored. */
type StoryTransition = "slide" | "rise" | "zoom" | "iris" | "tilt" | "wipe";

const EASE: Transition = { duration: 0.75, ease: [0.7, 0, 0.2, 1] };

/** The slide going out sinks back while the next one covers it, so reveals
 * (iris, wipe) never uncover an empty screen. */
const RECEDE: Variants["exit"] = { scale: 0.94, opacity: 0.35, transition: { duration: 0.75, ease: "easeIn" } };

const TRANSITIONS: Record<StoryTransition, Variants> = {
  slide: {
    enter: (direction: number) => ({ x: `${direction * 100}%` }),
    center: { x: 0, transition: EASE },
    exit: (direction: number) => ({ x: `${direction * -30}%`, opacity: 0.2, transition: EASE }),
  },
  rise: {
    enter: (direction: number) => ({ y: `${direction * 100}%` }),
    center: { y: 0, transition: EASE },
    exit: RECEDE,
  },
  zoom: {
    enter: { scale: 1.35, opacity: 0 },
    center: { scale: 1, opacity: 1, transition: { duration: 0.8, ease: [0.2, 0.7, 0.2, 1] } },
    exit: { scale: 0.8, opacity: 0, transition: { duration: 0.5 } },
  },
  iris: {
    enter: { clipPath: "circle(0% at 50% 50%)" },
    center: { clipPath: "circle(75% at 50% 50%)", transition: { duration: 0.9, ease: [0.6, 0, 0.3, 1] } },
    exit: RECEDE,
  },
  tilt: {
    enter: (direction: number) => ({ x: `${direction * 70}%`, rotate: direction * 7, opacity: 0 }),
    center: { x: 0, rotate: 0, opacity: 1, transition: EASE },
    exit: (direction: number) => ({ x: `${direction * -70}%`, rotate: direction * -7, opacity: 0, transition: EASE }),
  },
  wipe: {
    enter: (direction: number) => ({ clipPath: direction > 0 ? "inset(0% 0% 100% 0%)" : "inset(100% 0% 0% 0%)" }),
    center: { clipPath: "inset(0% 0% 0% 0%)", transition: { duration: 0.85, ease: [0.7, 0, 0.2, 1] } },
    exit: RECEDE,
  },
};

/** Under reduced motion every slide just cross-fades. */
const FADE: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1, transition: { duration: 0.4 } },
  exit: { opacity: 0, transition: { duration: 0.4 } },
};

/** A press held this long pauses the story instead of counting as a tap. */
const HOLD_MS = 220;

/** Taps on this share of the screen's width, from the left, go back. */
const BACK_ZONE = 0.3;

export { TRANSITIONS, FADE, HOLD_MS, BACK_ZONE };
export type { StoryTransition };
