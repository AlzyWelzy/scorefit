import Link from "next/link";

// Shared centered card for auth pages.
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-5 py-14">
      {/* Drifting ember+teal spotlight backdrop behind the auth card. */}
      <div aria-hidden className="aurora pointer-events-none absolute inset-0 -z-10 rounded-card" />
      <Link href="/" className="eyebrow-accent mb-6 text-center transition-colors hover:text-fg">
        ScoreFit
      </Link>
      <div className="glass relative rounded-card p-7">
        <h1 className="display-tight font-display text-2xl font-bold">
          <span className="gradient-text">{title}</span>
        </h1>
        <p className="mt-1.5 mb-6 text-sm text-muted">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}
