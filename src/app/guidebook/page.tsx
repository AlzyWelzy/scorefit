import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import { guidebook } from "@/lib/data";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/Reveal";

export const metadata: Metadata = {
  title: "Guidebook",
  description:
    "The full ScoreFit guidebook: training principles, RPE scale, progression, gear, anatomy, nutrition, supplements, FAQ, and references.",
};

export default function GuidebookPage() {
  return (
    <div className="mx-auto max-w-4xl px-5 py-16">
      <Reveal>
        <span className="eyebrow">Learn</span>
        <h1 className="mt-2.5 font-display text-4xl font-bold tracking-tight sm:text-5xl">The Guidebook</h1>
        <p className="mt-4 max-w-2xl text-muted">
          The complete manual behind both programs — the philosophy, how to read and run
          the system, anatomy, nutrition, and the full FAQ.
        </p>
      </Reveal>

      <RevealGroup className="mt-12 grid gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-2" stagger={0.04}>
        {guidebook.sections.map((s, i) => (
          <RevealItem key={s.slug} className="h-full">
            <Link href={`/guidebook/${s.slug}`} className="group flex h-full items-center justify-between gap-3 bg-bg p-5 transition-colors hover:bg-surface">
              <div className="flex items-baseline gap-3">
                <span className="num text-sm text-faint">{String(i + 1).padStart(2, "0")}</span>
                <span className="font-display font-semibold group-hover:text-accent">{s.title}</span>
              </div>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-faint transition-colors group-hover:text-accent" />
            </Link>
          </RevealItem>
        ))}
      </RevealGroup>
    </div>
  );
}
