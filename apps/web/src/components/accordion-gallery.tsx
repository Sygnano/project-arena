"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "cn";

export interface AccordionGalleryItem {
  key: string | number;
  /** Full-bleed image behind the panel, shown in every state. */
  imageUrl: string;
  label: string;
  /** Rendered over the image in the expanded panel only. Laid out at the
   * expanded width regardless of the panel's current width (see
   * `expandedWidth` below), so it never reflows mid-animation. */
  content?: ReactNode;
  /** Small node beside the expanded panel's label — e.g. a crest or icon. */
  badge?: ReactNode;
}

export interface AccordionGalleryProps {
  items: readonly AccordionGalleryItem[];
  defaultIndex?: number;
  /** Share of the available width the expanded panel takes, 0.2-0.9. The
   * remainder is split evenly between the collapsed panels. */
  expandRatio?: number;
  gap?: number;
  /** Peak y-rotation of a collapsed panel, in degrees. Panels before the
   * expanded one turn one way and panels after it the other, so the row reads
   * as folding away from the open panel. */
  tilt?: number;
  /** How far a collapsed panel's image drifts against its frame, as a
   * fraction of the image's width. Gives the fold a sense of depth rather
   * than looking like a cropped still. */
  parallax?: number;
  trigger?: "hover" | "click";
  /** `object-position` for the panel images. The default centres the crop;
   * pass something higher (e.g. `"50% 30%"`) for art whose subject sits above
   * the middle, such as character splash art. */
  imagePosition?: string;
  className?: string;
  /** Accessible name for the group. */
  ariaLabel: string;
}

/** Roughly GSAP's `power3.out` — a fast start that settles long and softly,
 * which is what keeps a width animation from reading as a snap. */
const EASE = [0.22, 1, 0.36, 1] as const;
const DURATION = 0.6;
/** The label's bar leads its text by this much, so the accent draws itself in
 * and the name follows rather than both appearing at once. */
const LABEL_STAGGER = 0.07;

/** The background image is rendered at a fixed pixel width — slightly wider
 * than the expanded panel — and centered, rather than at `width: 100%`.
 * Without it the image would squash and stretch as the panel's width
 * animates; at a fixed width the panel frame just crops more or less of a
 * stable image, which is what makes the fold read as physical.
 *
 * The overscan is only there to cover the parallax drift, which peaks well
 * under 10% of the media width, so it is kept small deliberately: anything
 * larger starts upscaling the source art past its native resolution for no
 * visual gain, which is what makes a panel background look like a blown-up
 * crop. */
const MEDIA_OVERSCAN = 1.06;
const MIN_MEDIA_WIDTH_PX = 180;

/**
 * An accordion gallery: a row of image panels where one is expanded and the
 * rest fold away from it, tilted in 3D, greyscale and dimmed. Hovering (or
 * clicking, per `trigger`) a collapsed panel expands it and collapses the
 * previous one.
 *
 * Built on Motion rather than GSAP — everything this animates (`flexGrow`,
 * `rotateY`, `x`, `opacity` and the greyscale/dim `filter`) is interpolable by
 * Motion, which the app already depends on for its other animated modules, so
 * there was no reason to add a second animation library for it.
 *
 * Two pieces of geometry are measured from the container rather than left to
 * CSS, both for the same reason — anything sized as a percentage of the panel
 * would reflow while the panel's own width is animating, which reads as
 * content squashing rather than a panel opening:
 * - the background image's width (see `MEDIA_OVERSCAN`), and
 * - `content`'s width, which is pinned to the expanded width so an opening
 *   panel wipes across already-laid-out content instead of reflowing it on
 *   every frame.
 */
export function AccordionGallery({
  items,
  defaultIndex = 0,
  expandRatio = 0.68,
  gap = 10,
  tilt = 9,
  parallax = 0.5,
  trigger = "hover",
  imagePosition = "center",
  className,
  ariaLabel,
}: AccordionGalleryProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [rootWidth, setRootWidth] = useState(0);
  const count = items.length;
  const [active, setActive] = useState(() =>
    Math.min(Math.max(defaultIndex, 0), Math.max(0, count - 1)),
  );

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new ResizeObserver(([entry]) =>
      setRootWidth(entry.contentRect.width),
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  const ratio = Math.min(Math.max(expandRatio, 0.2), 0.9);
  // `flex-grow` weights, not widths: with every panel on `flex-basis: 0`, a
  // panel's share is its own grow over the total, so the expanded panel needs
  // `grow / (grow + count - 1) === ratio`. Solving for grow gives this.
  const grow = count > 1 ? (ratio * (count - 1)) / (1 - ratio) : 1;

  const usableWidth = Math.max(0, rootWidth - gap * (count - 1));
  const expandedWidth = usableWidth * ratio;
  const mediaWidth = Math.max(
    MIN_MEDIA_WIDTH_PX,
    expandedWidth * MEDIA_OVERSCAN,
  );

  return (
    <div
      ref={rootRef}
      role="list"
      aria-label={ariaLabel}
      className={cn("flex h-full w-full min-w-0", className)}
      style={{
        gap,
        // The fold needs a perspective origin on the row itself — without it
        // `rotateY` is a flat horizontal squash with no depth to it.
        perspective: "1600px",
        perspectiveOrigin: "50% 50%",
      }}
    >
      {items.map((item, index) => {
        const isActive = index === active;
        // Panels on either side of the open one fold in opposite directions,
        // like a book opened at that page.
        const rotateY = isActive ? 0 : index < active ? tilt : -tilt;
        // Clamped so a panel far down the row doesn't drift its image clean
        // out of frame.
        const drift = Math.max(-1.5, Math.min(1.5, active - index));
        const mediaShift = isActive ? 0 : drift * parallax * mediaWidth * 0.06;

        return (
          <motion.div
            key={item.key}
            role="listitem"
            tabIndex={0}
            aria-current={isActive ? "true" : undefined}
            aria-label={item.label}
            onMouseEnter={() => trigger === "hover" && setActive(index)}
            onFocus={() => setActive(index)}
            onClick={() => setActive(index)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                event.preventDefault();
                setActive((index + 1) % count);
              } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                event.preventDefault();
                setActive((index - 1 + count) % count);
              }
            }}
            className={cn(
              "relative h-full min-w-0 cursor-pointer overflow-hidden outline-none",
              "focus-visible:ring-1 focus-visible:ring-[rgba(200,170,110,.65)]",
            )}
            style={{
              flexBasis: 0,
              transformStyle: "preserve-3d",
              transformOrigin: "center center",
              background: "var(--color-lol-navy-950)",
            }}
            initial={false}
            animate={{ flexGrow: isActive ? grow : 1, rotateY }}
            transition={{ duration: DURATION, ease: EASE }}
          >
            {/* Image layer. Centred by a static negative margin so Motion's
              `x` is free to carry the parallax drift on its own — animating a
              transform that also had to hold a -50% centring offset would
              mean re-deriving that offset on every keyframe. */}
            <motion.div
              className="pointer-events-none absolute top-0 h-full"
              style={{ left: "50%", width: mediaWidth, marginLeft: -mediaWidth / 2 }}
              initial={false}
              animate={{
                x: mediaShift,
                // Both ends declare the same filter function list, in the same
                // order — Motion can only interpolate a filter when the two
                // sides match function-for-function.
                filter: isActive
                  ? "grayscale(0) brightness(1)"
                  : "grayscale(1) brightness(0.62)",
              }}
              transition={{ duration: DURATION, ease: EASE }}
            >
              <img
                loading="lazy"
                decoding="async"
                src={item.imageUrl}
                alt=""
                draggable={false}
                className="h-full w-full object-cover select-none"
                style={{ objectPosition: imagePosition }}
              />
            </motion.div>

            {/* Scrims: a permanent bottom fade that keeps labels legible over
              bright art, plus a flat dim that lifts only on the open panel. */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, rgba(3,10,18,.2) 0%, rgba(3,10,18,0) 30%, rgba(3,10,18,.72) 78%, rgba(3,10,18,.96) 100%)",
              }}
            />
            <motion.div
              className="pointer-events-none absolute inset-0 bg-[#03060d]"
              initial={false}
              animate={{ opacity: isActive ? 0 : 0.45 }}
              transition={{ duration: DURATION, ease: EASE }}
            />

            {/* Collapsed identity: the name set vertically, reading bottom to
              top. `writing-mode` rather than a `rotate` transform so the text
              still occupies a real, measurable box — a rotated block would
              keep its horizontal footprint and overflow a narrow panel. */}
            <motion.div
              className="pointer-events-none absolute inset-x-0 bottom-7 flex justify-center"
              initial={false}
              animate={{ opacity: isActive ? 0 : 1 }}
              transition={{ duration: DURATION * 0.6, ease: EASE }}
            >
              <span
                className="font-display text-[17px] tracking-[.22em] whitespace-nowrap text-lol-gold-50"
                style={{
                  writingMode: "vertical-rl",
                  transform: "rotate(180deg)",
                  textShadow: "0 2px 12px rgba(0,0,0,.85)",
                }}
              >
                {item.label}
              </span>
            </motion.div>

            {/* Expanded content, pinned to the expanded width (see the
              component's doc comment). Hidden from assistive tech and from
              the pointer while collapsed, since it is then only a sliver of
              clipped content. */}
            <div
              className="absolute inset-y-0 left-0 flex flex-col"
              style={{ width: expandedWidth || undefined }}
              aria-hidden={!isActive}
              inert={!isActive}
            >
              <motion.div
                className="flex flex-none items-center gap-3.5 px-7 pt-6"
                initial={false}
                animate={{ opacity: isActive ? 1 : 0, x: isActive ? 0 : -14 }}
                transition={{
                  duration: isActive ? DURATION : DURATION * 0.6,
                  ease: EASE,
                  delay: isActive ? LABEL_STAGGER : 0,
                }}
              >
                {item.badge}
                <div
                  className="h-7 w-[3px] flex-none bg-lol-gold-300"
                  style={{ boxShadow: "0 0 12px rgba(200,170,110,.6)" }}
                />
                <div
                  className="font-display text-[26px] tracking-[.1em] whitespace-nowrap text-lol-gold-50"
                  style={{ textShadow: "0 2px 14px rgba(0,0,0,.8)" }}
                >
                  {item.label}
                </div>
              </motion.div>

              <motion.div
                className="flex min-h-0 flex-1 flex-col"
                initial={false}
                animate={{ opacity: isActive ? 1 : 0, y: isActive ? 0 : 10 }}
                transition={{
                  duration: isActive ? DURATION : DURATION * 0.5,
                  ease: EASE,
                  delay: isActive ? LABEL_STAGGER * 2 : 0,
                }}
              >
                {item.content}
              </motion.div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
