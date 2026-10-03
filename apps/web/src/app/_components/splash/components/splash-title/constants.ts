/** Mirrors a right-half flourish onto the left of a 400-wide viewBox. */
const MIRROR = "matrix(-1 0 0 1 400 0)";

/** Lets a CSS rotation on an SVG group turn around the group's own center. */
const SPIN_IN_PLACE = "[transform-box:fill-box] origin-center";

const CYAN_GLOW = { filter: "drop-shadow(0 0 4px rgba(10,196,217,.9))" };

export { CYAN_GLOW, MIRROR, SPIN_IN_PLACE };
