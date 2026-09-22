import type { Metadata } from "next";
import { beaufort, spiegel } from "@/fonts";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  // Link previews need absolute image URLs. SITE_URL is the deployed origin
  // (e.g. https://arena.example.com); dev falls back to the local server.
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
  title: "Arena Journey",
  description: "Your League of Legends Arena season, recapped: every game, champion and augment.",
  openGraph: { siteName: "Arena Journey", type: "website" },
  // Recaps are named players' pages, shared by link, not for search
  // engines. Previews (Discord, X) still work: they read the tags anyway.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${beaufort.variable} ${spiegel.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
