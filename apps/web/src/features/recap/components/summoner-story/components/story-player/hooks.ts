import { type MouseEvent, type PointerEvent, useEffect, useRef, useState } from "react";
import { BACK_ZONE, HOLD_MS } from "./constants";

type KeyHandlers = {
  next: () => void;
  previous: () => void;
  togglePause: () => void;
  close: () => void;
};

/** Whether a key or press landed on a control that handles it itself. */
function isControl(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("a, button, input, select, textarea") !== null;
}

/**
 * Arrow keys (and Page Up/Down) step through the story, Space pauses and
 * Escape closes it. Space and Enter are left to a focused button or link.
 */
function useStoryKeys(handlers: KeyHandlers) {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
        case "PageDown":
          event.preventDefault();
          ref.current.next();
          break;
        case "ArrowLeft":
        case "ArrowUp":
        case "PageUp":
          event.preventDefault();
          ref.current.previous();
          break;
        case " ":
          if (isControl(event.target)) return;
          event.preventDefault();
          ref.current.togglePause();
          break;
        case "Escape":
          ref.current.close();
          break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}

/** True while the tab is in the background, so the story waits for the reader. */
function usePageHidden(): boolean {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const onChange = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);
  return hidden;
}

/**
 * Story-style pointer controls on the slide area: a quick tap on its left
 * part goes back, anywhere else goes forward; pressing and holding pauses
 * until release. Presses on links and buttons are left to them.
 */
function useTapAndHold(onTap: (back: boolean) => void) {
  const [holding, setHolding] = useState(false);
  const press = useRef<{ timer?: ReturnType<typeof setTimeout>; held: boolean } | null>(null);

  useEffect(() => () => clearTimeout(press.current?.timer), []);

  const end = () => {
    if (!press.current) return null;
    clearTimeout(press.current.timer);
    const held = press.current.held;
    press.current = null;
    setHolding(false);
    return held;
  };

  const handlers = {
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (event.button !== 0 || isControl(event.target)) return;
      const current: { timer?: ReturnType<typeof setTimeout>; held: boolean } = { held: false };
      current.timer = setTimeout(() => {
        current.held = true;
        setHolding(true);
      }, HOLD_MS);
      press.current = current;
    },
    onPointerUp: (event: PointerEvent<HTMLElement>) => {
      const held = end();
      if (held !== false) return;
      const box = event.currentTarget.getBoundingClientRect();
      onTap(event.clientX - box.left < box.width * BACK_ZONE);
    },
    onPointerCancel: () => void end(),
    onPointerLeave: () => void end(),
    // A long press would otherwise open the browser's context menu on touch.
    onContextMenu: (event: MouseEvent<HTMLElement>) => {
      if (!isControl(event.target)) event.preventDefault();
    },
  };

  return [holding, handlers] as const;
}

export { usePageHidden, useStoryKeys, useTapAndHold };
