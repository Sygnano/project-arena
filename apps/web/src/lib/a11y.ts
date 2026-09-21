import type { KeyboardEvent } from "react";

/**
 * Props that make a non-button element (a chart column, a table row) behave
 * like a button for keyboard and assistive-technology users: focusable,
 * announced as a button, activated by Enter or Space.
 *
 * Prefer a real `<button>` wherever the markup allows one; this exists for
 * grid rows and absolutely-positioned chart parts where nesting a button
 * would break layout.
 */
export function pressable(onActivate: () => void, options?: { pressed?: boolean }) {
  return {
    role: "button" as const,
    tabIndex: 0,
    "aria-pressed": options?.pressed,
    onClick: onActivate,
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onActivate();
      }
    },
  };
}
