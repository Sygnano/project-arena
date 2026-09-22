import { cn } from "cn";

/** Mirrors a right-half flourish onto the left of a 400-wide viewBox. */
const MIRROR = "matrix(-1 0 0 1 400 0)";
/** Lets a CSS rotation on an SVG group turn around the group's own center. */
const SPIN_IN_PLACE = "[transform-box:fill-box] origin-center";
const CYAN_GLOW = { filter: "drop-shadow(0 0 4px rgba(10,196,217,.9))" };

/**
 * The splash page's title: "ARENA / JOURNEY" in Beaufort, framed by Hextech
 * filigree borrowed from the summoner page's dials — a spinning cyan arc,
 * nested gold diamonds, a glowing core and breathing gold markers. The crest
 * above is the darker antique gold, the title the bright polished gold, and
 * the cradle below sits between the two.
 */
function SplashTitle({ className }: { className?: string }) {
  return (
    <span className={cn("flex flex-col items-center", className)}>
      <svg aria-hidden viewBox="0 0 400 72" className="w-[min(88vw,420px)] overflow-visible">
        <defs>
          {/* User-space fades: a bounding-box gradient on a straight line
              (zero height) doesn't render. The mirrored wing flips them too. */}
          <linearGradient id="journey-top-fade" gradientUnits="userSpaceOnUse" x1="226" y1="0" x2="394" y2="0">
            <stop offset="0" stopColor="#a77b28" />
            <stop offset="1" stopColor="#785a28" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="journey-cyan-fade" gradientUnits="userSpaceOnUse" x1="226" y1="0" x2="316" y2="0">
            <stop offset="0" stopColor="#0ac4d9" />
            <stop offset="1" stopColor="#0ac4d9" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="journey-top-frame" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#c89b3c" />
            <stop offset="1" stopColor="#5b431a" />
          </linearGradient>
          <linearGradient id="journey-core" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#cdfafa" />
            <stop offset=".45" stopColor="#0ac8b9" />
            <stop offset="1" stopColor="#005a82" />
          </linearGradient>
        </defs>

        {[undefined, MIRROR].map((transform) => (
          <g key={transform ?? "right"} transform={transform} fill="none">
            <path d="M226 30 232 36 226 42" stroke="#a77b28" strokeWidth="1.2" />
            <path d="M238 36H262L268 30H340" stroke="url(#journey-top-fade)" strokeWidth="1" />
            <path d="M262 36 268 42H318" stroke="url(#journey-top-fade)" strokeWidth=".6" />
            <path d="M346 30H394" stroke="url(#journey-top-fade)" strokeWidth=".5" opacity=".6" />
            <path d="M236 36H316" stroke="url(#journey-cyan-fade)" strokeWidth="1.2" style={CYAN_GLOW} />
            <path className="dial-breathe" d="M342 26.5 345.5 30 342 33.5 338.5 30Z" fill="#c8aa6e" />
            <path d="M321 39.5 323.5 42 321 44.5 318.5 42Z" fill="#785a28" />
          </g>
        ))}

        <circle
          className={cn("welcome-spin-slow", SPIN_IN_PLACE)}
          cx="200"
          cy="36"
          r="31"
          fill="none"
          stroke="rgba(200,170,110,.4)"
          strokeWidth=".8"
          strokeDasharray="2 4"
        />
        <g className={cn("dial-spin", SPIN_IN_PLACE)} fill="none">
          <circle
            cx="200"
            cy="36"
            r="25"
            stroke="#0ac4d9"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeDasharray="36 121"
            style={CYAN_GLOW}
          />
          <circle
            cx="200"
            cy="36"
            r="25"
            stroke="#0ac8b9"
            strokeWidth=".8"
            strokeDasharray="10 147"
            strokeDashoffset="-78"
            opacity=".6"
          />
        </g>
        <path
          d="M200 16 220 36 200 56 180 36Z"
          fill="#050e16"
          stroke="url(#journey-top-frame)"
          strokeWidth="1.4"
        />
        <path
          d="M200 22 214 36 200 50 186 36Z"
          fill="none"
          stroke="#c8aa6e"
          strokeOpacity=".45"
          strokeWidth=".7"
        />
        <path
          d="M200 28 208 36 200 44 192 36Z"
          fill="url(#journey-core)"
          style={{ filter: "drop-shadow(0 0 5px rgba(10,200,185,.9))" }}
        />
        <path className="dial-breathe" d="M200 0.5 203.5 4 200 7.5 196.5 4Z" fill="#c8aa6e" />
        <path
          className="dial-breathe"
          d="M200 64.5 203.5 68 200 71.5 196.5 68Z"
          fill="#c8aa6e"
          style={{ animationDelay: "2.5s" }}
        />
      </svg>

      <span className="mt-2 flex flex-col items-center font-display leading-[1.02] filter-[drop-shadow(0_2px_14px_rgba(200,155,60,.28))]">
        {["ARENA", "JOURNEY"].map((word) => (
          <span
            key={word}
            // The padding offsets the trailing letter-spacing so each word centers.
            className="bg-[linear-gradient(180deg,#f0e6d2_8%,#d8c28b_52%,#c89b3c_100%)] bg-clip-text pl-[.12em] text-[clamp(2.75rem,11vw,4.75rem)] tracking-[.12em] text-transparent"
          >
            {word}
          </span>
        ))}
      </span>

      <svg aria-hidden viewBox="0 0 400 44" className="mt-2 w-[min(84vw,380px)] overflow-visible">
        <defs>
          <linearGradient id="journey-cradle-cyan" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#0ac4d9" stopOpacity="0" />
            <stop offset=".5" stopColor="#0ac4d9" />
            <stop offset="1" stopColor="#0ac4d9" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="journey-cradle-gold" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#d8c28b" stopOpacity=".15" />
            <stop offset=".5" stopColor="#d8c28b" />
            <stop offset="1" stopColor="#d8c28b" stopOpacity=".15" />
          </linearGradient>
          <linearGradient id="journey-pendant" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e9d8ae" />
            <stop offset="1" stopColor="#a77b28" />
          </linearGradient>
        </defs>
        <path
          d="M40 8Q200 38 360 8"
          fill="none"
          stroke="url(#journey-cradle-cyan)"
          strokeWidth="1.4"
          style={CYAN_GLOW}
        />
        <path
          d="M90 4Q200 26 310 4"
          fill="none"
          stroke="url(#journey-cradle-gold)"
          strokeWidth=".8"
        />
        {[undefined, MIRROR].map((transform) => (
          <path
            key={transform ?? "right"}
            className="dial-breathe"
            transform={transform}
            d="M310 1 313 4 310 7 307 4Z"
            fill="#d8c28b"
          />
        ))}
        <path
          d="M200 12 208 23 200 42 192 23Z"
          fill="#050e16"
          stroke="url(#journey-pendant)"
          strokeWidth="1.2"
        />
        <path
          d="M200 18 203.5 23.5 200 33 196.5 23.5Z"
          fill="url(#journey-core)"
          style={{ filter: "drop-shadow(0 0 4px rgba(10,200,185,.9))" }}
        />
      </svg>
    </span>
  );
}

export { SplashTitle };
