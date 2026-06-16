import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Info } from "lucide-react";
import { getProgram, getWeek, blockFor, isDeload, PROGRAM_IDS } from "@/lib/data";
import { ExerciseRow } from "@/components/ExerciseCard";
import { PrintButton } from "@/components/PrintButton";
import { DayNav } from "@/components/motion/DayNav";
import { Reveal } from "@/components/motion/Reveal";

export function generateStaticParams() {
  const out: { program: string; week: string }[] = [];
  for (const program of PROGRAM_IDS) {
    const p = getProgram(program);
    if (!p) continue;
    for (const w of p.weeks) out.push({ program, week: String(w.number) });
  }
  return out;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ program: string; week: string }>;
}): Promise<Metadata> {
  const { program, week } = await params;
  const p = getProgram(program);
  if (!p) return {};
  return {
    title: `${p.name} — Week ${week}`,
    description: `Week ${week} (${blockFor(Number(week))} block) of the ${p.name}: full training days with sets, reps, and RPE.`,
    alternates: { canonical: `/programs/${program}/week/${week}` },
  };
}

export default async function WeekPage({
  params,
}: {
  params: Promise<{ program: string; week: string }>;
}) {
  const { program, week } = await params;
  const weekNum = Number(week);
  const p = getProgram(program);
  const w = getWeek(program, weekNum);
  if (!p || !w) notFound();

  const deload = isDeload(weekNum);
  const lastWeek = p.weeks.length;
  const prev = weekNum > 1 ? weekNum - 1 : null;
  const next = weekNum < lastWeek ? weekNum + 1 : null;
  const navDays = w.days.map((d) => ({ slug: d.slug, title: d.title.split(" ")[0] ?? d.title, count: d.exercises.length }));

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <Reveal>
        <Link href={`/programs/${program}`} className="eyebrow hover:text-fg">← {p.name}</Link>
        <div className="mt-3 flex flex-wrap items-baseline gap-3">
          <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
            Week <span className="num">{weekNum}</span>
          </h1>
          <span className="rounded border border-line bg-surface px-2 py-0.5 text-sm text-muted">{blockFor(weekNum)} block</span>
          {deload && <span className="rounded border border-accent/25 bg-accent-dim px-2 py-0.5 text-sm text-accent-2">Intro / deload</span>}
          <span className="ml-auto print:hidden"><PrintButton label="Print week" /></span>
        </div>
        {w.subtitle && <p className="mt-2 italic text-muted">{w.subtitle}</p>}
        {deload && (
          <div className="mt-5 flex gap-3 rounded-card border border-line bg-surface p-4">
            <Info className="h-5 w-5 shrink-0 text-data" />
            <p className="text-sm text-muted">
              Intro / deload week — sets stop short of failure to learn the lifts and
              recover. Use lighter loads and leave reps in the tank.
            </p>
          </div>
        )}
      </Reveal>

      <div className="mt-10 gap-10 lg:grid lg:grid-cols-[180px_1fr]">
        {/* sticky day rail */}
        <div className="sticky top-20 z-30 -mx-5 mb-6 border-b border-line bg-bg/85 px-5 py-3 backdrop-blur lg:mx-0 lg:mb-0 lg:self-start lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
          <span className="eyebrow mb-2 hidden lg:block">Training days</span>
          <DayNav days={navDays} />
        </div>

        {/* day sections */}
        <div className="space-y-14">
          {w.days.map((d) => (
            <section key={d.slug} id={d.slug} className="scroll-mt-32">
              <div className="mb-4 flex items-center gap-3 border-b border-line pb-3">
                <h2 className="font-display text-xl font-semibold">{d.title}</h2>
                <span className="num text-sm text-faint">{d.exercises.length} exercises</span>
              </div>
              <div className="space-y-3">
                {d.exercises.map((ex, i) => (
                  <ExerciseRow key={`${d.slug}-${ex.slug}-${i}`} ex={ex} index={i} />
                ))}
              </div>
            </section>
          ))}

          <div className="flex items-center justify-between border-t border-line pt-6">
            {prev ? (
              <Link href={`/programs/${program}/week/${prev}`} className="inline-flex items-center gap-2 text-muted hover:text-fg">
                <ArrowLeft className="h-4 w-4" /> Week {prev}
              </Link>
            ) : <span />}
            {next ? (
              <Link href={`/programs/${program}/week/${next}`} className="inline-flex items-center gap-2 text-muted hover:text-fg">
                Week {next} <ArrowRight className="h-4 w-4" />
              </Link>
            ) : <span className="num text-sm text-faint">Loop → Week 1 (deload)</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
