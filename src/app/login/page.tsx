import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";
import { AuthShell } from "@/components/auth/AuthShell";
import { safeInternalPath } from "@/lib/safeRedirect";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const sp = await searchParams;
  const callbackUrl = safeInternalPath(sp.callbackUrl, "/log");
  return (
    <AuthShell title="Sign in" subtitle="Log your sets and track progress across the program.">
      <LoginForm callbackUrl={callbackUrl} />
    </AuthShell>
  );
}
