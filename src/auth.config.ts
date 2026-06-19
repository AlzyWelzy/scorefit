import type { NextAuthConfig } from "next-auth";

// Edge-safe config: NO database or bcrypt imports here, so it can run in the
// middleware (edge) bundle. The Credentials provider + DB live in auth.ts,
// which runs only on the Node runtime.
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    // Used by the proxy (Next 16's middleware) to gate routes. It is matched only
    // to protected paths (see proxy.ts), so requiring a session here is enough.
    authorized({ auth }) {
      return !!auth?.user;
    },
  },
} satisfies NextAuthConfig;
