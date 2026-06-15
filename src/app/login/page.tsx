import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";
import { AuthShell } from "@/components/auth/AuthShell";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const sp = await searchParams;
  const callbackUrl = typeof sp.callbackUrl === "string" ? sp.callbackUrl : "/log";
  return (
    <AuthShell title="Sign in" subtitle="Log your sets and track progress across the program.">
      <LoginForm callbackUrl={callbackUrl} />
    </AuthShell>
  );
}
