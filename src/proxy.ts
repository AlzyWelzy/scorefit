import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Fail-closed route protection. Next 16 renamed the `middleware` file convention to
// `proxy`. The edge-safe authConfig (no DB/bcrypt) decodes the JWT and its `authorized`
// callback requires a session; unauthenticated hits on a matched PAGE redirect to
// /login. API routes are intentionally NOT matched here — they keep their own per-route
// auth() checks so they return 401 JSON, not a redirect. This is a belt-and-suspenders
// net so a new protected page that forgets its inline check still fails closed.
export default NextAuth(authConfig).auth;

export const config = {
  // Every authenticated page surface (each also does its own auth() + redirect).
  matcher: [
    "/log/:path*",
    "/progress/:path*",
    "/account/:path*",
    "/profile/:path*",
    "/achievements/:path*",
    "/leaderboards/:path*",
    "/verify-email/:path*",
    "/onboarding/:path*",
    "/feed/:path*",
    "/admin/:path*",
  ],
};
