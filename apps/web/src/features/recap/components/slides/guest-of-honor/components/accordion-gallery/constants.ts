/** Roughly GSAP's `power3.out` — a fast start that settles long and softly,
 * which is what keeps a width animation from reading as a snap. */
const EASE = [0.22, 1, 0.36, 1] as const;

const DURATION = 0.6;

/** The label's bar leads its text by this much, so the accent draws itself in
 * and the name follows rather than both appearing at once. */
const LABEL_STAGGER = 0.07;

/** The background image is rendered at a fixed pixel width — slightly wider
 * than the expanded panel — and centered, rather than at `width: 100%`.
 * Without it the image would squash and stretch as the panel's width
 * animates; at a fixed width the panel frame just crops more or less of a
 * stable image, which is what makes the fold read as physical.
 *
 * The overscan is only there to cover the parallax drift, which peaks well
 * under 10% of the media width, so it is kept small deliberately: anything
 * larger starts upscaling the source art past its native resolution for no
 * visual gain, which is what makes a panel background look like a blown-up
 * crop. */
const MEDIA_OVERSCAN = 1.06;

const MIN_MEDIA_WIDTH_PX = 180;

export { EASE, DURATION, LABEL_STAGGER, MEDIA_OVERSCAN, MIN_MEDIA_WIDTH_PX };
