import type { ReactNode } from "react";
import type { RailSlide } from "./components/chapter-rail";

type Slide = RailSlide & { render: () => ReactNode };

export type { Slide };
