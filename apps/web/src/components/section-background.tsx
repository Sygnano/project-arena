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
  return (
    <>
      <div
        className="absolute -inset-10"
        style={{
          backgroundImage: `url(${imageUrl})`,
          backgroundPosition,
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
          filter: "blur(16px) saturate(.55) brightness(.34) contrast(1.05)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 40%, rgba(5,14,22,.62) 0%, rgba(3,9,16,.9) 62%, #02070c 100%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(9,20,40,.55), rgba(2,7,12,.2) 40%, rgba(2,7,12,.85))",
        }}
      />
    </>
  );
}

export { SectionBackground };
