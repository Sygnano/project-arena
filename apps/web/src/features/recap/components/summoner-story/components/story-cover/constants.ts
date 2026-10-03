/** Wheel or swipe distance (px) that starts the story. */
const START_WHEEL_PX = 12;
const START_SWIPE_PX = 40;

/** Right after the cover comes back (the story was closed), gestures are
 * ignored for this long: a trackpad's inertial scroll would restart it. */
const REARM_MS = 900;

export { REARM_MS, START_SWIPE_PX, START_WHEEL_PX };
