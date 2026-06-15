import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Uses the edge-safe config only. Matched to protected routes below, so the
// `authorized` callback simply requires a session; otherwise it redirects to /login.
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/log/:path*", "/progress/:path*"],
};
