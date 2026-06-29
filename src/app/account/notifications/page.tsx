import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getNotificationPrefs } from "@/db/notifications";
import { NotificationPrefsForm } from "@/components/account/NotificationPrefsForm";
import { PushToggle } from "@/components/account/PushToggle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Notifications",
  alternates: { canonical: "/account/notifications" },
  robots: { index: false, follow: false },
};

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/account/notifications");
  const prefs = await getNotificationPrefs(session.user.id);

  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <Link href="/account" className="text-xs text-muted hover:text-fg">
        ← Account
      </Link>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">Notifications</h1>
      <p className="mt-1.5 text-sm text-muted">
        Choose which emails you get. We respect quiet hours and never sell your address.
      </p>
      <NotificationPrefsForm initial={prefs} />
      <PushToggle />
    </div>
  );
}
