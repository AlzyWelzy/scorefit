import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { TwoFactorChallenge } from "@/components/auth/TwoFactorChallenge";
import { safeInternalPath } from "@/lib/safeRedirect";

export const metadata: Metadata = { title: "Two-factor authentication" };

export default async function TwoFactorPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; method?: string }>;
}) {
  const sp = await searchParams;
  const callbackUrl = safeInternalPath(sp.callbackUrl, "/log");
  const method = sp.method === "email" ? "email" : "totp";
  return (
    <AuthShell
      title="Two-step verification"
      subtitle={
        method === "email"
          ? "Enter the 6-digit code we just emailed you."
          : "Enter the 6-digit code from your authenticator app."
      }
    >
      <TwoFactorChallenge callbackUrl={callbackUrl} method={method} />
    </AuthShell>
  );
}
