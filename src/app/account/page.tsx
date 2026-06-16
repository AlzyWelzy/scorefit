import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AccountManager } from "@/components/account/AccountManager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Account",
  alternates: { canonical: "/account" },
};

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/account");

  const { name, email, unit, verified } = session.user;

  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <span className="eyebrow">Settings</span>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Account</h1>
      <p className="mt-1.5 text-sm text-muted">
        Manage your profile, sign-in details and unit preference.
      </p>
      <div className="mt-8">
        <AccountManager
          name={name ?? null}
          email={email ?? ""}
          unit={unit}
          emailVerified={verified}
        />
      </div>
    </div>
  );
}
