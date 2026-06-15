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
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-5 py-14">
      <Link href="/" className="eyebrow mb-6 text-center hover:text-fg">
        ScoreFit
      </Link>
      <div className="rounded-card border border-line bg-surface p-7">
        <h1 className="font-display text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1.5 mb-6 text-sm text-muted">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}
