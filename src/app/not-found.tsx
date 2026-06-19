import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Not found",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <div className="relative mx-auto flex max-w-2xl flex-col items-center px-5 py-32 text-center">
      <div className="glow-ember left-1/2 top-10 h-64 w-64 -translate-x-1/2" />
      <div className="glass relative flex w-full max-w-md flex-col items-center p-10">
        <span className="num gradient-text text-7xl font-bold">404</span>
        <h1 className="mt-4 font-display text-2xl font-semibold">
          Set not found
        </h1>
        <p className="mt-2 text-muted">That page isn&apos;t in the logbook.</p>
        <Link href="/" className="btn-accent mt-6">
          Back to start
        </Link>
      </div>
    </div>
  );
}
