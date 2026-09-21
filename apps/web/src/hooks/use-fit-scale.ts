import { useEffect, useRef, useState } from "react";

type Options = {
  /** Never scale below this, however tight the box gets — past a point the
   * content stops being readable and an unreadable fit is worse than a
   * slightly clipped one. */
  minScale?: number;
};

/**
 * Shrinks a naturally-sized block until it fits the box it sits in, by
 * measuring both and applying a uniform `transform: scale()`.
 *
 * This is the generic form of the rule every deck-mode section follows: a
 * section that is too tall for the viewport scales its content down, it never
 * grows an inner scrollbar (see `SpecialItems`, which does the same thing with
 * `clamp()` on a handful of hand-picked sizes). `clamp()` only works when the
 * content's height is known up front; use this instead when the block's height
 * depends on data — e.g. a champion's augment set, which is anywhere from one
 * card to a 3x3 grid, wrapped at whatever width the panel happens to have.
 *
 * The transform doesn't feed back into layout: `offsetWidth`/`offsetHeight`
 * report the inner element's own layout box, which a transform leaves alone,
 * so re-measuring after scaling yields the same numbers and the observer
 * settles immediately.
 */
export function useFitScale<
  O extends HTMLElement,
  I extends HTMLElement,
>({ minScale = 0.55 }: Options = {}) {
  const outerRef = useRef<O>(null);
  const innerRef = useRef<I>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const measure = () => {
      const style = getComputedStyle(outer);
      const availableWidth =
        outer.clientWidth -
        parseFloat(style.paddingLeft) -
        parseFloat(style.paddingRight);
      const availableHeight =
        outer.clientHeight -
        parseFloat(style.paddingTop) -
        parseFloat(style.paddingBottom);
      const width = inner.offsetWidth;
      const height = inner.offsetHeight;
      if (availableWidth <= 0 || availableHeight <= 0 || !width || !height) {
        return;
      }
      const next = Math.min(
        1,
        availableWidth / width,
        availableHeight / height,
      );
      // Rounded so sub-pixel measurement jitter doesn't churn React state.
      setScale(Math.max(minScale, Math.floor(next * 1000) / 1000));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(outer);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [minScale]);

  return { outerRef, innerRef, scale };
}
