import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getUserById } from "@/db/users";
import { AccountManager } from "@/components/account/AccountManager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Account",
  alternates: { canonical: "/account" },
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/account");

  // Read the live row, not the (possibly stale) JWT — verification/unit can
  // change after sign-in, and this page must always reflect the truth.
  const user = await getUserById(session.user.id);
  if (!user) redirect("/login?callbackUrl=/account");

  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <span className="eyebrow-accent">Settings</span>
      <h1 className="display-tight mt-1 font-display text-3xl font-bold">
        <span className="gradient-text">Account</span>
      </h1>
      <p className="mt-1.5 text-sm text-muted">
        Manage your profile, sign-in details and unit preference.
      </p>
      <div className="mt-8">
        <AccountManager
          name={user.name ?? null}
          email={user.email}
          unit={user.unit as "kg" | "lb"}
          emailVerified={!!user.emailVerified}
          gamificationOptOut={user.gamificationOptOut}
        />
      </div>
    </div>
  );
}
