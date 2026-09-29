import type { StorySlide } from "@/features/recap/components/summoner-story/components/story-player/types";

type Props = {
  slides: StorySlide[];
  index: number;
  paused: boolean;
  /** The active slide's bar finished filling: time for the next one. */
  onElapsed: () => void;
  onSelect: (index: number) => void;
};

/**
 * One bar per slide across the top: past ones full, the current one filling
 * over its duration. The fill is a CSS animation, and it is the story's
 * clock: its `animationend` advances the story, and pausing the animation
 * pauses the story. Each bar also jumps to its slide.
 */
function StoryProgress({ slides, index, paused, onElapsed, onSelect }: Props) {
  return (
    <ol className="flex gap-1.5">
      {slides.map((slide, i) => (
        <li key={slide.id} className="flex-1">
          <button
            type="button"
            onClick={() => onSelect(i)}
            aria-label={`${slide.label} (${i + 1} of ${slides.length})`}
            aria-current={i === index ? "step" : undefined}
            className="group block w-full py-2"
          >
            <span className="block h-[3px] overflow-hidden rounded-full bg-white/20 transition-colors group-hover:bg-white/35">
              {i < index ? <span className="block h-full w-full bg-lol-gold-100" /> : null}
              {i === index ? (
                <span
                  // Keyed by position so returning to a slide restarts its clock.
                  key={index}
                  className="story-progress-fill block h-full w-full bg-lol-gold-100"
                  style={{
                    animationDuration: `${slide.durationMs}ms`,
                    animationPlayState: paused ? "paused" : "running",
                  }}
                  onAnimationEnd={onElapsed}
                />
              ) : null}
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}

export { StoryProgress };
