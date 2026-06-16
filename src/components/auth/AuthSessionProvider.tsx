"use client";

import { SessionProvider } from "next-auth/react";

// No initial session passed: keeping the root layout static (it does NOT call
// auth()) lets all content pages stay statically prerendered for SEO. The
// session is fetched client-side once on hydration.
export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
