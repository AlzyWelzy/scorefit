import Link from "next/link";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="relative mt-28 border-t border-line">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-data/25 to-transparent" />
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:grid-cols-2 md:grid-cols-4">
        <div className="sm:col-span-2 md:col-span-1">
          <Logo size={24} />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
            The instrument panel for hypertrophy. Two 12-week programs, 53 exercises,
            every last set tracked.
          </p>
        </div>
        <FooterCol title="Train" links={[["/programs/beginner", "Beginner"], ["/programs/intermediate", "Intermediate / Advanced"], ["/exercises", "Exercise library"]]} />
        <FooterCol title="Learn" links={[["/guidebook", "Guidebook"], ["/guidebook/the-6-training-principles", "Training principles"], ["/guidebook/warming-up-properly", "Warming up"], ["/guidebook/bodybuilding-nutrition", "Nutrition"], ["/guidebook/sleep-and-recovery", "Sleep & recovery"], ["/guidebook/faq", "FAQ"]]} />
        <FooterCol title="Reference" links={[["/guidebook/muscle-anatomy-how-each-muscle-is-trained", "Anatomy"], ["/guidebook/bodybuilding-supplements", "Supplements"], ["/guidebook/glossary-key-terms", "Glossary"], ["/guidebook/references-clickable-in-the-original-guidebook", "References"]]} />
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 px-5 py-5 text-xs text-faint sm:flex-row sm:items-center">
          <span className="tabular">scorefit.net</span>
          <span>Educational content. Consult a physician before starting any training program.</span>
          <nav aria-label="Legal" className="flex items-center gap-4">
            <Link href="/privacy" className="transition-colors hover:text-accent-2">Privacy</Link>
            <Link href="/terms" className="transition-colors hover:text-accent-2">Terms</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h3 className="eyebrow mb-3.5">{title}</h3>
      <ul className="space-y-2.5">
        {links.map(([href, label]) => (
          <li key={href}>
            <Link href={href} className="text-sm text-muted transition-colors hover:text-accent-2">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
