import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Private/authenticated surfaces — never index user dashboards, auth flows,
      // or (forthcoming) gamified social/leaderboard pages.
      disallow: [
        "/log",
        "/progress",
        "/account",
        "/profile",
        "/achievements",
        "/leaderboards",
        "/admin",
        "/onboarding",
        "/login",
        "/register",
        "/forgot-password",
        "/reset-password",
        "/verify-email",
        "/api/",
      ],
    },
    sitemap: "https://scorefit.net/sitemap.xml",
  };
}
