"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center px-5 py-24 text-center">
      <div className="w-full max-w-md rounded-card border border-line bg-surface p-6">
        <h1 className="font-display text-2xl font-semibold text-fg">Something went wrong</h1>
        <p className="mt-2 text-muted">We couldn&apos;t load this page. Please try again.</p>
        <div className="mt-6 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="w-full rounded-lg bg-accent px-5 py-2.5 font-semibold text-bg transition-colors hover:bg-accent-2"
          >
            Try again
          </button>
          <Link href="/" className="text-sm text-muted hover:text-fg">
            Back to start
          </Link>
        </div>
      </div>
    </div>
  );
}
