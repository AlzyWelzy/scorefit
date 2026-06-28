"use client";

import Link from "next/link";
import { useEffect } from "react";
import { reportClientError } from "@/lib/reportClientError";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    reportClientError(error, "log.errorBoundary");
  }, [error]);

  return (
    <div className="relative mx-auto flex max-w-3xl flex-col items-center px-5 py-24 text-center">
      <div className="glow-ember left-1/2 top-12 h-56 w-56 -translate-x-1/2" />
      <div className="glass relative w-full max-w-md p-8">
        <h1 className="font-display text-2xl font-semibold text-fg">Something went wrong</h1>
        <p className="mt-2 text-muted">We couldn&apos;t load this page. Please try again.</p>
        <div className="mt-6 flex flex-col items-center gap-3">
          <button type="button" onClick={reset} className="btn-accent w-full">
            Try again
          </button>
          <Link href="/" className="text-sm text-muted transition-colors hover:text-fg">
            Back to start
          </Link>
        </div>
      </div>
    </div>
  );
}
