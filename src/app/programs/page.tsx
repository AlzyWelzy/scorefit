import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import { PROGRAM_META } from "@/lib/data";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/Reveal";
import { TodayCardMount } from "@/components/TodayCardMount";

export const metadata: Metadata = {
  title: "Programs",
  description: "Choose the Beginner or Intermediate / Advanced 12-week hypertrophy program.",
};

export default function ProgramsPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-16">
      <Reveal>
        <span className="eyebrow">Train</span>
        <h1 className="mt-2.5 font-display text-4xl font-bold tracking-tight sm:text-5xl">
          Choose your program
        </h1>
        <p className="mt-4 max-w-xl text-muted">
          Both run a 5-day Upper / Lower / Pull / Push / Legs split across two 12-week
          blocks. Pick by training age and honest effort capacity.
        </p>
      </Reveal>

      <Reveal delay={0.05}>
        <div className="mt-8">
          <TodayCardMount />
        </div>
      </Reveal>

      <RevealGroup className="mt-8 grid gap-5 md:grid-cols-2">
        {(["beginner", "intermediate"] as const).map((id) => {
          const m = PROGRAM_META[id];
          return (
            <RevealItem key={id}>
              <Link href={m.href} className="group relative flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface p-8 transition-all hover:border-line-2">
                <div className="glow-ember -right-16 -top-16 h-44 w-44 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                <span className="eyebrow relative">{m.level}</span>
                <h2 className="relative mt-3 font-display text-3xl font-bold">{m.name}</h2>
                <p className="relative mt-2 flex-1 text-muted">{m.tagline}</p>
                <span className="relative mt-7 inline-flex items-center gap-2 font-semibold text-accent">
                  Open program <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </span>
              </Link>
            </RevealItem>
          );
        })}
      </RevealGroup>
    </div>
  );
}
