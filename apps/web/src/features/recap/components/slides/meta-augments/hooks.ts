import { useRef, useState, useEffect } from "react";
import { CARD_GAP, CARD_HEIGHT, CARD_WIDTH, DECK_QUERY, GLOW_MARGIN } from "./constants";

/**
 * Scale factor that grows the row of cards until it hits either the width or
 * the height of the space it has — whichever comes first. Deck layout only:
 * in `flow` the panel's height follows its content, so there is no height
 * limit to measure against and the cards keep their designed size and wrap.
 * `null` until measured (server render keeps the CSS fallback).
 */
function useFitZoom<T extends HTMLElement>(count: number) {
  const ref = useRef<T>(null);
  const [zoom, setZoom] = useState<number | null>(null);

  useEffect(() => {
    const box = ref.current;
    if (!box || count === 0) return;
    const deck = window.matchMedia(DECK_QUERY);
    const measure = () => {
      if (!deck.matches) {
        setZoom(1);
        return;
      }
      const width = (box.clientWidth - 2 * GLOW_MARGIN - (count - 1) * CARD_GAP) / count;
      const byWidth = width / CARD_WIDTH;
      const byHeight = (box.clientHeight - 2 * GLOW_MARGIN) / CARD_HEIGHT;
      if (byWidth <= 0 || byHeight <= 0) return;
      setZoom(Math.floor(Math.min(byWidth, byHeight) * 100) / 100);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    deck.addEventListener("change", measure);
    return () => {
      observer.disconnect();
      deck.removeEventListener("change", measure);
    };
  }, [count]);

  return [ref, zoom] as const;
}

export { useFitZoom };
