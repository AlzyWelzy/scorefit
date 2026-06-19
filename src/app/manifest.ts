import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ScoreFit — Science-based hypertrophy training",
    short_name: "ScoreFit",
    description: "Two 12-week science-based hypertrophy programs with logging.",
    start_url: "/",
    display: "standalone",
    background_color: "#07090c",
    theme_color: "#07090c",
    icons: [
      // SVG works for most modern browsers. For best install UX, add
      // 192x192 and 512x512 maskable PNGs (e.g. /icon-192.png, /icon-512.png).
      {
        src: "/icon.svg",
        type: "image/svg+xml",
        sizes: "any",
        purpose: "any",
      },
    ],
  };
}
