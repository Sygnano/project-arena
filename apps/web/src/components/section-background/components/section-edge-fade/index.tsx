"use client";

import { SECTION_EDGE_COLOR } from "./constants";

/**
 * Fades a section's top and bottom edges into the same solid color, so two
 * adjacent scroll-snap sections meet on identical pixels. Without it, each
 * section's photo and tint end abruptly and the boundary shows up as a hard
 * seam mid-scroll; with it, scrolling reads as a fade through dark.
 * Render after the other background layers and before the content. Also
 * used by the bespoke `Welcome`/`Farewell`/`ThankYou` screens, which carry
 * their own background stack.
 */
function SectionEdgeFade() {
  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{
        background: `linear-gradient(180deg, ${SECTION_EDGE_COLOR} 0%, transparent 16%, transparent 84%, ${SECTION_EDGE_COLOR} 100%)`,
      }}
    />
  );
}

export { SectionEdgeFade };
