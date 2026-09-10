import { championIconUrl } from "@/lib/riot";

const ICON_SIZE = 24;

// A minimal local stand-in for @nivo/axes's AxisTickProps — not imported
// directly because @nivo/axes as our own dependency (alongside @nivo/bar's
// and @nivo/heatmap's existing transitive one) hits a real pnpm
// peer-dependency duplication bug in this workspace, the same class of
// issue documented in CLAUDE.md for drizzle-orm: @nivo/axes resolves
// differently depending on whether react/react-dom are recognized as its
// peers via how it's required, and pnpm mis-links the un-peered copy (shows
// up as "Cannot find module '@nivo/axes'" even though it's "installed").
// Only the fields this component actually uses are declared here.
interface AxisTickRenderProps {
  x: number;
  y: number;
  value: string;
}

/** Renders a champion's icon in place of the plain-text axis label — used
 * as `axisLeft.renderTick` on any Nivo chart indexed/keyed by champion name
 * (the KDA bar chart, the banned-champions bar chart, ...). Uses a plain
 * <img> rather than shadcn's `Avatar` — that primitive's ring border isn't
 * wanted on a borderless chart-axis icon. A `<foreignObject>` is what lets
 * ordinary HTML be embedded inside Nivo's <svg> chart canvas at a given
 * position. */
function ChampionIconTick({ x, y, value }: AxisTickRenderProps) {
  return (
    <g transform={`translate(${x},${y})`}>
      <foreignObject
        x={-ICON_SIZE - 10}
        y={-ICON_SIZE / 2}
        width={ICON_SIZE}
        height={ICON_SIZE}
      >
        <img
          src={championIconUrl(value)}
          alt={value}
          width={ICON_SIZE}
          height={ICON_SIZE}
          className="size-full rounded-md object-cover"
        />
      </foreignObject>
    </g>
  );
}

export { ChampionIconTick, ICON_SIZE };
