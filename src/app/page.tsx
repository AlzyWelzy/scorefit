import Link from "next/link";
import { ArrowRight, ArrowUpRight, Target, Gauge, TrendingUp, Repeat, Dumbbell, Layers } from "lucide-react";
import { ExerciseLibraryCard } from "@/components/ExerciseCard";
import { VolumeChart } from "@/components/VolumeChart";
import { CountUp } from "@/components/motion/CountUp";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/Reveal";
import { exerciseLibrary, PROGRAM_META } from "@/lib/data";

const PRINCIPLES = [
  { icon: Target, n: "01", title: "Tension over everything", body: "Tension is the main driver of hypertrophy. The other five principles all serve it." },
  { icon: Dumbbell, n: "02", title: "Technique", body: "A controlled 2–4s negative and a deep stretch land tension on the target muscle." },
  { icon: Gauge, n: "03", title: "Effort", body: "Early sets stop 1–2 reps shy; the last set goes to failure." },
  { icon: TrendingUp, n: "04", title: "Progressive overload", body: "Double progression: add reps to the top of the range, then add weight and reset." },
  { icon: Layers, n: "05", title: "High-tension exercises", body: "Machines and cables for even resistance, safety to failure, and a long-length bias." },
  { icon: Repeat, n: "06", title: "Intensity techniques", body: "Failure, long-length partials, myo-reps, and static stretches on the last set." },
];

export default function Home() {
  const featured = ["45-incline-barbell-press", "bayesian-cable-curl", "high-cable-lateral-raise", "smith-machine-squat", "lying-leg-curl", "wide-grip-pull-up"]
    .map((s) => exerciseLibrary.find((e) => e.slug === s))
    .filter(Boolean) as typeof exerciseLibrary[number][];

  return (
    <>
      {/* ── HERO ── */}
      <section className="relative overflow-hidden border-b border-line">
        <div className="bg-grid absolute inset-0" />
        <div className="glow-ember left-1/2 top-[-120px] h-[420px] w-[680px] -translate-x-1/2" />
        <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-20 md:pb-24 md:pt-28">
          <Reveal>
            <span className="eyebrow">Science-based hypertrophy · scorefit.net</span>
          </Reveal>
          <Reveal delay={0.05}>
            <h1 className="mt-5 max-w-4xl font-display text-[2.9rem] font-extrabold leading-[0.98] tracking-tight sm:text-6xl md:text-7xl">
              Train by the <span className="text-accent">numbers.</span>
            </h1>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              Two 12-week programs built on tension, effort, and meticulous tracking.
              Every exercise carries a target — sets, reps, RPE, rest. Every last set
              goes to failure.
            </p>
          </Reveal>
          <Reveal delay={0.15}>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/programs/beginner" className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 font-semibold text-bg transition-colors hover:bg-accent-2">
                Start Beginner <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/programs/intermediate" className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-5 py-3 font-semibold text-fg transition-colors hover:border-line-2">
                Intermediate / Advanced
              </Link>
            </div>
          </Reveal>

          {/* hero readout band */}
          <Reveal delay={0.2}>
            <div className="mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-4">
              <HeroStat to={24} label="weeks total" />
              <HeroStat to={53} label="exercises" accent="data" />
              <HeroStat to={780} label="tracked sets" />
              <HeroStat to={10} label="RPE ceiling" accent="accent" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── PROGRAMS (bento) ── */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <SectionHead eyebrow="Choose your track" title="Two programs, one system" />
        <RevealGroup className="grid gap-5 md:grid-cols-2">
          {(["beginner", "intermediate"] as const).map((id) => {
            const m = PROGRAM_META[id];
            return (
              <RevealItem key={id}>
                <Link href={m.href} className="group relative flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface p-7 transition-all hover:border-line-2">
                  <div className="glow-ember -right-20 -top-20 h-48 w-48 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                  <div className="relative flex items-center justify-between">
                    <span className="eyebrow">{m.level}</span>
                    <ArrowUpRight className="h-5 w-5 text-faint transition-colors group-hover:text-accent" />
                  </div>
                  <h3 className="relative mt-4 font-display text-3xl font-bold">{m.name}</h3>
                  <p className="relative mt-2 flex-1 text-muted">{m.tagline}</p>
                  <div className="relative mt-6 flex items-end gap-1 border-t border-line pt-5">
                    {[62, 72, 72, 72, 72, 64, 85, 85, 97, 97, 108, 108].map((v, i) => (
                      <span key={i} className="flex-1 rounded-t-sm bg-accent/80" style={{ height: `${(v / 120) * 38}px`, opacity: i < 5 ? 0.4 : 1 }} />
                    ))}
                  </div>
                  <div className="relative mt-4 flex gap-6">
                    <Mini value="12" label="weeks" />
                    <Mini value="5×" label="days/wk" />
                    <Mini value="U/L/P/P/L" label="split" />
                  </div>
                </Link>
              </RevealItem>
            );
          })}
        </RevealGroup>
      </section>

      {/* ── PRINCIPLES ── */}
      <section className="border-y border-line bg-surface/40">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <SectionHead eyebrow="The method" title="Six training principles" />
          <RevealGroup className="grid gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {PRINCIPLES.map((p) => (
              <RevealItem key={p.n} className="h-full">
                <div className="flex h-full flex-col bg-bg p-6">
                  <div className="flex items-center gap-3">
                    <p.icon className="h-5 w-5 text-accent" />
                    <span className="num text-sm text-faint">{p.n}</span>
                  </div>
                  <h3 className="mt-3.5 font-display text-lg font-semibold">{p.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{p.body}</p>
                </div>
              </RevealItem>
            ))}
          </RevealGroup>
          <Reveal>
            <Link href="/guidebook/the-6-training-principles" className="mt-6 inline-flex items-center gap-2 text-sm text-data hover:underline">
              Read the full principles <ArrowRight className="h-4 w-4" />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ── VOLUME RAMP ── */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <Reveal>
            <div>
              <SectionHead eyebrow="Progression model" title="Volume that ramps" noMargin />
              <p className="mt-5 text-muted">
                The Foundation block holds volume flat to establish a baseline. The Ramping
                block steps it up every two weeks — shown to beat constant volume even at a
                similar weekly average.
              </p>
              <p className="mt-3 text-muted">
                After Week 12 you loop back to Week 1, which doubles as a deload.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <VolumeChart />
          </Reveal>
        </div>
      </section>

      {/* ── LIBRARY TEASER ── */}
      <section className="border-t border-line bg-surface/40">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="flex items-end justify-between">
            <SectionHead eyebrow="Movement library" title="53 exercises on video" noMargin />
            <Link href="/exercises" className="hidden items-center gap-2 text-sm text-data hover:underline sm:inline-flex">
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <RevealGroup className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {featured.map((ex) => (
              <RevealItem key={ex.slug}>
                <ExerciseLibraryCard ex={ex} />
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>
    </>
  );
}

function HeroStat({ to, label, accent = "fg" }: { to: number; label: string; accent?: "fg" | "accent" | "data" }) {
  const color = accent === "accent" ? "text-accent" : accent === "data" ? "text-data" : "text-fg";
  return (
    <div className="bg-bg px-5 py-6">
      <CountUp to={to} className={`num text-4xl font-bold sm:text-5xl ${color}`} />
      <div className="eyebrow mt-2">{label}</div>
    </div>
  );
}

function SectionHead({ eyebrow, title, noMargin }: { eyebrow: string; title: string; noMargin?: boolean }) {
  return (
    <div className={noMargin ? "" : "mb-10"}>
      <span className="eyebrow">{eyebrow}</span>
      <h2 className="mt-2.5 font-display text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
    </div>
  );
}

function Mini({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="num text-lg font-semibold text-fg">{value}</div>
      <div className="eyebrow mt-0.5">{label}</div>
    </div>
  );
}
