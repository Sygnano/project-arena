import type { Metadata } from "next";
import { beaufort, spiegel } from "@/fonts";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Arena Stats",
  description: "League of Legends Arena mode stats for the crew.",
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
