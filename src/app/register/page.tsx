import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { AuthShell } from "@/components/auth/AuthShell";

export const metadata: Metadata = {
  title: "Create account",
  robots: { index: false, follow: false },
};

export default function RegisterPage() {
  return (
    <AuthShell title="Create account" subtitle="Start logging your training. Free, no card.">
      <RegisterForm />
    </AuthShell>
  );
}
