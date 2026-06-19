import type { Metadata } from "next";
import { exerciseLibrary } from "@/lib/data";
import { archetypeFor, ARCHETYPE_LABEL, equipmentFor, EQUIPMENT_ALL, type Archetype } from "@/lib/movement";
import { ExerciseLibraryCard } from "@/components/ExerciseCard";
import { CountUp } from "@/components/motion/CountUp";
import { Reveal } from "@/components/motion/Reveal";
import { LibraryBrowser, type CardItem } from "@/components/LibraryBrowser";
import { itemList, ldJson } from "@/lib/structuredData";

export const metadata: Metadata = {
  title: "Exercise library",
  description:
    "All 53 exercises in the ScoreFit system, filter by movement pattern and equipment, each with a real demo video, coaching cues, and substitutions.",
};

const ORDER: Archetype[] = [
  "press", "pull", "raise", "curl", "triceps",
  "squat", "hinge", "legcurl", "calf", "core", "static",
];

export default function ExercisesPage() {
  // Render each card on the server (ExerciseImage uses fs at build), then hand
  // the nodes to the client filter — which only reads archetype/equipment.
  const cards: CardItem[] = exerciseLibrary.map((ex, i) => ({
    slug: ex.slug,
    archetype: archetypeFor(ex.name),
    equipment: equipmentFor(ex.name),
    // Eager-load the first row so the library page's LCP image isn't lazy.
    node: <ExerciseLibraryCard ex={ex} eager={i < 6} />,
  }));

  const order = ORDER.map((key) => ({ key, label: ARCHETYPE_LABEL[key] }));

  const ld = itemList({
    name: "ScoreFit exercise library",
    items: exerciseLibrary.map((ex) => ({ name: ex.name, path: `/exercises/${ex.slug}` })),
  });

  return (
    <div className="mx-auto max-w-6xl px-5 py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(ld) }} />
      <Reveal>
        <span className="eyebrow-accent">Movement library</span>
        <h1 className="display-tight mt-2.5 flex items-baseline gap-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">
          <CountUp to={53} className="num gradient-text" /> exercises
        </h1>
        <p className="mt-4 max-w-xl text-muted">
          Every movement in both programs. Filter by pattern or equipment — each has a demo
          video, coaching cues, and two substitutions.
        </p>
      </Reveal>

      <LibraryBrowser cards={cards} order={order} equipment={EQUIPMENT_ALL} />
    </div>
  );
}
