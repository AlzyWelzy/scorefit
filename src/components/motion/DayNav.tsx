"use client";
import { useEffect, useState } from "react";

type Day = { slug: string; title: string; count: number };

// Sticky day rail with scroll-spy. Desktop: vertical rail. Mobile: pill scroller.
export function DayNav({ days }: { days: Day[] }) {
  const [active, setActive] = useState(days[0]?.slug);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 },
    );
    days.forEach((d) => {
      const el = document.getElementById(d.slug);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [days]);

  return (
    <nav className="flex gap-1.5 overflow-x-auto lg:flex-col lg:gap-1 lg:overflow-visible">
      {days.map((d) => {
        const on = active === d.slug;
        return (
          <a
            key={d.slug}
            href={`#${d.slug}`}
            aria-current={on ? "true" : undefined}
            className={`flex shrink-0 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm transition-all ${
              on
                ? "border-accent/40 bg-accent-dim text-fg ring-accent glow-accent"
                : "border-transparent text-muted hover:bg-surface hover:text-fg"
            }`}
          >
            <span className="font-display font-semibold">{d.title}</span>
            <span className="num text-xs text-faint">{d.count}</span>
          </a>
        );
      })}
    </nav>
  );
}
