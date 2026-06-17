import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getUserById } from "@/db/users";
import { AuthShell } from "@/components/auth/AuthShell";
import { VerifyEmailForm } from "@/components/account/VerifyEmailForm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Verify email" };

export default async function VerifyEmailPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/verify-email");
  const user = await getUserById(session.user.id);
  if (!user) redirect("/login?callbackUrl=/verify-email");
  // Nothing to verify here only if the email is verified AND no change is pending
  // (during an email change the current email stays verified, but the user still
  // needs this screen to enter the code sent to the NEW address).
  if (user.emailVerified && !user.pendingEmail) redirect("/account");

  const changing = !!user.pendingEmail;
  return (
    <AuthShell
      title={changing ? "Confirm your new email" : "Verify your email"}
      subtitle={
        changing
          ? "Enter the 6-digit code we emailed to your new address."
          : "Enter the 6-digit code we emailed you."
      }
    >
      <VerifyEmailForm changing={changing} />
    </AuthShell>
  );
}
