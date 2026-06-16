import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Next 16 renamed the `middleware` file convention to `proxy`. Uses the
// edge-safe config only. Matched to protected routes below, so the `authorized`
// callback simply requires a session; otherwise it redirects to /login.
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/log/:path*", "/progress/:path*", "/account/:path*", "/verify-email/:path*"],
};
