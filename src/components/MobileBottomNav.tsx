"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { LayoutDashboard, NotebookPen, TrendingUp, UserRound } from "lucide-react";

// Bottom tab bar for signed-in users on mobile only. Uses always-available authed routes
// (no flag-gated links, so no 404s). Hidden at md+ where the header nav takes over.
const ITEMS = [
  { href: "/dashboard", label: "Home", Icon: LayoutDashboard },
  { href: "/log", label: "Log", Icon: NotebookPen },
  { href: "/progress", label: "Progress", Icon: TrendingUp },
  { href: "/account", label: "Account", Icon: UserRound },
];

export function MobileBottomNav() {
  const { status } = useSession();
  const pathname = usePathname();
  if (status !== "authenticated") return null;

  return (
    <nav
      aria-label="Primary mobile"
      className="glass fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around rounded-none border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {ITEMS.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] transition-colors ${active ? "text-accent" : "text-muted hover:text-fg"}`}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
