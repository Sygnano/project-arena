import { ResponsiveFunnel } from "@nivo/funnel";
import {
  GoldGradientDef,
  goldGradientFill,
  PrismaticGradientDef,
  prismaticGradientFill,
  SilverGradientDef,
  silverGradientFill,
} from "@/components/augment-gradients";
import type { PlacementChartDatum } from "./index";

type Props = {
  data: PlacementChartDatum[];
};

const PRISMATIC_GRADIENT_ID = "positions-funnel-prismatic-fill";
const GOLD_GRADIENT_ID = "positions-funnel-gold-fill";
const SILVER_GRADIENT_ID = "positions-funnel-silver-fill";

// Same augment-rarity mapping as PositionsChart's `barColor` — 1st place
// gets Prismatic, 2nd-3rd get Gold, the rest get Silver. Unlike the bar
// chart, every stage renders at once here, so Prismatic's usual color-cycle
// animation is turned off below (`animate={false}`) — a moving highlight
// across every segment simultaneously reads as busy rather than "glowy".
function segmentColor(segment: { order: number }): string {
  const { order } = segment;
  if (order === 1) return prismaticGradientFill(PRISMATIC_GRADIENT_ID);
  if (order === 2 || order === 3) return goldGradientFill(GOLD_GRADIENT_ID);
  return silverGradientFill(SILVER_GRADIENT_ID);
}

const PositionsFunnel = ({ data }: Props) => {
  if (data.length === 0) {
    return null;
  }

  // @nivo/funnel has no `value`/`label` accessor props (unlike e.g. @nivo/bar's
  // `keys`/`indexBy`) — ResponsiveFunnel's data items must literally carry
  // `id`/`value`/`label` fields, so the shared placement shape is mapped here.
  // `order` rides along too, unused by nivo itself, purely for `segmentColor`
  // above (nivo's `colors` accessor is called with this same raw datum).
  //
  // A funnel must narrow from top to bottom, so the widest stage — every
  // tracked match, since every match places 6th-or-better by definition —
  // goes first/top, narrowing down to the fewest: matches that placed 1st
  // and nothing worse. Each stage's value is therefore cumulative ("placed
  // this well or better"), not that placement's own raw count.
  const funnelData = [...data]
    .sort((a, b) => b.order - a.order)
    .map((d) => ({
      id: d.placement,
      value: data
        .filter((curr) => curr.order <= d.order)
        .reduce((acc, curr) => acc + curr.count, 0),
      label: d.placement,
      order: d.order,
    }));

  return (
    <div className="w-[50%] h-full flex justify-center">
      {/* See PositionsChart's own copy of this comment for why these need a
       * unique id per chart rather than a shared default. */}
      <PrismaticGradientDef id={PRISMATIC_GRADIENT_ID} animate={false} />
      <GoldGradientDef id={GOLD_GRADIENT_ID} />
      <SilverGradientDef id={SILVER_GRADIENT_ID} />
      <ResponsiveFunnel
        data={funnelData}
        colors={segmentColor}
        borderWidth={1}
        borderColor="var(--color-lol-border-muted)"
        enableLabel={true}
        spacing={3}
        theme={{
          text: { fill: "var(--color-lol-text-secondary)", fontSize: 12 },
          tooltip: {
            container: {
              background: "var(--color-lol-navy-900)",
              color: "var(--color-lol-text)",
            },
          },
        }}
      />
    </div>
  );
};

export { PositionsFunnel };
