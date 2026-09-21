import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets a production build run beside a live `next dev` without both
  // writing to `.next` (e.g. `NEXT_DIST_DIR=.next-build pnpm build`).
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
