import type { NextConfig } from "next";

// Baseline CSP. 'unsafe-inline' is retained for scripts because every page is
// statically prerendered: a nonce/hash-based policy would require per-request
// rendering (reading headers()), which would convert all ~98 static pages to
// dynamic — a worse trade than the marginal hardening, especially as our only
// user-influenced HTML goes through react-markdown (no raw HTML). 'unsafe-eval'
// is dropped in production (only dev tooling needs it). YouTube hosts are
// allow-listed for the click-to-play demo embeds and thumbnails.
const isDev = process.env.NODE_ENV !== "production";
const scriptSrc = ["'self'", "'unsafe-inline'", isDev ? "'unsafe-eval'" : ""].filter(Boolean).join(" ");
const csp = [
  "default-src 'self'",
  `script-src ${scriptSrc}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://i.ytimg.com https://img.youtube.com",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src https://www.youtube-nocookie.com https://www.youtube.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "img.youtube.com" },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
