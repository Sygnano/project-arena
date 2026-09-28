import { HextechEmblem } from "@/components/status-screen";

type Props = { fraction: number | null };

/** The emblem with a progress ring around it while matches are fetched. */
function ProgressEmblem({ fraction }: Props) {
  const radius = 76;
  const circumference = 2 * Math.PI * radius;
  return (
    <HextechEmblem>
      <div className="dial-breathe absolute inset-[62px] rotate-45 bg-lol-gold-300/70" />
      <svg viewBox="0 0 160 160" className="absolute inset-0 -rotate-90 overflow-visible">
        <defs>
          <linearGradient id="refresh-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#c8aa6e" />
            <stop offset="1" stopColor="#0ac8b9" />
          </linearGradient>
        </defs>
        {fraction !== null ? (
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke="url(#refresh-ring)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - fraction)}
            style={{
              transition: "stroke-dashoffset .8s ease-out",
              filter: "drop-shadow(0 0 4px rgba(10,200,185,.6))",
            }}
          />
        ) : null}
      </svg>
    </HextechEmblem>
  );
}

export { ProgressEmblem };
