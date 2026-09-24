"use client";

import { useNearViewport } from "@/hooks/use-near-viewport";

type Props = {
  imageUrl: string;
  /** CSS `background-position` for the photo layer. Default `"center 38%"`
   * matches the design handoff's own KDA-section framing — tune per image
   * if a future section's photo needs a different focal point. */
  backgroundPosition?: string;
};

/**
 * The three-layer "blurred arena photo behind glass" background stack from
 * the Claude Design handoff (`design_handoff_arena_kda/README.md`,
 * "Background stack") — a blurred/darkened photo, a radial vignette, and a
 * vertical tint, layered bottom-to-top. First used by the KDA section; the
 * design calls for the same full-bleed Hextech treatment on the sections
 * that follow it (Damage, Champions, Items, Match history), so this is
 * factored out rather than copy-pasted per section.
 *
 * Render as the first children of a `position:relative` (and typically
 * `overflow:hidden`) section — these three divs are all `position:absolute`
 * and paint on top of whatever's already there. The design's 4th layer
 * ("base fill behind everything", `#050e16`) isn't duplicated here: give
 * the section itself that background color (`bg-lol-navy-950`) so it shows
 * through before the photo loads and beyond the photo's `-inset-10` bleed.
 */
function SectionBackground({ imageUrl, backgroundPosition = "center 38%" }: Props) {
  // The photo is only attached once the section is within about a screen of
  // view, so the page doesn't download every section's art up front. Until
  // then the section's own dark fill shows, which is what a slow image load
  // looked like anyway.
  const [ref, isNear] = useNearViewport<HTMLDivElement>();
  return (
    <>
      <div
        ref={ref}
        aria-hidden
        className="absolute -inset-10"
        style={{
          backgroundImage: isNear ? `url(${imageUrl})` : undefined,
          backgroundPosition,
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
          filter: "blur(16px) saturate(.62) brightness(.42) contrast(1.05)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(120% 90% at 50% 40%, rgba(5,14,22,.5) 0%, rgba(3,9,16,.85) 62%, #02070c 100%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(180deg, rgba(9,20,40,.55), rgba(2,7,12,.2) 40%, rgba(2,7,12,.85))",
        }}
      />
      <SectionEdgeFade />
    </>
  );
}

/** Solid color every section's top and bottom edges fade into. */
const SECTION_EDGE_COLOR = "#02070c";

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

export { SectionBackground, SectionEdgeFade };
