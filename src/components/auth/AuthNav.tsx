"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import {
  LogOut,
  NotebookPen,
  UserRound,
  ChevronDown,
  TrendingUp,
  Trophy,
  Award,
  Gauge,
  Rss,
  Users,
  Settings,
  Shield,
} from "lucide-react";

type Features = { leaderboards: boolean; social: boolean };

// Authenticated nav: a "Log" quick-action plus an account menu that surfaces every
// signed-in destination (progress, gamification, and the flag-gated social/leaderboard
// pages). Flag/opt-out state comes from the DB-backed /api/account/status, so gated
// links only appear when the feature is actually on for this user.
export function AuthNav() {
  const { status } = useSession();
  const [open, setOpen] = useState(false);
  const [features, setFeatures] = useState<Features>({ leaderboards: false, social: false });
  const [gamificationOptOut, setGamificationOptOut] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    let alive = true;
    fetch("/api/account/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!alive || !d?.authenticated) return;
        if (d.features) setFeatures(d.features);
        setGamificationOptOut(!!d.gamificationOptOut);
        setIsAdmin(!!d.isAdmin);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [status]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (status === "loading") return <span className="h-8 w-20" aria-hidden />;

  if (status !== "authenticated") {
    return (
      <Link
        href="/login"
        className="btn-surface inline-flex items-center px-3 py-2 text-sm text-muted hover:text-fg"
      >
        Sign in
      </Link>
    );
  }

  const gamified = !gamificationOptOut;
  const items = [
    { href: "/progress", label: "Progress", Icon: TrendingUp, show: true },
    { href: "/profile", label: "Training Score", Icon: Gauge, show: gamified },
    { href: "/achievements", label: "Achievements", Icon: Award, show: gamified },
    { href: "/leaderboards", label: "Leaderboards", Icon: Trophy, show: gamified && features.leaderboards },
    { href: "/feed", label: "Feed", Icon: Rss, show: features.social },
    { href: "/groups", label: "Groups", Icon: Users, show: features.social },
  ].filter((i) => i.show);

  const itemClass =
    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-muted transition-colors hover:bg-surface hover:text-fg";

  return (
    <div className="flex items-center gap-1.5">
      <Link
        href="/log"
        className="btn-surface inline-flex items-center gap-1.5 px-3 py-2 text-sm text-muted hover:text-fg"
      >
        <NotebookPen className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Log</span>
      </Link>

      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((v) => !v)}
          className="btn-surface inline-flex items-center gap-1 px-2.5 py-2 text-muted hover:text-fg"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Account menu"
        >
          <UserRound className="h-3.5 w-3.5" />
          <ChevronDown className="h-3 w-3" />
        </button>

        {open && (
          <div
            role="menu"
            className="glass absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-card p-1.5 shadow-lg"
          >
            {items.map(({ href, label, Icon }) => (
              <Link key={href} href={href} role="menuitem" onClick={() => setOpen(false)} className={itemClass}>
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            ))}
            <div className="my-1 h-px bg-line" />
            {isAdmin && (
              <Link href="/admin" role="menuitem" onClick={() => setOpen(false)} className={itemClass}>
                <Shield className="h-4 w-4 shrink-0" />
                Admin
              </Link>
            )}
            <Link href="/account" role="menuitem" onClick={() => setOpen(false)} className={itemClass}>
              <Settings className="h-4 w-4 shrink-0" />
              Account
            </Link>
            <button
              role="menuitem"
              onClick={() => {
                setOpen(false);
                signOut({ callbackUrl: "/" });
              }}
              className={itemClass}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
