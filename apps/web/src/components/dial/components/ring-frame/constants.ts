/** The two known ring sizes in the design — 286px is the "standard" dial
 * (KDA, TimePlayed, Banned Champions), 262px is Champion Picks' identity
 * ring (sized down to leave room for the name block below it). Every other
 * number here (the hairline insets, the spinning arc's radius/dasharray)
 * is hand-tuned per size in the design rather than a clean scale of the
 * other, so both are stored verbatim instead of derived by formula. */
const RING_METRICS = {
  286: {
    outerInset: 32,
    innerInset: 20,
    r: 122,
    dashOuter: "144 622",
    dashInner: "38 728",
    dashInnerOffset: "-290",
  },
  262: {
    outerInset: 22,
    innerInset: 10,
    r: 112,
    dashOuter: "132 572",
    dashInner: "34 670",
    dashInnerOffset: "-266",
  },
} as const;

export { RING_METRICS };
