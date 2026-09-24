"use client";

import { useEffect, type RefObject } from "react";

const DRAG_THRESHOLD_PX = 4;
/** How far back to look when estimating release velocity — long enough to
 * smooth out per-event jitter, short enough that a drag that pauses before
 * release (common — people slow down before letting go) doesn't still fling. */
const VELOCITY_WINDOW_MS = 100;
/** px/ms. Below this a release doesn't coast at all — this is what makes a
 * slow, deliberate drag stop exactly where it's let go instead of drifting. */
const MIN_FLING_VELOCITY = 0.05;
/** Exponential decay rate (per ms) applied to the coast velocity each frame.
 * Tuned so a firm flick glides for a natural ~600-800ms, matching the coast
 * touch/trackpad scrolling already has elsewhere on the page. */
const FRICTION_PER_MS = 0.004;

/**
 * Click-and-drag-to-scroll for a container that already scrolls via
 * `overflow-x-auto`/`overflow-y-auto` — touch and trackpad already pan these
 * natively, but a desktop mouse has no built-in drag gesture, so charts and
 * stat-row lists wider/taller than their panel were only reachable via their
 * thin scrollbar. Only engages for mouse input and only once the pointer has
 * moved past a small threshold, so a plain click (selecting a bar, a row)
 * still fires normally — a drag past the threshold suppresses the click that
 * would otherwise follow the pointerup, so it doesn't also trigger selection.
 *
 * Releasing while moving coasts with momentum (a decaying velocity applied
 * every animation frame until it's negligible or the scroll hits its edge),
 * rather than stopping dead the instant the pointer lifts — skipped under
 * `prefers-reduced-motion`, same as the rest of the page's JS animation.
 *
 * The `drag-scrollable` class (globals.css) only applies once the container
 * actually overflows on `axis`, so the grab cursor doesn't show up on
 * content that already fits.
 */
function useDragScroll<T extends HTMLElement>(ref: RefObject<T | null>, axis: "x" | "y") {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let dragging = false;
    let dragged = false;
    let suppressClick = false;
    let startPos = 0;
    let startScroll = 0;
    let pointerId: number | null = null;
    let history: { t: number; p: number }[] = [];
    let momentumFrame: number | null = null;

    const pos = (e: PointerEvent) => (axis === "x" ? e.clientX : e.clientY);
    const scrollPos = () => (axis === "x" ? el.scrollLeft : el.scrollTop);
    const setScrollPos = (value: number) => {
      if (axis === "x") el.scrollLeft = value;
      else el.scrollTop = value;
    };
    const overflows = () => (axis === "x" ? el.scrollWidth > el.clientWidth : el.scrollHeight > el.clientHeight);

    const updateOverflowClass = () => {
      el.classList.toggle("drag-scrollable", overflows());
    };
    updateOverflowClass();
    const resizeObserver = new ResizeObserver(updateOverflowClass);
    resizeObserver.observe(el);
    if (el.firstElementChild) resizeObserver.observe(el.firstElementChild);

    const stopMomentum = () => {
      if (momentumFrame !== null) {
        cancelAnimationFrame(momentumFrame);
        momentumFrame = null;
      }
    };

    /** Velocity of `pos`, in px/ms, over the last `VELOCITY_WINDOW_MS` of
     * recorded samples — not just the last two, so a single jittery event
     * right before release can't dominate the estimate. */
    const releaseVelocity = () => {
      if (history.length < 2) return 0;
      const newest = history[history.length - 1];
      const oldest = history.find((s) => newest.t - s.t <= VELOCITY_WINDOW_MS)!;
      const dt = newest.t - oldest.t;
      return dt > 0 ? (newest.p - oldest.p) / dt : 0;
    };

    const runMomentum = (initialVelocity: number) => {
      // Scroll-space velocity is the inverse of pointer-space velocity: see
      // the `setScrollPos(startScroll - delta)` sign in onPointerMove below.
      let velocity = -initialVelocity;
      let last = performance.now();
      const step = (now: number) => {
        const dt = now - last;
        last = now;
        velocity *= Math.exp(-FRICTION_PER_MS * dt);
        if (Math.abs(velocity) < MIN_FLING_VELOCITY) {
          momentumFrame = null;
          return;
        }
        const before = scrollPos();
        setScrollPos(before + velocity * dt);
        // Hit a scroll boundary — the assignment above didn't move it.
        if (scrollPos() === before) {
          momentumFrame = null;
          return;
        }
        momentumFrame = requestAnimationFrame(step);
      };
      momentumFrame = requestAnimationFrame(step);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0 || !overflows()) return;
      stopMomentum();
      dragging = true;
      dragged = false;
      startPos = pos(e);
      startScroll = scrollPos();
      pointerId = e.pointerId;
      history = [{ t: performance.now(), p: startPos }];
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging || e.pointerId !== pointerId) return;
      const delta = pos(e) - startPos;
      if (!dragged && Math.abs(delta) > DRAG_THRESHOLD_PX) {
        dragged = true;
        el.setPointerCapture(e.pointerId);
        el.classList.add("is-drag-scrolling");
      }
      if (dragged) {
        e.preventDefault();
        setScrollPos(startScroll - delta);

        const now = performance.now();
        history.push({ t: now, p: pos(e) });
        while (history.length > 1 && now - history[0].t > VELOCITY_WINDOW_MS) {
          history.shift();
        }
      }
    };

    const endDrag = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      if (dragged) {
        if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
        el.classList.remove("is-drag-scrolling");
        suppressClick = true;
        const velocity = releaseVelocity();
        if (!reducedMotion && Math.abs(velocity) >= MIN_FLING_VELOCITY) {
          runMomentum(velocity);
        }
      }
      dragging = false;
      dragged = false;
      pointerId = null;
    };

    const onClickCapture = (e: MouseEvent) => {
      if (!suppressClick) return;
      suppressClick = false;
      e.preventDefault();
      e.stopPropagation();
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", endDrag);
    el.addEventListener("pointercancel", endDrag);
    el.addEventListener("click", onClickCapture, true);

    return () => {
      stopMomentum();
      resizeObserver.disconnect();
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", endDrag);
      el.removeEventListener("pointercancel", endDrag);
      el.removeEventListener("click", onClickCapture, true);
      el.classList.remove("drag-scrollable", "is-drag-scrolling");
    };
  }, [ref, axis]);
}

export { useDragScroll };
