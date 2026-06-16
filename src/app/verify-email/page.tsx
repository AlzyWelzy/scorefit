import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthShell } from "@/components/auth/AuthShell";
import { VerifyEmailForm } from "@/components/account/VerifyEmailForm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Verify email" };

export default async function VerifyEmailPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/verify-email");
  if (session.user.verified) redirect("/account");

  return (
    <AuthShell
      title="Verify your email"
      subtitle="Enter the 6-digit code we emailed you."
    >
      <VerifyEmailForm />
    </AuthShell>
  );
}
