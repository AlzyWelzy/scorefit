import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getUserById } from "@/db/users";
import { OnboardingForm } from "@/components/OnboardingForm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Get started",
  alternates: { canonical: "/onboarding" },
  robots: { index: false, follow: false },
};

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/onboarding");

  const user = await getUserById(session.user.id);
  if (!user) redirect("/login");
  // Already set up — skip straight to the logger.
  if (user.currentProgram) redirect("/log");

  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <span className="eyebrow">Welcome to ScoreFit</span>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Let&apos;s set you up</h1>
      <p className="mt-1.5 text-sm text-muted">
        Pick a program and where to start. You can change any of this later.
      </p>
      <div className="mt-8">
        <OnboardingForm initialUnit={(user.unit as "kg" | "lb") ?? "kg"} />
      </div>
    </div>
  );
}
