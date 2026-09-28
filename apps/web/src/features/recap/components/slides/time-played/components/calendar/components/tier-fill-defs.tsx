"use client";

import {
  GOLD_FILL_ID,
  PRISMATIC_FILL_ID,
  SILVER_FILL_ID,
} from "@/features/recap/components/slides/time-played/components/calendar/constants";

/** The tier cell fills. Gold and Silver bake `.tier-bar-gold`/`-silver`'s
 * metal ramp and top-lit shade into one gradient each, run corner to corner
 * like Prismatic (SVG has no
 * layered backgrounds); Prismatic uses the same muted iridescent stops as
 * `.tier-bar-prismatic`, drifting slowly across each cell. */
function TierFillDefs({ animate }: { animate: boolean }) {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden>
      <defs>
        <linearGradient id={GOLD_FILL_ID} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#dbb77a" />
          <stop offset="40%" stopColor="#cca057" />
          <stop offset="100%" stopColor="#a57b38" />
        </linearGradient>
        <linearGradient id={SILVER_FILL_ID} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#d5dcde" />
          <stop offset="40%" stopColor="#bec7cb" />
          <stop offset="100%" stopColor="#919b9f" />
        </linearGradient>
        <linearGradient id={PRISMATIC_FILL_ID} x1="0" y1="0" x2="1" y2="1" spreadMethod="reflect">
          <stop offset="0%" stopColor="#d9a3cf" />
          <stop offset="33%" stopColor="#b99be0" />
          <stop offset="66%" stopColor="#9fbde8" />
          <stop offset="100%" stopColor="#a3d6c6" />
          {animate && (
            <animateTransform
              attributeName="gradientTransform"
              type="translate"
              values="0 0; 1 1; 0 0"
              dur="10s"
              repeatCount="indefinite"
            />
          )}
        </linearGradient>
      </defs>
    </svg>
  );
}

export { TierFillDefs };
