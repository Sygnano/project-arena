"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight, Pause, Play, X } from "lucide-react";
import { cn } from "cn";
import type { SummonerProfile } from "@arena/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { profileIconUrl } from "@/utils/riot";
import { StoryProgress } from "./components/story-progress";
import { FADE, TRANSITIONS } from "./constants";
import { usePageHidden, useStoryKeys, useTapAndHold } from "./hooks";
import type { StoryControls, StorySlide } from "./types";

type Props = {
  slides: StorySlide[];
  profile: SummonerProfile;
  /** Back to the cover. */
  onClose: () => void;
};

const ICON_BUTTON =
  "flex h-9 w-9 items-center justify-center border border-[rgba(200,170,110,.35)] bg-[rgba(1,5,10,.45)] text-lol-gold-100 backdrop-blur-sm transition-colors hover:border-lol-gold-300 hover:text-lol-gold-50";

/**
 * The story recap, Spotify Wrapped style: full-screen slides that play on
 * their own, each for its `durationMs`, with a progress bar per slide. Tap
 * the right of the screen (or →) to skip ahead, the left (or ←) to go back,
 * hold (or Space) to pause; it also waits while the tab is hidden. The last
 * slide stays until the reader picks what's next. Each slide enters with its
 * own `transition`, mirrored when going back.
 */
function StoryPlayer({ slides, profile, onClose }: Props) {
  const [[index, direction], setPosition] = useState<[number, number]>([0, 1]);
  const [pausedByUser, setPausedByUser] = useState(false);
  const hidden = usePageHidden();
  const reduceMotion = useReducedMotion();
  const dialogRef = useRef<HTMLDivElement>(null);

  const go = (target: number) => {
    const next = Math.max(0, Math.min(slides.length - 1, target));
    setPosition(([current]) => (next === current ? [current, 1] : [next, next > current ? 1 : -1]));
  };
  const next = () => go(index + 1);
  const previous = () => go(index - 1);
  const controls: StoryControls = {
    restart: () => {
      setPausedByUser(false);
      go(0);
    },
    close: onClose,
  };

  const [holding, pressHandlers] = useTapAndHold((back) => (back ? previous() : next()));
  useStoryKeys({ next, previous, togglePause: () => setPausedByUser((paused) => !paused), close: onClose });
  const paused = pausedByUser || holding || hidden;

  useEffect(() => dialogRef.current?.focus(), []);

  // The next slide's art starts loading while this one plays.
  const upcoming = slides[index + 1]?.background;
  useEffect(() => {
    if (!upcoming) return;
    const image = new Image();
    image.src = upcoming;
  }, [upcoming]);

  const slide = slides[index];
  const last = index === slides.length - 1;

  return (
    <motion.div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${profile.riotIdGameName}'s Arena season, story recap`}
      tabIndex={-1}
      className="fixed inset-0 z-[70] overflow-hidden bg-lol-black outline-none select-none"
      initial={{ opacity: 0, scale: 1.04 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.45, ease: [0.2, 0.7, 0.2, 1] }}
    >
      {/* The slides, one at a time; the outgoing one stays underneath while
          the next one's entrance covers it. */}
      <div className="absolute inset-0 touch-manipulation" {...pressHandlers}>
        <AnimatePresence initial={false} custom={direction}>
          <motion.div
            key={slide.id}
            className="absolute inset-0 will-change-transform"
            custom={direction}
            variants={reduceMotion ? FADE : TRANSITIONS[slide.transition]}
            initial="enter"
            animate="center"
            exit="exit"
          >
            {slide.render(controls)}
          </motion.div>
        </AnimatePresence>
      </div>

      <p aria-live="polite" className="sr-only-text">
        {`${slide.label}, ${index + 1} of ${slides.length}${pausedByUser ? ", paused" : ""}`}
      </p>

      {/* Progress and controls, over the slides. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 bg-[linear-gradient(180deg,rgba(1,5,10,.7),transparent)] px-3 pt-2 pb-6 sm:px-6 sm:pt-3">
        <div className="pointer-events-auto mx-auto max-w-6xl">
          <StoryProgress
            slides={slides}
            index={index}
            paused={paused}
            onElapsed={() => {
              if (!last) next();
            }}
            onSelect={go}
          />
          <div className="mt-2 flex items-center gap-3">
            <Avatar className="size-8 border border-[rgba(200,170,110,.5)]">
              {profile.profileIconId != null ? (
                <AvatarImage src={profileIconUrl(profile.profileIconId)} alt="" />
              ) : null}
              <AvatarFallback className="bg-lol-navy-800 font-display text-sm text-lol-gold-300">
                {profile.riotIdGameName.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 leading-tight">
              <div className="truncate font-display text-[15px] tracking-[.04em] text-lol-gold-50">
                {profile.riotIdGameName}
                <span className="ml-1.5 text-[12px] text-lol-text-muted">#{profile.riotIdTagline}</span>
              </div>
              <div className="text-[9.5px] tracking-[.3em] text-lol-text-muted">ARENA SEASON RECAP</div>
            </div>
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={() => setPausedByUser((value) => !value)}
                aria-label={pausedByUser ? "Play" : "Pause"}
                aria-pressed={pausedByUser}
                className={ICON_BUTTON}
              >
                {pausedByUser ? <Play aria-hidden className="h-4 w-4" /> : <Pause aria-hidden className="h-4 w-4" />}
              </button>
              <button type="button" onClick={onClose} aria-label="Close the story" className={ICON_BUTTON}>
                <X aria-hidden className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mouse users get visible arrows; touch has the tap zones. */}
      {index > 0 ? (
        <button
          type="button"
          onClick={previous}
          aria-label="Previous slide"
          className={cn(ICON_BUTTON, "absolute top-1/2 left-4 hidden h-12 w-12 -translate-y-1/2 pointer-fine:flex")}
        >
          <ChevronLeft aria-hidden className="h-5 w-5" />
        </button>
      ) : null}
      {!last ? (
        <button
          type="button"
          onClick={next}
          aria-label="Next slide"
          className={cn(ICON_BUTTON, "absolute top-1/2 right-4 hidden h-12 w-12 -translate-y-1/2 pointer-fine:flex")}
        >
          <ChevronRight aria-hidden className="h-5 w-5" />
        </button>
      ) : null}

      {pausedByUser && !last ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 text-center text-[11px] tracking-[.34em] text-lol-gold-100">
          PAUSED · PRESS SPACE OR ▶ TO RESUME
        </div>
      ) : null}
    </motion.div>
  );
}

export { StoryPlayer };
export type { StorySlide, StoryControls } from "./types";
export type { StoryTransition } from "./constants";
