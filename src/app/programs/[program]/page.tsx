import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowUpRight, BookOpen } from "lucide-react";
import { getProgram, PROGRAM_META, blockFor, isDeload, type ProgramId } from "@/lib/data";
import { VolumeChart } from "@/components/VolumeChart";
import { CountUp } from "@/components/motion/CountUp";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/Reveal";

export function generateStaticParams() {
  return [{ program: "beginner" }, { program: "intermediate" }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ program: string }>;
}): Promise<Metadata> {
  const { program } = await params;
  const p = getProgram(program);
  if (!p) return {};
  return {
    title: p.name,
    description: `${p.name}: a 12-week, 5-day hypertrophy program with full exercise prescriptions, RPE targets, and substitutions.`,
  };
}

const VOL = [62, 72, 72, 72, 72, 64, 85, 85, 97, 97, 108, 108];
const SCHEDULE: [string, string, string][] = [
  ["Mon", "Upper", "Strength"],
  ["Tue", "Lower", "Strength"],
  ["Wed", "Rest", ""],
  ["Thu", "Pull", "Hypertrophy"],
  ["Fri", "Push", "Hypertrophy"],
  ["Sat", "Legs", "Hypertrophy"],
  ["Sun", "Rest", ""],
];

export default async function ProgramPage({
  params,
}: {
  params: Promise<{ program: string }>;
}) {
  const { program } = await params;
  const p = getProgram(program);
  if (!p) notFound();
  const meta = PROGRAM_META[program as ProgramId];

  return (
    <div className="mx-auto max-w-6xl px-5 py-14">
      <Reveal>
        <Link href="/programs" className="eyebrow hover:text-fg">← Programs</Link>
        <h1 className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">{p.name}</h1>
        <p className="mt-4 max-w-2xl text-muted">
          {meta.tagline} A 5-day Upper / Lower / Pull / Push / Legs split run over a
          5-week Foundation block and a 7-week Ramping block, then looped.
        </p>
      </Reveal>

      <Reveal delay={0.05}>
        <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-4">
          <Cell><CountUp to={12} className="num text-3xl font-bold" /><span className="eyebrow mt-1.5">weeks</span></Cell>
          <Cell><CountUp to={5} suffix="×" className="num text-3xl font-bold text-data" /><span className="eyebrow mt-1.5">days / week</span></Cell>
          <Cell><CountUp to={2} className="num text-3xl font-bold" /><span className="eyebrow mt-1.5">blocks</span></Cell>
          <Cell><span className="num text-3xl font-bold text-accent">&#8734;</span><span className="eyebrow mt-1.5">loop / deload</span></Cell>
        </div>
      </Reveal>

      <div className="mt-12 grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <Reveal>
          <div>
            <h2 className="eyebrow mb-3">Weekly schedule</h2>
            <div className="overflow-hidden rounded-card border border-line">
              {SCHEDULE.map(([day, focus, tag], i) => (
                <div
                  key={day}
                  className={`flex items-center justify-between px-4 py-3 ${i % 2 ? "bg-surface" : "bg-surface-2"} ${focus === "Rest" ? "text-faint" : ""}`}
                >
                  <span className="num w-10 text-sm text-muted">{day}</span>
                  <span className="flex-1 font-display font-semibold">{focus}</span>
                  <span className="eyebrow">{tag}</span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
        <Reveal delay={0.05}>
          <VolumeChart />
        </Reveal>
      </div>

      <h2 className="eyebrow mb-4 mt-14">Select a week — color shows volume</h2>
      <RevealGroup className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" stagger={0.04}>
        {p.weeks.map((w) => {
          const deload = isDeload(w.number);
          const intensity = (VOL[w.number - 1] - 55) / (108 - 55);
          const ramping = w.number > 5;
          const tint = ramping ? "255,106,61" : "155,164,173";
          return (
            <RevealItem key={w.number}>
              <Link
                href={`/programs/${program}/week/${w.number}`}
                className="group relative block overflow-hidden rounded-card border border-line p-4 transition-all hover:border-line-2"
                style={{ background: `linear-gradient(135deg, rgba(${tint},${0.05 + intensity * 0.16}), var(--color-surface) 70%)` }}
              >
                <div className="flex items-center justify-between">
                  <span className="num text-2xl font-bold text-fg">W{String(w.number).padStart(2, "0")}</span>
                  <ArrowUpRight className="h-4 w-4 text-faint transition-colors group-hover:text-accent" />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <Tag>{blockFor(w.number)}</Tag>
                  {deload && <Tag accent>Deload</Tag>}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-bg/60">
                    <div className="h-full rounded-full" style={{ width: `${intensity * 100}%`, background: ramping ? "var(--color-accent)" : "var(--color-faint)" }} />
                  </div>
                  <span className="num text-[10px] text-faint">{VOL[w.number - 1]}</span>
                </div>
              </Link>
            </RevealItem>
          );
        })}
      </RevealGroup>

      <Reveal>
        <div className="mt-12 flex items-center gap-3 rounded-card border border-line bg-surface p-5">
          <BookOpen className="h-5 w-5 shrink-0 text-accent" />
          <p className="text-sm text-muted">
            New here? Read the{" "}
            <Link href="/guidebook/understanding-the-program" className="text-data hover:underline">program guide</Link>{" "}
            and the{" "}
            <Link href="/guidebook/the-6-training-principles" className="text-data hover:underline">RPE scale</Link>{" "}
            before your first session.
          </p>
        </div>
      </Reveal>
    </div>
  );
}

function Cell({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col bg-bg px-4 py-5">{children}</div>;
}

function Tag({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs ${accent ? "border border-accent/25 bg-accent-dim text-accent-2" : "border border-line bg-bg/40 text-muted"}`}>
      {children}
    </span>
  );
}
