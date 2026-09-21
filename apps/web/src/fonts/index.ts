import localFont from "next/font/local";

// Only the faces the UI actually uses are declared: next/font preloads every
// file listed here, so the unused light/heavy/italic cuts (still on disk)
// used to add ~9 font downloads to every page view.
// Beaufort for LoL — display/heading font, ported from ../project-arena/public/fonts/beaufort
export const beaufort = localFont({
  variable: "--font-beaufort",
  display: "swap",
  src: [
    { path: "./beaufort/BeaufortForLoL-Regular.otf", weight: "400", style: "normal" },
    { path: "./beaufort/beaufortforlol-medium.otf", weight: "500", style: "normal" },
    { path: "./beaufort/beaufortforlol-bold.otf", weight: "700", style: "normal" },
  ],
});

// Spiegel — body font, ported from ../project-arena/public/fonts/spiegel
export const spiegel = localFont({
  variable: "--font-spiegel",
  display: "swap",
  src: [
    { path: "./spiegel/spiegel-regular.otf", weight: "400", style: "normal" },
    { path: "./spiegel/spiegel-semibold.otf", weight: "600", style: "normal" },
    { path: "./spiegel/spiegel-bold.otf", weight: "700", style: "normal" },
    { path: "./spiegel/spiegel-regularitalic.otf", weight: "400", style: "italic" },
  ],
});
