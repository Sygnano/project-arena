import { Separator } from "@/components/ui/separator";
import {
  Carousel,
  CarouselContent,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

type Props = {
  sidebar: React.ReactNode;
  /** One `CarouselItem` per slide. */
  children: React.ReactNode;
  footer?: React.ReactNode;
};

/**
 * The two-column "sidebar stats + carousel" skeleton shared by every
 * `CategorySection` that pairs a fixed stat panel with one or more swipeable
 * chart slides (KDA, Positions, TimePlayed, ...). Callers own the sidebar's
 * actual content (`sidebar` — typically a `SidebarHeadline` plus a
 * `SidebarStatGrid`) and each slide (`children`, one `CarouselItem` per
 * slide); this component only owns the shared wrapper divs, separators, and
 * the carousel's own plumbing (`CarouselContent`/`CarouselPrevious`/
 * `CarouselNext`). Must be rendered inside a `CategorySection`.
 */
function CategoryLayout({
  sidebar,
  children,
  footer = <p>You&apos;re spending time in Arena!</p>,
}: Props) {
  return (
    <>
      <div className="flex min-h-0 flex-1 w-full">
        <div className="flex w-80 shrink-0 flex-col">{sidebar}</div>

        <Separator
          orientation="vertical"
          className="mx-12 bg-transparent bg-linear-to-b from-transparent via-lol-gold-400 to-transparent"
        />

        <Carousel className="flex min-w-0 flex-1">
          <CarouselContent className="h-full">{children}</CarouselContent>
          <CarouselPrevious className="left-2" />
          <CarouselNext className="right-2" />
        </Carousel>
      </div>
      <Separator className="my-4 bg-transparent bg-linear-to-r from-transparent via-lol-gold-400 to-transparent" />
      {footer}
    </>
  );
}

export { CategoryLayout };
