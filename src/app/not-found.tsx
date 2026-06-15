import Link from "next/link";

export default function NotFound() {
  return (
    <div className="relative mx-auto flex max-w-2xl flex-col items-center px-5 py-32 text-center">
      <div className="glow-ember left-1/2 top-10 h-64 w-64 -translate-x-1/2" />
      <span className="num relative text-7xl font-bold text-accent">404</span>
      <h1 className="relative mt-4 font-display text-2xl font-semibold">Set not found</h1>
      <p className="relative mt-2 text-muted">That page isn&apos;t in the logbook.</p>
      <Link href="/" className="relative mt-6 rounded-lg bg-accent px-5 py-2.5 font-semibold text-bg hover:bg-accent-2">
        Back to start
      </Link>
    </div>
  );
}
