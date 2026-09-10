import localFont from "next/font/local";

// Beaufort for LoL — display/heading font, ported from ../project-arena/public/fonts/beaufort
export const beaufort = localFont({
  variable: "--font-beaufort",
  display: "swap",
  src: [
    { path: "./beaufort/beaufortforlol-light.otf", weight: "300", style: "normal" },
    { path: "./beaufort/BeaufortForLoL-Regular.otf", weight: "400", style: "normal" },
    { path: "./beaufort/beaufortforlol-medium.otf", weight: "500", style: "normal" },
    { path: "./beaufort/beaufortforlol-bold.otf", weight: "700", style: "normal" },
    { path: "./beaufort/beaufortforlol-heavy.otf", weight: "900", style: "normal" },
    { path: "./beaufort/beaufortforlol-lightitalic.otf", weight: "300", style: "italic" },
    { path: "./beaufort/beaufortforlol-italic.otf", weight: "400", style: "italic" },
    { path: "./beaufort/beaufortforlol-mediumitalic.otf", weight: "500", style: "italic" },
    { path: "./beaufort/beaufortforlol-bolditalic.otf", weight: "700", style: "italic" },
    { path: "./beaufort/beaufortforlol-heavyitalic.otf", weight: "900", style: "italic" },
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
    { path: "./spiegel/spiegel-semibolditalic.otf", weight: "600", style: "italic" },
    { path: "./spiegel/spiegel-bolditalic.otf", weight: "700", style: "italic" },
  ],
});
