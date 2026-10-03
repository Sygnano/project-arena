import type { ReactNode } from "react";

/** The strip itself — cells bottom-aligned in a row (the first cell's
 * `bordered={false}` is the caller's job, same as `DetailBand`'s stats). */
function HeaderStatStrip({ children }: { children: ReactNode }) {
  return <div className="flex items-end">{children}</div>;
}

export { StatCell } from "./components/stat-cell";
export { HeaderStatStrip };
