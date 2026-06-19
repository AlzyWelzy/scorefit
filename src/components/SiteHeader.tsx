import Link from "next/link";
import { Logo } from "./Logo";
import { NavLink } from "./NavLink";
import { SearchTrigger } from "./SearchTrigger";
import { ThemeToggle } from "./ThemeToggle";
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
    <header className="glass sticky top-0 z-50 rounded-none border-x-0 border-t-0">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-accent/30 to-transparent" />
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Logo size={25} />
        <nav aria-label="Primary" className="hidden items-center gap-0.5 md:flex">
          {NAV.map((n) => (
            <NavLink
              key={n.href}
              href={n.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted transition-all hover:bg-surface hover:text-fg aria-[current=page]:bg-linear-to-b aria-[current=page]:from-accent/15 aria-[current=page]:to-accent/5 aria-[current=page]:text-fg aria-[current=page]:ring-accent"
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <SearchTrigger />
          <ThemeToggle />
          <AuthNav />
          <Link
            href="/programs"
            className="btn-accent inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold"
          >
            Start
          </Link>
        </div>
      </div>
      <nav aria-label="Primary mobile" className="flex items-center gap-0.5 overflow-x-auto border-t border-line px-3 py-2 md:hidden">
        {NAV.map((n) => (
          <NavLink
            key={n.href}
            href={n.href}
            className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:text-fg aria-[current=page]:font-semibold aria-[current=page]:text-accent-2"
          >
            {n.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
