import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ExerciseImage } from "./ExerciseImage";
import { RpeBadge } from "./Readout";

type Ex = {
  name: string;
  slug: string;
  demo?: string | null;
  reps?: string | null;
  workingSets?: string | null;
  warmupSets?: string | null;
  lastRPE?: string | null;
  earlyRPE?: string | null;
  rest?: string | null;
  technique?: string | null;
  sub1?: string | null;
  sub2?: string | null;
  notes?: string | null;
};

// Full-prescription row used inside a training day.
export function ExerciseRow({ ex, index }: { ex: Ex; index: number }) {
  const tech = ex.technique && !/^none/i.test(ex.technique) ? ex.technique : null;
  return (
    <Link
      href={`/exercises/${ex.slug}`}
      className="group block rounded-card border border-line bg-surface p-3 transition-all hover:border-line-2 hover:bg-surface-2"
    >
      <div className="flex gap-4">
        <ExerciseImage
          slug={ex.slug}
          demo={ex.demo}
          name={ex.name}
          className="h-[68px] w-[68px] shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-display font-semibold leading-tight text-fg group-hover:text-accent">
              <span className="num mr-2 text-faint">{String(index + 1).padStart(2, "0")}</span>
              {ex.name}
            </h4>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-faint transition-colors group-hover:text-accent" />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <Metric label="sets" value={ex.workingSets} />
            <Metric label="reps" value={ex.reps} />
            <RpeBadge rpe={ex.lastRPE} />
            {ex.rest && <Metric label="rest" value={ex.rest} />}
          </div>
          {tech && (
            <span className="mt-2 inline-block rounded border border-accent/25 bg-accent-dim px-1.5 py-0.5 text-xs text-accent-2">
              {tech}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function Metric({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <span className="inline-flex items-baseline gap-1.5 text-sm">
      <span className="num font-semibold text-fg">{value}</span>
      <span className="eyebrow">{label}</span>
    </span>
  );
}

// Library grid card.
export function ExerciseLibraryCard({
  ex,
}: {
  ex: { name: string; slug: string; demo?: string | null; technique?: string | null };
}) {
  return (
    <Link
      href={`/exercises/${ex.slug}`}
      className="group flex flex-col overflow-hidden rounded-card border border-line bg-surface transition-all hover:border-line-2"
    >
      <ExerciseImage
        slug={ex.slug}
        demo={ex.demo}
        name={ex.name}
        rounded=""
        className="aspect-video w-full"
      />
      <div className="flex items-start justify-between gap-2 p-3.5">
        <h4 className="font-display text-sm font-semibold leading-tight text-fg group-hover:text-accent">
          {ex.name}
        </h4>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-faint transition-colors group-hover:text-accent" />
      </div>
    </Link>
  );
}
