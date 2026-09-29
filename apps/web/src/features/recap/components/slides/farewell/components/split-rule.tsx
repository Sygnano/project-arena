"use client";

/** The gold rule between the two halves: vertical side by side, horizontal
 * once they stack. */
const SplitRule = () => (
  <div aria-hidden className="flex items-center justify-center gap-4.5 md:h-80 md:flex-col">
    <div className="h-px w-24 bg-[linear-gradient(90deg,transparent,rgba(200,170,110,.55))] md:h-full md:w-px md:bg-[linear-gradient(180deg,transparent,rgba(200,170,110,.55))]" />
    <div className="h-2.25 w-2.25 shrink-0 rotate-45 border border-[rgba(200,170,110,.75)]" />
    <div className="h-px w-24 bg-[linear-gradient(90deg,rgba(200,170,110,.55),transparent)] md:h-full md:w-px md:bg-[linear-gradient(180deg,rgba(200,170,110,.55),transparent)]" />
  </div>
);

export { SplitRule };
