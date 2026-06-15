import Link from "next/link";
import { Logo } from "./Logo";
import { SearchTrigger } from "./SearchTrigger";
import { AuthNav } from "./auth/AuthNav";

const NAV = [
  { href: "/programs", label: "Programs" },
  { href: "/exercises", label: "Exercises" },
  { href: "/tools", label: "Tools" },
  { href: "/guidebook", label: "Guidebook" },
  { href: "/guidebook/bodybuilding-nutrition", label: "Nutrition" },
  { href: "/guidebook/faq", label: "FAQ" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Logo size={25} />
        <nav className="hidden items-center gap-0.5 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-surface hover:text-fg"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <SearchTrigger />
          <AuthNav />
          <Link
            href="/programs"
            className="group relative inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg transition-all hover:bg-accent-2"
          >
            Start
          </Link>
        </div>
      </div>
      <nav className="flex items-center gap-0.5 overflow-x-auto border-t border-line px-3 py-2 md:hidden">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm text-muted hover:text-fg"
          >
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
