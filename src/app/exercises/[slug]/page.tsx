import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Repeat2 } from "lucide-react";
import { exerciseLibrary, getExercise, PROGRAM_META, type ProgramId } from "@/lib/data";
import { archetypeFor, ARCHETYPE_LABEL } from "@/lib/movement";
import { YouTubeFacade } from "@/components/YouTubeFacade";
import { Stat, RpeBar } from "@/components/Readout";
import { Reveal } from "@/components/motion/Reveal";
import { videoId, thumbUrl } from "@/lib/youtube";

export function generateStaticParams() {
  return exerciseLibrary.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const ex = getExercise(slug);
  if (!ex) return {};
  return {
    title: ex.name,
    description: `${ex.name} — demo video, coaching cues, substitutions, and where it appears in the ScoreFit programs.`,
  };
}

export default async function ExercisePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ex = getExercise(slug);
  if (!ex) notFound();

  const arch = archetypeFor(ex.name);
  const first = ex.appearsIn[0];
  const tech = ex.technique && !/^none/i.test(ex.technique) ? ex.technique : null;
  const programs = Array.from(new Set(ex.appearsIn.map((a) => a.program))) as ProgramId[];

  const vid = videoId(ex.demo);
  const videoLd = vid
    ? {
        "@context": "https://schema.org",
        "@type": "VideoObject",
        name: ex.name,
        description: `${ex.name} — demonstration, coaching cues, and substitutions in the ScoreFit programs.`,
        thumbnailUrl: thumbUrl(ex.demo, "hq"),
        contentUrl: `https://www.youtube.com/watch?v=${vid}`,
        embedUrl: `https://www.youtube.com/embed/${vid}`,
      }
    : null;

  return (
    <div className="mx-auto max-w-5xl px-5 py-14">
      {videoLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(videoLd) }}
        />
      )}
      <Reveal>
        <Link href="/exercises" className="eyebrow hover:text-fg">← Exercise library</Link>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded border border-data/30 bg-data/10 px-2 py-0.5 text-xs text-data">{ARCHETYPE_LABEL[arch]}</span>
          {tech && <span className="rounded border border-accent/25 bg-accent-dim px-2 py-0.5 text-xs text-accent-2">{tech}</span>}
        </div>
        <h1 className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl"><span className="gradient-text">{ex.name}</span></h1>
      </Reveal>

      <div className="mt-8 grid gap-8 md:grid-cols-[1.15fr_0.85fr]">
        {/* media (sticky on desktop) */}
        <Reveal>
          <div className="md:sticky md:top-24">
            <div className="mb-2 flex items-center justify-between">
              <span className="eyebrow">Demonstration</span>
              <span className="num text-xs text-faint">tap to play</span>
            </div>
            <YouTubeFacade url={ex.demo} title={ex.name} />
          </div>
        </Reveal>

        {/* prescription + cues */}
        <Reveal delay={0.05}>
          <div className="space-y-8">
            {first && (
              <div>
                <span className="eyebrow">Prescription · first appearance</span>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <Stat value={first.workingSets ?? "—"} label="working sets" />
                  <Stat value={first.reps ?? "—"} label="reps" accent="data" />
                </div>
                {first.lastRPE && (
                  <div className="card mt-3 px-4 py-3.5">
                    <div className="mb-2 flex items-baseline justify-between">
                      <span className="eyebrow">last-set RPE</span>
                      <span className="num text-sm text-muted">{first.lastRPE.replace("~", "")}</span>
                    </div>
                    <RpeBar rpe={first.lastRPE} />
                  </div>
                )}
              </div>
            )}

            {ex.notes && (
              <div className="card p-5">
                <h2 className="eyebrow-accent mb-2">Coaching cues</h2>
                <p className="leading-relaxed text-fg/90">{ex.notes}</p>
              </div>
            )}
          </div>
        </Reveal>
      </div>

      {/* substitutions */}
      <Reveal>
        <div className="mt-12">
          <h2 className="eyebrow mb-3">Substitutions</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {[ex.sub1, ex.sub2].filter(Boolean).map((s, i) => (
              <div key={i} className="card card-hover flex items-center gap-3 p-4">
                <Repeat2 className="h-5 w-5 shrink-0 text-data" />
                <div>
                  <div className="eyebrow">Option {i + 1}</div>
                  <div className="font-display font-semibold">{s}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      {/* appears in */}
      <Reveal>
        <div className="mt-10">
          <h2 className="eyebrow mb-3">Appears in</h2>
          <div className="flex flex-wrap gap-2">
            {programs.map((pid) => {
              const weeks = Array.from(new Set(ex.appearsIn.filter((a) => a.program === pid).map((a) => a.week))).sort((a, b) => a - b);
              return weeks.map((wk) => (
                <Link
                  key={`${pid}-${wk}`}
                  href={`/programs/${pid}/week/${wk}`}
                  className="btn-surface num px-2.5 py-1 text-xs text-muted hover:text-fg"
                >
                  {PROGRAM_META[pid].name.split(" ")[0]} · W{wk}
                </Link>
              ));
            })}
          </div>
        </div>
      </Reveal>
    </div>
  );
}
