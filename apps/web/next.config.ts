import type { NextConfig } from "next";

// Where page assets come from besides this app: champion/profile icons and
// augment/item icons. Also in default-src so the icon prefetch
// (components/asset-prefetch.tsx) isn't blocked.
const ASSET_HOSTS = "https://ddragon.leagueoflegends.com https://raw.communitydragon.org";

// Next's nonce-free policy (docs: guides/content-security-policy): scripts
// only from this origin (inline ones are Next's own bootstrap), no plugins,
// no framing. Production only: `next dev` needs eval and its HMR socket.
const CONTENT_SECURITY_POLICY = [
  `default-src 'self' ${ASSET_HOSTS}`,
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' blob: data: ${ASSET_HOSTS}`,
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  // Lets a production build run beside a live `next dev` without both
  // writing to `.next` (e.g. `NEXT_DIST_DIR=.next-build pnpm build`).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          ...(isDev
            ? []
            : [
                { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
                { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
              ]),
        ],
      },
    ];
  },
};

export default nextConfig;
