import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { guidebook, getGuideSection, getGuideSectionWithIndex } from "@/lib/data";
import { Markdown } from "@/components/Markdown";
import { Reveal } from "@/components/motion/Reveal";
import { techArticle, breadcrumbs, ldJson } from "@/lib/structuredData";

export function generateStaticParams() {
  return guidebook.sections.map((s) => ({ section: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string }>;
}): Promise<Metadata> {
  const { section } = await params;
  const s = getGuideSection(section);
  if (!s) return {};
  return { title: s.title, description: `${s.title} — from the ScoreFit training guidebook.` };
}

export default async function GuideSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const found = getGuideSectionWithIndex(section);
  if (!found) notFound();
  const { section: s, index: idx } = found;
  const prev = guidebook.sections[idx - 1];
  const next = guidebook.sections[idx + 1];

  const ld = [
    breadcrumbs([
      { name: "Guidebook", path: "/guidebook" },
      { name: s.title, path: `/guidebook/${s.slug}` },
    ]),
    techArticle({
      headline: s.title,
      description: `${s.title} — from the ScoreFit training guidebook.`,
      path: `/guidebook/${s.slug}`,
    }),
  ];

  return (
    <div className="theme-editorial min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(ld) }} />
      <div className="mx-auto max-w-3xl px-5 py-14">
      <Reveal>
        <Link href="/guidebook" className="eyebrow hover:text-fg">← Guidebook</Link>
        <div className="mt-3 flex items-baseline gap-3">
          <span className="num text-sm text-faint">{String(idx + 1).padStart(2, "0")}</span>
          <h1 className="font-display text-4xl font-bold tracking-tight">{s.title}</h1>
        </div>
        <div className="mt-6 h-px w-full bg-line" />
      </Reveal>

      <Reveal delay={0.05}>
        <article className="mt-8">
          <Markdown>{s.body}</Markdown>
        </article>
      </Reveal>

      <nav className="mt-16 grid gap-3 border-t border-line pt-6 sm:grid-cols-2">
        {prev ? (
          <Link href={`/guidebook/${prev.slug}`} className="group rounded-card border border-line bg-surface p-4 transition-colors hover:border-line-2">
            <span className="eyebrow flex items-center gap-1"><ArrowLeft className="h-3 w-3" /> Previous</span>
            <div className="mt-1 font-display font-semibold group-hover:text-accent">{prev.title}</div>
          </Link>
        ) : <span />}
        {next ? (
          <Link href={`/guidebook/${next.slug}`} className="group rounded-card border border-line bg-surface p-4 text-right transition-colors hover:border-line-2 sm:col-start-2">
            <span className="eyebrow">Next →</span>
            <div className="mt-1 font-display font-semibold group-hover:text-accent">{next.title}</div>
          </Link>
        ) : <span />}
      </nav>
      </div>
    </div>
  );
}
