import { tierGradient, gamesTierPosition } from "@/lib/tier-bars";

type Props = {
  /** 24 entries, index 0 = matches starting 00:00-00:59 UTC. */
  gamesByHour: number[];
};

const SIZE = 480;
const CENTER = SIZE / 2;
const INNER_R = 50;
const MAX_BAR_LENGTH = 150;
const HOUR_COUNT = 24;

/**
 * "BY HOUR" view — a 24-spoke radial bar chart of matches by hour of day
 * (UTC), replacing the calendar grid entirely for this mode (there's no
 * per-day date to select here, so no `DetailBand` alongside it). Built with
 * plain SVG rather than a chart library, same approach as Economy's anvil
 * gauge rings — a fixed 24-slice polar layout doesn't need more than that.
 * Bar color reuses the games-count tier gradient (`gamesTierPosition`) so
 * this view reads as part of the same activity-by-volume language as the
 * BY GAMES calendar coloring, just laid out radially instead of as a grid.
 */
function HourRadial({ gamesByHour }: Props) {
  const maxGames = Math.max(1, ...gamesByHour);

  const bars = gamesByHour.map((count, hour) => {
    const angle = (hour / HOUR_COUNT) * Math.PI * 2 - Math.PI / 2;
    const length = (count / maxGames) * MAX_BAR_LENGTH;
    const x1 = CENTER + Math.cos(angle) * INNER_R;
    const y1 = CENTER + Math.sin(angle) * INNER_R;
    const x2 = CENTER + Math.cos(angle) * (INNER_R + length);
    const y2 = CENTER + Math.sin(angle) * (INNER_R + length);
    const color = tierGradient(gamesTierPosition(count));
    return { hour, count, x1, y1, x2, y2, color };
  });

  const labelHours = [0, 3, 6, 9, 12, 15, 18, 21];

  return (
    <div className="flex h-full w-full items-center justify-center">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-full max-h-120 max-w-120">
        <circle
          cx={CENTER}
          cy={CENTER}
          r={INNER_R}
          fill="none"
          stroke="rgba(200,170,110,.3)"
        />
        <circle
          cx={CENTER}
          cy={CENTER}
          r={INNER_R + MAX_BAR_LENGTH}
          fill="none"
          stroke="rgba(240,230,210,.06)"
        />

        {bars.map(({ hour, count, x1, y1, x2, y2, color }) => (
          <line
            key={hour}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={color}
            strokeWidth={7}
            strokeLinecap="round"
            opacity={count > 0 ? 0.95 : 0.15}
          >
            <title>
              {count} game{count === 1 ? "" : "s"} at {hour.toString().padStart(2, "0")}:00
            </title>
          </line>
        ))}

        {labelHours.map((hour) => {
          const angle = (hour / HOUR_COUNT) * Math.PI * 2 - Math.PI / 2;
          const r = INNER_R + MAX_BAR_LENGTH + 20;
          const x = CENTER + Math.cos(angle) * r;
          const y = CENTER + Math.sin(angle) * r;
          return (
            <text
              key={hour}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-lol-text-muted text-[11px]"
            >
              {hour.toString().padStart(2, "0")}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

export { HourRadial };
