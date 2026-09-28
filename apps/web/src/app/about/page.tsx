import type { Metadata } from "next";
import { About } from "./_components/about";

export const metadata: Metadata = {
  title: "About · Arena Journey",
};

export default function AboutPage() {
  return <About />;
}
