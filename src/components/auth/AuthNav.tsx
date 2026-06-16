"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { LogOut, NotebookPen, UserRound } from "lucide-react";

export function AuthNav() {
  const { status } = useSession();

  if (status === "loading") {
    return <span className="h-8 w-20" aria-hidden />;
  }

  if (status === "authenticated") {
    return (
      <div className="flex items-center gap-1.5">
        <Link
          href="/log"
          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-muted transition-colors hover:border-line-2 hover:text-fg"
        >
          <NotebookPen className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Log</span>
        </Link>
        <Link
          href="/account"
          className="inline-flex items-center justify-center rounded-lg border border-line bg-surface px-2.5 py-2 text-muted transition-colors hover:border-line-2 hover:text-fg"
          aria-label="Account"
        >
          <UserRound className="h-3.5 w-3.5" />
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="inline-flex items-center justify-center rounded-lg border border-line px-2.5 py-2 text-muted transition-colors hover:border-line-2 hover:text-fg"
          aria-label="Sign out"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <Link
      href="/login"
      className="inline-flex items-center rounded-lg border border-line bg-surface px-3 py-2 text-sm text-muted transition-colors hover:border-line-2 hover:text-fg"
    >
      Sign in
    </Link>
  );
}
