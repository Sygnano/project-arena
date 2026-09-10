import { Separator } from "@/components/ui/separator";

interface CategorySectionProps {
  title: string;
  quote?: string;
  children?: React.ReactNode;
}

/**
 * One full-viewport "screen" in the summoner page's scroll-snap sequence.
 * `snap-always` (scroll-snap-stop: always) is what makes a single scroll
 * gesture land on the next section instead of skipping past several on a
 * fast flick/trackpad swipe.
 */
export function CategorySection({
  title,
  children,
  quote = "It's not about how much time you have, it's about how you spend it.",
}: CategorySectionProps) {
  return (
    <section className="flex h-screen w-full snap-start snap-always justify-center items-center">
      <div className="mx-18 pb-24 flex h-10/12 w-full flex-col">
        <div className="mb-12">
          <p className="text-section font-display text-6xl font-bold tracking-wide">
            {title}
          </p>
          <p className="text-section text-xl font-display italic">“{quote}”</p>
        </div>
        {children}
      </div>
    </section>
  );
}
