"use client";

import {
  type ReactNode,
  useRef,
  useState,
  useEffect,
  useCallback,
  useLayoutEffect,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { cn } from "cn";
import {
  ARRIVE_EPSILON,
  CARDS_PER_SIDE,
  CENTER_SCALE,
  DEPTH_PER_CARD_PX,
  DIM_FALLOFF_CARDS,
  DIRECTIONAL_BIAS,
  DRAG_THRESHOLD_PX,
  FAN_STEP_RATIO,
  FAR_BRIGHTNESS,
  FAR_SATURATION,
  FLICK_TAU_MS,
  HEIGHT_FILL,
  KEY_TAU_MS,
  MAX_DEPTH_PX,
  MAX_ROTATE_Y_DEG,
  MAX_WIDTH_SHARE,
  MIN_FLICK_VELOCITY,
  OPACITY_CURVE,
  PERSPECTIVE_PX,
  ROTATE_FALLOFF_CARDS,
  SCALE_DECAY,
  SETTLE_DELAY_MS,
  VELOCITY_WINDOW_MS,
  WHEEL_SPEED,
  WHEEL_TAU_MS,
} from "./constants";
import { clamp, fanOffset, wheelDeltaToPixels } from "./utils";

interface CoverflowGalleryProps<T> {
  items: readonly T[];
  itemKey: (item: T, index: number) => string | number;
  renderItem: (item: T, index: number) => ReactNode;
  /** Card width/height ratio. Cards are sized to fill the gallery's own
   * height (capped by its width, see `MAX_WIDTH_SHARE`), so the gallery must
   * be given a definite height by its parent. */
  itemAspectRatio: number;
  /** Index to keep centered. Changing it glides there; the initial value is
   * positioned without animation on mount. */
  centeredIndex?: number;
  /** Fired when the card nearest the center changes, so a caller can keep
   * `centeredIndex` in sync with a free scroll. */
  onCenteredIndexChange?: (index: number) => void;
  onActivate?: (index: number) => void;
  className?: string;
  /** Accessible name for the listbox the cards live in. */
  label: string;
  /** Text to match when the user types while the gallery has focus
   * (listbox typeahead): typing "yo" glides to the first item starting with
   * "yo". Omit to disable. */
  itemText?: (item: T) => string;
}

/**
 * A horizontally browsable "pack of cards" gallery. The card nearest the
 * center renders flat, full-size and fully colored; cards to either side
 * shrink, dim, desaturate, turn slightly away and bunch progressively closer
 * together, so each end of the row reads as a stacked deck rather than an
 * evenly spaced filmstrip. A wheel gesture over the gallery moves it, and it
 * can also be dragged/swiped, both with momentum.
 *
 * **Nothing here uses the browser's own scrolling.** The position is a
 * fractional card index held in a ref, and every card is stacked in the same
 * grid cell and translated arithmetically from it. An earlier version drove
 * a native `overflow` scroller, which had three problems: native scroll-snap
 * fought wheel gestures; the scroller's real maximum `scrollLeft` (flex
 * container + end padding) came out shorter than the arithmetic one, so the
 * last cards could never be centered; and `overflow: hidden` clipped the
 * card frames' glow. Every input only moves a *target*; one rAF loop glides
 * the position toward it with a frame-rate-independent exponential approach.
 *
 * The per-card transforms are written imperatively rather than through React
 * state — the position changes at display rate and this gallery can hold
 * 100+ cards, so re-rendering the tree per frame would drop frames.
 *
 * The wheel listener is attached natively (React's `onWheel` is passive, so
 * it cannot `preventDefault`). It consumes wheel events while there is a card
 * to move to, so browsing doesn't scroll the page out from under the reader,
 * and releases a vertical wheel at either end of the deck so the page can
 * still be scrolled past the gallery.
 */
function CoverflowGallery<T>({
  items,
  itemKey,
  renderItem,
  itemAspectRatio,
  centeredIndex,
  onCenteredIndexChange,
  onActivate,
  className,
  label,
  itemText,
}: CoverflowGalleryProps<T>) {
  const typeaheadRef = useRef({ query: "", at: 0 });
  const containerRef = useRef<HTMLUListElement>(null);
  const cardRefs = useRef<(HTMLLIElement | null)[]>([]);

  /** Card width in px, derived from the container's measured box. `null`
   * until the first measurement, during which cards stay hidden. */
  const [itemWidth, setItemWidth] = useState<number | null>(null);

  /** Current and target position, in fractional card indices. */
  const initialPos = clamp(centeredIndex ?? 0, 0, Math.max(0, items.length - 1));
  const posRef = useRef(initialPos);
  const targetRef = useRef(initialPos);
  const tauRef = useRef(KEY_TAU_MS);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const settleTimerRef = useRef<number | null>(null);
  const wheelDirectionRef = useRef(0);

  const lastIndex = Math.max(0, items.length - 1);
  const lastIndexRef = useRef(lastIndex);
  const stepPxRef = useRef(200);

  const reportedIndexRef = useRef<number | null>(null);
  const onCenteredIndexChangeRef = useRef(onCenteredIndexChange);
  const onActivateRef = useRef(onActivate);
  useEffect(() => {
    onCenteredIndexChangeRef.current = onCenteredIndexChange;
    onActivateRef.current = onActivate;
  }, [onCenteredIndexChange, onActivate]);

  /** Writes every card's fan transform for the current position. */
  const paint = useCallback(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pos = posRef.current;
    const step = stepPxRef.current;

    cardRefs.current.forEach((card, index) => {
      if (!card) return;

      // Signed distance from the center, in whole cards.
      const offset = index - pos;
      const n = Math.abs(offset);

      if (n > CARDS_PER_SIDE) {
        card.style.visibility = "hidden";
        return;
      }
      card.style.visibility = "visible";

      const translateX = Math.sign(offset) * fanOffset(n, step);
      const scale = CENTER_SCALE * SCALE_DECAY ** n;
      const rotateY = reduceMotion ? 0 : -Math.sign(offset) * MAX_ROTATE_Y_DEG * Math.min(n / ROTATE_FALLOFF_CARDS, 1);
      const translateZ = reduceMotion ? 0 : Math.max(MAX_DEPTH_PX, DEPTH_PER_CARD_PX * n);
      const dim = Math.min(n / DIM_FALLOFF_CARDS, 1);

      card.style.transform = `translate3d(${translateX}px, 0, ${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`;
      card.style.opacity = String(clamp(1 - (n / CARDS_PER_SIDE) ** OPACITY_CURVE, 0, 1));
      card.style.filter = `saturate(${1 + (FAR_SATURATION - 1) * dim}) brightness(${1 + (FAR_BRIGHTNESS - 1) * dim})`;
      // Nearer cards stack above farther ones.
      card.style.zIndex = String(Math.round(1000 - n * 10));
    });

    const nearestIndex = clamp(Math.round(pos), 0, lastIndexRef.current);
    if (reportedIndexRef.current !== nearestIndex) {
      reportedIndexRef.current = nearestIndex;
      onCenteredIndexChangeRef.current?.(nearestIndex);
    }
  }, []);

  const draggingRef = useRef(false);

  /** Glides the position toward `targetRef` until it arrives. */
  const runLoop = useCallback(() => {
    if (rafRef.current !== null) return;

    const frame = (now: number) => {
      rafRef.current = null;
      if (draggingRef.current) {
        lastFrameRef.current = null;
        return;
      }
      const dt = lastFrameRef.current === null ? 16 : Math.min(now - lastFrameRef.current, 64);
      lastFrameRef.current = now;

      const remaining = targetRef.current - posRef.current;
      if (Math.abs(remaining) < ARRIVE_EPSILON) {
        posRef.current = targetRef.current;
        lastFrameRef.current = null;
        paint();
        return;
      }
      posRef.current += remaining * (1 - Math.exp(-dt / tauRef.current));
      paint();
      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);
  }, [paint]);

  const glideTo = useCallback(
    (target: number, tau: number) => {
      targetRef.current = clamp(target, 0, lastIndexRef.current);
      tauRef.current = tau;
      runLoop();
    },
    [runLoop],
  );

  // Size the cards to the container: fill its height, capped by its width.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = () => {
      const { clientWidth, clientHeight } = container;
      if (clientWidth === 0 || clientHeight === 0) return;
      const byHeight = ((clientHeight * HEIGHT_FILL) / CENTER_SCALE) * itemAspectRatio;
      const byWidth = clientWidth * MAX_WIDTH_SHARE;
      const width = Math.floor(Math.min(byHeight, byWidth));
      stepPxRef.current = width * FAN_STEP_RATIO;
      setItemWidth(width);
      paint();
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [itemAspectRatio, paint]);

  // Repaint before the browser shows a frame whenever the card set or size
  // changes, so cards are never visible untransformed.
  useLayoutEffect(() => {
    lastIndexRef.current = lastIndex;
    cardRefs.current.length = items.length;
    posRef.current = clamp(posRef.current, 0, lastIndex);
    targetRef.current = clamp(targetRef.current, 0, lastIndex);
    paint();
  }, [items, lastIndex, itemWidth, paint]);

  // Glide to a `centeredIndex` the caller changed. Skipped when that card is
  // already the centered one, so every index the user moves PAST isn't
  // echoed back as a competing animation.
  useEffect(() => {
    if (centeredIndex == null) return;
    if (reportedIndexRef.current === centeredIndex) return;
    glideTo(centeredIndex, KEY_TAU_MS);
  }, [centeredIndex, glideTo]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function onWheel(event: WheelEvent) {
      if (draggingRef.current) {
        event.preventDefault();
        return;
      }

      // A genuine horizontal gesture (shift-wheel, trackpad swipe) reports on
      // deltaX; fold either axis into the same target.
      const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);
      const px = wheelDeltaToPixels(horizontal ? event.deltaX : event.deltaY, event.deltaMode);
      if (px === 0) return;

      // A vertical wheel with no card left in that direction belongs to the
      // page: release it so the reader can scroll on past the gallery.
      // (Consuming every wheel event used to trap page scrolling whenever
      // the pointer sat over the deck, which is most of the section.)
      const atStart = targetRef.current <= 0 && px < 0;
      const atEnd = targetRef.current >= lastIndexRef.current && px > 0;
      if (!horizontal && (atStart || atEnd)) return;
      event.preventDefault();
      wheelDirectionRef.current = Math.sign(px);

      glideTo(targetRef.current + (px * WHEEL_SPEED) / stepPxRef.current, WHEEL_TAU_MS);

      if (settleTimerRef.current !== null) {
        window.clearTimeout(settleTimerRef.current);
      }
      settleTimerRef.current = window.setTimeout(() => {
        settleTimerRef.current = null;
        targetRef.current = clamp(
          Math.round(targetRef.current + wheelDirectionRef.current * DIRECTIONAL_BIAS),
          0,
          lastIndexRef.current,
        );
        runLoop();
      }, SETTLE_DELAY_MS);
    }

    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, [glideTo, runLoop]);

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (settleTimerRef.current !== null) {
        window.clearTimeout(settleTimerRef.current);
      }
    },
    [],
  );

  /* ---------------- drag / swipe / click ---------------- */

  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startPos: number;
    /** Index of the card the press started on, for click activation. */
    pressedIndex: number | null;
    moved: boolean;
    samples: { t: number; pos: number }[];
  } | null>(null);

  function onPointerDown(event: ReactPointerEvent<HTMLUListElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    const cardEl = (event.target as HTMLElement).closest<HTMLElement>("[data-coverflow-index]");
    const pressedIndex = cardEl ? Number(cardEl.dataset.coverflowIndex) : null;

    // Grab the gallery mid-glide: freeze where it is.
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastFrameRef.current = null;
    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
    targetRef.current = posRef.current;

    draggingRef.current = true;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startPos: posRef.current,
      pressedIndex,
      moved: false,
      samples: [{ t: event.timeStamp, pos: posRef.current }],
    };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLUListElement>) {
    const drag = dragRef.current;
    const container = containerRef.current;
    if (!drag || !container || drag.pointerId !== event.pointerId) return;

    const dx = event.clientX - drag.startX;
    if (!drag.moved) {
      if (Math.abs(dx) <= DRAG_THRESHOLD_PX) return;
      // Captured only once it is really a drag: capturing on press would
      // retarget the eventual `click` to the container and swallow it.
      drag.moved = true;
      container.setPointerCapture(event.pointerId);
    }

    // Soft rubber band past either end rather than a hard wall.
    const raw = drag.startPos - dx / stepPxRef.current;
    const max = lastIndexRef.current;
    const pos = raw < 0 ? raw * 0.3 : raw > max ? max + (raw - max) * 0.3 : raw;

    posRef.current = pos;
    targetRef.current = pos;
    drag.samples.push({ t: event.timeStamp, pos });
    while (drag.samples.length > 2 && event.timeStamp - drag.samples[0].t > VELOCITY_WINDOW_MS) {
      drag.samples.shift();
    }
    paint();
  }

  function endDrag(event: ReactPointerEvent<HTMLUListElement>, cancelled: boolean) {
    const drag = dragRef.current;
    const container = containerRef.current;
    if (!drag || !container || drag.pointerId !== event.pointerId) return;

    if (container.hasPointerCapture(event.pointerId)) {
      container.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    draggingRef.current = false;

    if (!drag.moved) {
      if (!cancelled && drag.pressedIndex !== null) {
        onActivateRef.current?.(drag.pressedIndex);
      }
      runLoop();
      return;
    }

    // Release velocity over the recent window, in cards/ms (scroll direction).
    const first = drag.samples[0];
    const last = drag.samples[drag.samples.length - 1];
    const heldStill = event.timeStamp - last.t > VELOCITY_WINDOW_MS;
    const span = last.t - first.t;
    const velocity = heldStill || span <= 0 ? 0 : (last.pos - first.pos) / span;

    // Ride the gesture: project where its momentum would carry it, then land
    // on a card, leaning in the direction of travel so it never slides back.
    const projected = posRef.current + velocity * FLICK_TAU_MS;
    const bias = Math.abs(velocity) > MIN_FLICK_VELOCITY ? Math.sign(velocity) * DIRECTIONAL_BIAS : 0;
    glideTo(Math.round(projected + bias), FLICK_TAU_MS);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLUListElement>) {
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      glideTo(event.key === "Home" ? 0 : lastIndexRef.current, KEY_TAU_MS);
    } else if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      glideTo(Math.round(targetRef.current) + direction, KEY_TAU_MS);
    } else if (
      itemText &&
      event.key.length === 1 &&
      event.key !== " " &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      // Typeahead: keys typed within 700 ms extend the query.
      const now = performance.now();
      const typeahead = typeaheadRef.current;
      typeahead.query = (now - typeahead.at < 700 ? typeahead.query : "") + event.key.toLowerCase();
      typeahead.at = now;
      const match = items.findIndex((item) => itemText(item).toLowerCase().startsWith(typeahead.query));
      if (match >= 0) {
        event.preventDefault();
        glideTo(match, KEY_TAU_MS);
      }
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (reportedIndexRef.current != null) {
        onActivateRef.current?.(reportedIndexRef.current);
      }
    }
  }

  return (
    <ul
      ref={containerRef}
      role="listbox"
      aria-label={label}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => endDrag(event, false)}
      onPointerCancel={(event) => endDrag(event, true)}
      className={cn(
        "grid h-full min-h-0 w-full cursor-grab place-items-center outline-none active:cursor-grabbing",
        "focus-visible:ring-1 focus-visible:ring-[rgba(200,170,110,.5)]",
        className,
      )}
      style={{
        gridTemplate: "minmax(0, 1fr) / minmax(0, 1fr)",
        // The fan's rotation needs a perspective on the container itself —
        // without it `rotateY` is an affine squash with no depth at all.
        perspective: `${PERSPECTIVE_PX}px`,
        perspectiveOrigin: "50% 50%",
        // Horizontal drags are ours; vertical ones still scroll the page.
        touchAction: "pan-y",
        userSelect: "none",
      }}
    >
      {items.map((item, index) => (
        <li
          key={itemKey(item, index)}
          ref={(node) => {
            cardRefs.current[index] = node;
          }}
          role="option"
          aria-selected={centeredIndex === index}
          data-coverflow-index={index}
          className="coverflow-card relative"
          style={{
            // Every card shares the one grid cell; `paint` fans them out.
            gridArea: "1 / 1",
            width: itemWidth ?? 0,
            visibility: itemWidth === null ? "hidden" : undefined,
            transformStyle: "preserve-3d",
            backfaceVisibility: "hidden",
          }}
          // The native image drag would hijack the pointer gesture.
          onDragStart={(event) => event.preventDefault()}
        >
          {renderItem(item, index)}
        </li>
      ))}
    </ul>
  );
}

export { CoverflowGallery };
export type { CoverflowGalleryProps };
