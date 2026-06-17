"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Nav link that marks the current route with aria-current="page" (and a visible
// indicator via the aria-[current=page] variant). Exact-match keeps a single
// current item even when a parent and child path both appear in the nav.
export function NavLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={className}>
      {children}
    </Link>
  );
}
