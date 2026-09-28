import type { ReactNode } from "react";

interface AccordionGalleryItem {
  key: string | number;
  /** Full-bleed image behind the panel, shown in every state. */
  imageUrl: string;
  label: string;
  /** Rendered over the image in the expanded panel only. Laid out at the
   * expanded width regardless of the panel's current width (see
   * `expandedWidth` below), so it never reflows mid-animation. */
  content?: ReactNode;
  /** Small node beside the expanded panel's label — e.g. a crest or icon. */
  badge?: ReactNode;
}

export type { AccordionGalleryItem };
