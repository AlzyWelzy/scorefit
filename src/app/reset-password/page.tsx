import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetPasswordForm } from "@/components/account/ResetPasswordForm";

export const metadata: Metadata = { title: "Reset password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const sp = await searchParams;
  return (
    <AuthShell
      title="Set a new password"
      subtitle="Enter the code from your email and a new password."
    >
      <ResetPasswordForm email={sp.email ?? ""} />
    </AuthShell>
  );
}
